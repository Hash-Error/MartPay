import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    throw new NotImplementedException('Product listing features are not yet implemented.');
  }

  async findByBarcode(barcode: string) {
    throw new NotImplementedException('Product scanning barcode resolver is not yet implemented.');
  }
}
