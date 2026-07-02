import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Product & Inventory Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all products in the database' })
  @ApiResponse({ status: 200, description: 'Products array returned.' })
  async findAll() {
    return this.productsService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products by name, description, or barcode' })
  @ApiQuery({ name: 'q', description: 'Search term query keyword', required: true })
  @ApiResponse({ status: 200, description: 'Products array matching search query returned.' })
  async search(@Query('q') query: string) {
    return this.productsService.search(query || '');
  }

  @Get('scan/:barcode')
  @ApiOperation({ summary: 'Optimized barcode scanner lookup (Redis-backed)' })
  @ApiParam({ name: 'barcode', description: 'Product barcode UPC/EAN' })
  @ApiResponse({ status: 200, description: 'Product metadata details resolved.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async findByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Add a new product to inventory (Admin only)' })
  @ApiResponse({ status: 201, description: 'Product added successfully.' })
  @ApiResponse({ status: 409, description: 'Barcode already registered.' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update catalog parameters of a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully.' })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete product catalog profile (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted.' })
  async delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Retrieve category list' })
  @ApiResponse({ status: 200, description: 'Categories list returned.' })
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Post('categories')
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new catalog category (Admin only)' })
  @ApiResponse({ status: 201, description: 'Category created successfully.' })
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.productsService.createCategory(createCategoryDto);
  }

  @Post(':id/offers')
  @Roles('admin')
  @ApiOperation({ summary: 'Bind a discount offer promotion to a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 201, description: 'Offer created.' })
  async createOffer(
    @Param('id') productId: string,
    @Body() createOfferDto: CreateOfferDto,
  ) {
    return this.productsService.createOffer(productId, createOfferDto);
  }

  @Get(':id/offers')
  @ApiOperation({ summary: 'Retrieve active discount offers for a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Offers list returned.' })
  async getOffers(@Param('id') productId: string) {
    return this.productsService.getOffers(productId);
  }
}
