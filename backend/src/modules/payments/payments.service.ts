import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from './stripe.service';
import { RazorpayService } from './razorpay.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private razorpayService: RazorpayService,
  ) {}

  async createPayment(createPaymentDto: CreatePaymentDto) {
    const { orderId, provider, currency } = createPaymentDto;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'paid' || order.status === 'completed_exit') {
      throw new BadRequestException('Order is already paid');
    }

    // Initialize local payment registry
    const localPayment = await this.prisma.payment.create({
      data: {
        orderId,
        amount: order.totalAmount,
        currency: currency || 'USD',
        provider,
        status: 'pending',
      },
    });

    if (provider === 'stripe') {
      const intent = await this.stripeService.createPaymentIntent(
        order.totalAmount,
        currency || 'usd',
      );

      await this.prisma.payment.update({
        where: { id: localPayment.id },
        data: { transactionId: intent.id },
      });

      return {
        status: 'success',
        data: {
          paymentId: localPayment.id,
          provider: 'stripe',
          transactionId: intent.id,
          clientSecret: intent.clientSecret,
        },
      };
    } else {
      // Razorpay
      const rzpOrder = await this.razorpayService.createOrder(
        order.totalAmount,
        currency || 'INR',
      );

      await this.prisma.payment.update({
        where: { id: localPayment.id },
        data: { transactionId: rzpOrder.id },
      });

      return {
        status: 'success',
        data: {
          paymentId: localPayment.id,
          provider: 'razorpay',
          transactionId: rzpOrder.id,
          amount: rzpOrder.amount,
        },
      };
    }
  }

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto) {
    const { orderId, transactionId, paymentId, signature } = verifyPaymentDto;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const localPayment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        transactionId,
        status: 'pending',
      },
    });
    if (!localPayment) {
      throw new NotFoundException('Pending payment registry not found for this transaction');
    }

    let isValid = false;

    if (localPayment.provider === 'stripe') {
      const result = await this.stripeService.verifyPaymentIntent(transactionId);
      isValid = result.status === 'succeeded';
    } else {
      // Razorpay
      if (!paymentId || !signature) {
        throw new BadRequestException('paymentId and signature are required for Razorpay verification');
      }
      isValid = this.razorpayService.verifySignature(transactionId, paymentId, signature);
    }

    if (!isValid) {
      await this.prisma.payment.update({
        where: { id: localPayment.id },
        data: { status: 'failed' },
      });
      throw new BadRequestException('Payment verification check failed');
    }

    // Success payment updates
    const finalTxId = localPayment.provider === 'razorpay' ? paymentId : transactionId;
    await this.prisma.payment.update({
      where: { id: localPayment.id },
      data: {
        status: 'success',
        transactionId: finalTxId,
      },
    });

    // Generate secure QR token for receipt verification
    const qrToken = `qr_rcpt_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    const qrExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        qrToken,
        qrExpiresAt,
      },
    });

    return {
      status: 'success',
      message: 'Payment verified and order captured successfully',
      data: {
        orderId,
        paymentId: localPayment.id,
        qrToken,
        qrExpiresAt,
      },
    };
  }

  async getHistory(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        order: { userId },
      },
      include: {
        order: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { status: 'success', data: { payments } };
  }

  async refund(refundPaymentDto: RefundPaymentDto) {
    const { paymentId, amount } = refundPaymentDto;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.status !== 'success') {
      throw new BadRequestException('Only successful captured payments can be refunded');
    }

    let refundResult: any;

    if (payment.provider === 'stripe') {
      refundResult = await this.stripeService.createRefund(payment.transactionId!, amount);
    } else {
      refundResult = await this.razorpayService.createRefund(payment.transactionId!, amount);
    }

    if (refundResult.status !== 'succeeded' && refundResult.status !== 'processed') {
      throw new BadRequestException('Gateway refund operation failed');
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'refunded',
        refundId: refundResult.id,
      },
    });

    // Revert order status
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'pending',
        qrToken: null,
        qrExpiresAt: null,
      },
    });

    return {
      status: 'success',
      message: 'Refund successfully completed',
      data: {
        paymentId,
        refundId: refundResult.id,
        amount: refundResult.amount,
      },
    };
  }
}
