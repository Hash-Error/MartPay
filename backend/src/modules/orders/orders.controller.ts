import { Controller, Get, Post, Patch, Body, Param, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { VerifyExitDto } from './dto/verify-exit.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Orders & Exit Gates Verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order checkout basket' })
  @ApiResponse({ status: 201, description: 'Order created.' })
  async create(@CurrentUser('sub') userId: string, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(userId, createOrderDto);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Pay for an order (Mock)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async pay(@Param('id') orderId: string, @Body() payOrderDto: PayOrderDto) {
    return this.ordersService.pay(orderId, payOrderDto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Retrieve order history for customer' })
  async findHistory(@CurrentUser('sub') userId: string) {
    return this.ordersService.findHistory(userId);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Generate secure cryptographically-signed QR code (Customer only)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'QR details returned.' })
  async generateQrCode(@Param('id') orderId: string) {
    return this.ordersService.generateQrCode(orderId);
  }

  @Post('verify-exit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('admin', 'gate_staff')
  @ApiOperation({ summary: 'Verify exit gate QR code (Admin/Gate Staff only)' })
  @ApiResponse({ status: 200, description: 'Exit verified, receipt manifest returned.' })
  @ApiResponse({ status: 400, description: 'Replay attack or invalid signature.' })
  async verifyExit(
    @Body() verifyExitDto: VerifyExitDto,
    @CurrentUser('sub') staffUserId: string,
  ) {
    return this.ordersService.verifyExit(verifyExitDto, staffUserId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel unpaid order (Customer only)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order successfully cancelled.' })
  async cancelOrder(
    @Param('id') orderId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.ordersService.cancelOrder(orderId, userId);
  }

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('admin', 'gate_staff')
  @ApiOperation({ summary: 'Process product return and stock replenishment (Admin/Gate Staff only)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Return processed and inventory updated.' })
  async processReturn(
    @Param('id') orderId: string,
    @CurrentUser('sub') staffUserId: string,
    @Body() returnOrderDto: ReturnOrderDto,
  ) {
    return this.ordersService.processReturn(orderId, staffUserId, returnOrderDto);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Retrieve itemized digital receipt (Customer/Staff)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Digital receipt returned.' })
  async getDigitalReceipt(
    @Param('id') orderId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.ordersService.getDigitalReceipt(orderId, userId);
  }

  @Get(':id/invoice')
  @ApiOperation({ summary: 'Download secure itemized PDF invoice (Customer/Staff only)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Returns PDF file stream.' })
  async getInvoicePdf(
    @Param('id') orderId: string,
    @CurrentUser('sub') userId: string,
    @Res() res: any,
  ) {
    const filePath = await this.ordersService.getInvoicePdf(orderId, userId);
    return res.sendFile(filePath);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Force override order status parameter (Admin only)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order status updated.' })
  async updateStatus(
    @Param('id') orderId: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(orderId, updateOrderStatusDto);
  }
}
