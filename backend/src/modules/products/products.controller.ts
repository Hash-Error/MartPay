import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all product catalog items' })
  @ApiResponse({ status: 200, description: 'Catalog items fetched successfully.' })
  async findAll() {
    return this.productsService.findAll();
  }

  @Get('scan/:barcode')
  @ApiOperation({ summary: 'Fetch product details by barcode' })
  @ApiParam({ name: 'barcode', example: '123456789012', description: 'Product EAN/UPC barcode' })
  @ApiResponse({ status: 200, description: 'Product matched.' })
  @ApiResponse({ status: 404, description: 'Product barcode not found.' })
  async findByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }
}
