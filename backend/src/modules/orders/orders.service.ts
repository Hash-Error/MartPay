import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { InvoiceGeneratorService } from './invoice-generator.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { VerifyExitDto } from './dto/verify-exit.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private jwtService: JwtService,
    private auditLogsService: AuditLogsService,
    private invoiceGeneratorService: InvoiceGeneratorService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { items, storeId } = createOrderDto;
    const resolvedItems: any[] = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { barcode: item.barcode },
      });

      if (!product) {
        throw new NotFoundException(`Product with barcode ${item.barcode} not found`);
      }

      // Compute discounted price
      const finalPrice = product.price * (1 - product.discountRate);
      totalAmount += finalPrice * item.quantity;

      resolvedItems.push({
        barcode: product.barcode,
        name: product.name,
        price: finalPrice,
        quantity: item.quantity,
      });
    }

    const order = await this.prisma.order.create({
      data: {
        userId,
        storeId,
        items: resolvedItems,
        totalAmount,
        status: 'pending',
      },
    });

    // Notify Order Created
    try {
      await this.notificationsService.notifyOrderCreated(userId, order.id, totalAmount);
    } catch (err) {
      // Bypass
    }

    return { status: 'success', data: { order } };
  }

  async pay(orderId: string, payOrderDto: PayOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'paid' || order.status === 'completed_exit') {
      throw new BadRequestException('Order is already paid');
    }

    // Set as paid and issue mock QR credentials
    const qrToken = `qr_mock_rcpt_${Math.random().toString(36).substring(2, 12)}`;
    const qrExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        qrToken,
        qrExpiresAt,
      },
    });

    return { status: 'success', data: { order: updated } };
  }

  async findHistory(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { status: 'success', data: { orders } };
  }

  // ----------------------------------------------------
  // SECURE QR CODE RETRIEVAL (CUSTOMER SIDE)
  // ----------------------------------------------------

  async generateQrCode(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'paid') {
      throw new BadRequestException('QR receipts are only available for paid orders');
    }

    const expiresAt = order.qrExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
    const storeId = order.storeId || 'global-store';

    const payload = {
      orderId: order.id,
      storeId,
    };

    const qrToken = await this.jwtService.signAsync(payload, {
      expiresIn: '24h',
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { qrToken, qrExpiresAt: expiresAt },
    });

    return {
      status: 'success',
      data: {
        orderId: order.id,
        qrToken,
        expiresAt,
        storeId,
      },
    };
  }

  // ----------------------------------------------------
  // EXIT GATE VERIFICATION WITH REPLAY PROTECTION
  // ----------------------------------------------------

  async verifyExit(verifyExitDto: VerifyExitDto, staffUserId: string) {
    const { qrToken, storeId } = verifyExitDto;
    let decoded: any;

    try {
      decoded = await this.jwtService.verifyAsync(qrToken);
    } catch (err) {
      throw new BadRequestException('Invalid or expired secure QR token signature');
    }

    const { orderId } = decoded;

    const redisKey = `qr:used:${orderId}`;
    let isUsed = false;
    try {
      const val = await this.redisService.get(redisKey);
      if (val === 'true') {
        isUsed = true;
      }
    } catch (err) {
      // Fallback
    }

    if (isUsed) {
      await this.auditLogsService.logEvent(
        'QR_REPLAY_ATTACK_DETECTED',
        `Replay attack detected: QR code for order ${orderId} scanned again at store ${storeId}`,
        staffUserId,
        { orderId, storeId },
      );
      throw new BadRequestException('Replay attack detected: QR code already used');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Associated order not found');
    }

    if (order.status === 'completed_exit') {
      throw new BadRequestException('Exit already completed and verified for this receipt');
    }

    if (order.status !== 'paid') {
      throw new BadRequestException('Order payment has not been successfully captured');
    }

    try {
      await this.redisService.set(redisKey, 'true', 24 * 3600);
    } catch (err) {
      // Silent pass
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'completed_exit' },
    });

    await this.auditLogsService.logEvent(
      'QR_EXIT_VERIFIED_SUCCESS',
      `Exit successfully verified for order ${orderId} at store ${storeId}`,
      staffUserId,
      { orderId, storeId },
    );

    return {
      status: 'success',
      message: 'Exit verified successfully. You may pass.',
      data: {
        orderId: order.id,
        items: order.items,
        totalAmount: order.totalAmount,
      },
    };
  }

  // ----------------------------------------------------
  // ORDER CANCELLATIONS
  // ----------------------------------------------------

  async cancelOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not own this order');
    }

    if (order.status !== 'pending') {
      throw new BadRequestException('Only pending unpaid orders can be cancelled directly');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });

    return {
      status: 'success',
      message: 'Order cancelled successfully',
      data: { order: updated },
    };
  }

  // ----------------------------------------------------
  // PRODUCT RETURNS (WITH AUTOMATIC INVENTORY REPLENISH)
  // ----------------------------------------------------

  async processReturn(orderId: string, staffUserId: string, returnOrderDto: ReturnOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'completed_exit') {
      throw new BadRequestException('Only exit-completed orders can be processed for product return');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'returned' },
    });

    let warehouse = await this.prisma.warehouse.findFirst();
    if (order.storeId) {
      const linkedWarehouse = await this.prisma.warehouse.findFirst({
        where: { name: { contains: order.storeId, mode: 'insensitive' } },
      });
      if (linkedWarehouse) {
        warehouse = linkedWarehouse;
      }
    }

    if (warehouse) {
      const basketItems = order.items as any[];
      for (const item of basketItems) {
        const product = await this.prisma.product.findUnique({
          where: { barcode: item.barcode },
        });

        if (product) {
          const invItem = await this.prisma.inventoryItem.upsert({
            where: {
              productId_warehouseId: {
                productId: product.id,
                warehouseId: warehouse.id,
              },
            },
            update: {
              stock: { increment: item.quantity },
            },
            create: {
              productId: product.id,
              warehouseId: warehouse.id,
              stock: item.quantity,
            },
          });

          await this.prisma.inventoryMovement.create({
            data: {
              inventoryItemId: invItem.id,
              quantity: item.quantity,
              type: 'RECEIPT',
              notes: `Order return replenishment: ${returnOrderDto.reason || 'No remarks'}`,
            },
          });
        }
      }
    }

    await this.auditLogsService.logEvent(
      'ORDER_RETURN_PROCESSED',
      `Order return processed for order ${orderId} by staff ${staffUserId}`,
      staffUserId,
      { orderId, reason: returnOrderDto.reason },
    );

    // Notify refund on order return
    try {
      await this.notificationsService.notifyRefund(
        order.userId,
        orderId,
        order.totalAmount,
        `RET-${orderId.substring(0, 8).toUpperCase()}`,
      );
    } catch (err) {
      // Bypass
    }

    return {
      status: 'success',
      message: 'Product return successfully processed and inventory replenished',
      data: { order: updated },
    };
  }

  // ----------------------------------------------------
  // DIGITAL RECEIPTS
  // ----------------------------------------------------

  async getDigitalReceipt(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: 'success' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAuthorized = order.userId === userId || user?.role === 'admin' || user?.role === 'gate_staff';
    if (!isAuthorized) {
      throw new ForbiddenException('You do not have permission to view this receipt');
    }

    if (order.status !== 'paid' && order.status !== 'completed_exit') {
      throw new BadRequestException('Digital receipts are only generated for successful paid orders');
    }

    let storeName = 'MartPay Store';
    let taxRate = 0.0;
    let currency = 'USD';
    let timezone = 'UTC';

    if (order.storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: order.storeId },
        include: { setting: true },
      });
      if (store) {
        storeName = store.name;
        if (store.setting) {
          taxRate = store.setting.taxRate;
          currency = store.setting.currency;
          timezone = store.setting.timezone;
        }
      }
    }

    const subtotal = order.totalAmount;
    const taxApplied = subtotal * (taxRate / 100);
    const finalTotal = subtotal + taxApplied;

    return {
      status: 'success',
      data: {
        receipt: {
          receiptNumber: `REC-${order.id.substring(0, 8).toUpperCase()}`,
          orderId: order.id,
          storeName,
          timezone,
          createdAt: order.createdAt,
          status: order.status,
          items: order.items,
          billing: {
            subtotal,
            taxRate,
            taxApplied,
            finalTotal,
            currency,
          },
          payments: order.payments.map((p) => ({
            provider: p.provider,
            transactionId: p.transactionId,
            amount: p.amount,
            paidAt: p.updatedAt,
          })),
        },
      },
    };
  }

  // ----------------------------------------------------
  // SECURE PDF INVOICE RETRIEVAL
  // ----------------------------------------------------

  async getInvoicePdf(orderId: string, userId: string): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: 'success' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAuthorized = order.userId === userId || user?.role === 'admin' || user?.role === 'gate_staff';
    if (!isAuthorized) {
      throw new ForbiddenException('You do not have permission to download this invoice');
    }

    if (order.status !== 'paid' && order.status !== 'completed_exit') {
      throw new BadRequestException('Invoices can only be generated for successful paid orders');
    }

    const storageDir = path.join(process.cwd(), 'storage', 'invoices');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filePath = path.join(storageDir, `invoice_${orderId}.pdf`);

    if (fs.existsSync(filePath)) {
      return filePath;
    }

    const store = {
      name: 'MartPay Store',
      address: '123 Main St',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      taxRate: 18.0,
      setting: null,
    } as any;

    if (order.storeId) {
      const storeEntity = await this.prisma.store.findUnique({
        where: { id: order.storeId },
        include: { setting: true },
      });
      if (storeEntity) {
        store.name = storeEntity.name;
        if (storeEntity.setting) {
          store.setting = storeEntity.setting;
          store.taxRate = storeEntity.setting.taxRate;
        }
        const loc = await this.prisma.storeLocation.findFirst({
          where: { storeId: order.storeId },
        });
        if (loc) {
          store.address = loc.address;
          store.city = loc.city;
          store.state = loc.state || '';
          store.postalCode = loc.postalCode;
          store.country = loc.country;
        }
      }
    }

    const primaryPayment = order.payments[0];
    const paymentRef = primaryPayment
      ? `${primaryPayment.provider.toUpperCase()} (${primaryPayment.transactionId})`
      : 'Mock Wallet Capture';

    const pdfBuffer = await this.invoiceGeneratorService.generate(order, store, paymentRef);

    fs.writeFileSync(filePath, pdfBuffer);

    return filePath;
  }

  // ----------------------------------------------------
  // ADMIN STATUS OVERRIDES
  // ----------------------------------------------------

  async updateStatus(orderId: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: updateOrderStatusDto.status },
    });

    return { status: 'success', data: { order: updated } };
  }
}
