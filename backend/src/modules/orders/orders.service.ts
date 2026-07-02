import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { VerifyExitDto } from './dto/verify-exit.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    throw new NotImplementedException('Order creation features are not yet implemented.');
  }

  async pay(orderId: string, payOrderDto: PayOrderDto) {
    throw new NotImplementedException('Payment processing features are not yet implemented.');
  }

  async findHistory(userId: string) {
    throw new NotImplementedException('Order history retrieval is not yet implemented.');
  }

  async verifyExit(verifyExitDto: VerifyExitDto) {
    throw new NotImplementedException('Exit gate QR verification is not yet implemented.');
  }
}
