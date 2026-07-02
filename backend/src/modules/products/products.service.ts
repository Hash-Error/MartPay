import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOfferDto } from './dto/create-offer.dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  // ----------------------------------------------------
  // CATEGORIES
  // ----------------------------------------------------

  async createCategory(createCategoryDto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { name: createCategoryDto.name },
    });
    if (existing) {
      throw new ConflictException('Category name already exists');
    }

    const category = await this.prisma.category.create({
      data: createCategoryDto,
    });

    return { status: 'success', data: { category } };
  }

  async getCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return { status: 'success', data: { categories } };
  }

  // ----------------------------------------------------
  // PRODUCTS CRUD
  // ----------------------------------------------------

  async create(createProductDto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { barcode: createProductDto.barcode },
    });
    if (existing) {
      throw new ConflictException('Product barcode already registered');
    }

    // Verify category exists
    const category = await this.prisma.category.findUnique({
      where: { id: createProductDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const product = await this.prisma.product.create({
      data: createProductDto,
      include: {
        category: true,
        offers: true,
      },
    });

    // Write-through to Redis cache (expires in 1 hour)
    const cacheKey = `product:barcode:${product.barcode}`;
    await this.redisService.set(cacheKey, JSON.stringify(product), 3600);

    return { status: 'success', data: { product } };
  }

  async findAll() {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        offers: true,
      },
      orderBy: { name: 'asc' },
    });
    return { status: 'success', data: { products } };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (updateProductDto.barcode && updateProductDto.barcode !== product.barcode) {
      const barcodeTaken = await this.prisma.product.findUnique({
        where: { barcode: updateProductDto.barcode },
      });
      if (barcodeTaken) {
        throw new ConflictException('New barcode is already registered to another product');
      }
    }

    if (updateProductDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateProductDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
      include: {
        category: true,
        offers: true,
      },
    });

    // Invalidate old cache and set new one
    await this.redisService.del(`product:barcode:${product.barcode}`);
    await this.redisService.set(`product:barcode:${updated.barcode}`, JSON.stringify(updated), 3600);

    return { status: 'success', data: { product: updated } };
  }

  async delete(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.delete({ where: { id } });

    // Invalidate Redis cache
    await this.redisService.del(`product:barcode:${product.barcode}`);

    return { status: 'success', message: 'Product deleted successfully' };
  }

  // ----------------------------------------------------
  // OPTIMIZED BARCODE LOOKUP (REDIS-BACKED)
  // ----------------------------------------------------

  async findByBarcode(barcode: string) {
    const cacheKey = `product:barcode:${barcode}`;
    
    // 1. Try reading from cache
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        const product = JSON.parse(cached);
        return { status: 'success', source: 'cache', data: { product } };
      }
    } catch (err) {
      // Fail silently and fallback to DB query if Redis connection encounters issues
    }

    // 2. Fallback to DB
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: {
        category: true,
        offers: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with barcode ${barcode} not found`);
    }

    // 3. Write back to Redis
    try {
      await this.redisService.set(cacheKey, JSON.stringify(product), 3600);
    } catch (err) {
      // Fail silently
    }

    return { status: 'success', source: 'db', data: { product } };
  }

  // ----------------------------------------------------
  // FULL-TEXT SEARCH
  // ----------------------------------------------------

  async search(query: string) {
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        category: true,
        offers: true,
      },
      orderBy: { name: 'asc' },
    });

    return { status: 'success', data: { products } };
  }

  // ----------------------------------------------------
  // OFFERS MANAGEMENT
  // ----------------------------------------------------

  async createOffer(productId: string, createOfferDto: CreateOfferDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const offer = await this.prisma.offer.create({
      data: {
        productId,
        title: createOfferDto.title,
        description: createOfferDto.description,
        discountPercentage: createOfferDto.discountPercentage,
        startDate: new Date(createOfferDto.startDate),
        endDate: new Date(createOfferDto.endDate),
      },
    });

    // Invalidate product cache to update the offers array
    const updatedProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        offers: true,
      },
    });
    if (updatedProduct) {
      await this.redisService.set(
        `product:barcode:${updatedProduct.barcode}`,
        JSON.stringify(updatedProduct),
        3600,
      );
    }

    return { status: 'success', data: { offer } };
  }

  async getOffers(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const offers = await this.prisma.offer.findMany({
      where: { productId },
      orderBy: { endDate: 'asc' },
    });

    return { status: 'success', data: { offers } };
  }
}
