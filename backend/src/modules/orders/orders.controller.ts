import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { VerifyExitDto } from './dto/verify-exit.dto';

@ApiTags('Orders & Checkouts')
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pending order from cart items' })
  @ApiResponse({ status: 201, description: 'Order created.' })
  async create(@Body() createOrderDto: CreateOrderDto) {
    // In a real application, the userId would be read from request.user (from JwtAuthGuard)
    const mockUserId = 'mock-user-uuid';
    return this.ordersService.create(mockUserId, createOrderDto);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Verify payment for an order and generate exit QR code' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Payment verified, exit pass issued.' })
  async pay(@Param('id') id: string, @Body() payOrderDto: PayOrderDto) {
    return this.ordersService.pay(id, payOrderDto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Retrieve order history for authenticated user' })
  @ApiResponse({ status: 200, description: 'History retrieved.' })
  async history() {
    const mockUserId = 'mock-user-uuid';
    return this.ordersService.findHistory(mockUserId);
  }

  @Post('verify-exit')
  @ApiOperation({ summary: 'Verify exit pass QR code at gate' })
  @ApiResponse({ status: 200, description: 'Pass verified. Exit granted.' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or duplicate exit pass.' })
  async verifyExit(@Body() verifyExitDto: VerifyExitDto) {
    return this.ordersService.verifyExit(verifyExitDto);
  }
}
