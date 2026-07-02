import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let adminToken: string;
  let customerToken: string;

  // In-memory mock database
  const categoriesDb = new Map<string, any>();
  const productsDb = new Map<string, any>();
  const offersDb = new Map<string, any>();
  const redisCacheDb = new Map<string, string>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    category: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.name) {
          const cat = Array.from(categoriesDb.values()).find((c) => c.name === where.name);
          return Promise.resolve(cat || null);
        }
        return Promise.resolve(categoriesDb.get(where.id) || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `cat-${Date.now()}`;
        const cat = { id, ...data };
        categoriesDb.set(id, cat);
        return Promise.resolve(cat);
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(categoriesDb.values()));
      }),
    },
    product: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.barcode) {
          const prod = Array.from(productsDb.values()).find((p) => p.barcode === where.barcode);
          if (prod) {
            return Promise.resolve({
              ...prod,
              category: categoriesDb.get(prod.categoryId) || {},
              offers: Array.from(offersDb.values()).filter((o) => o.productId === prod.id),
            });
          }
          return Promise.resolve(null);
        }
        return Promise.resolve(productsDb.get(where.id) || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `prod-${Date.now()}`;
        const prod = { id, createdAt: new Date(), ...data };
        productsDb.set(id, prod);
        return Promise.resolve({
          ...prod,
          category: categoriesDb.get(prod.categoryId) || {},
          offers: [],
        });
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let list = Array.from(productsDb.values());
        if (where?.OR) {
          const query = where.OR[0].name.contains.toLowerCase();
          list = list.filter(
            (p) =>
              p.name.toLowerCase().includes(query) ||
              (p.description && p.description.toLowerCase().includes(query)) ||
              p.barcode.includes(query),
          );
        }
        return Promise.resolve(
          list.map((prod) => ({
            ...prod,
            category: categoriesDb.get(prod.categoryId) || {},
            offers: Array.from(offersDb.values()).filter((o) => o.productId === prod.id),
          })),
        );
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const prod = productsDb.get(where.id);
        if (!prod) return Promise.resolve(null);
        const updated = { ...prod, ...data };
        productsDb.set(where.id, updated);
        return Promise.resolve({
          ...updated,
          category: categoriesDb.get(updated.categoryId) || {},
          offers: Array.from(offersDb.values()).filter((o) => o.productId === updated.id),
        });
      }),
    },
    offer: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `off-${Date.now()}`;
        const offer = { id, createdAt: new Date(), ...data };
        offersDb.set(id, offer);
        return Promise.resolve(offer);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(Array.from(offersDb.values()).filter((o) => o.productId === where.productId));
      }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockRedisService = {
    get: jest.fn().mockImplementation((key) => {
      return Promise.resolve(redisCacheDb.get(key) || null);
    }),
    set: jest.fn().mockImplementation((key, val) => {
      redisCacheDb.set(key, val);
      return Promise.resolve();
    }),
    del: jest.fn().mockImplementation((key) => {
      redisCacheDb.delete(key);
      return Promise.resolve();
    }),
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    categoriesDb.clear();
    productsDb.clear();
    offersDb.clear();
    redisCacheDb.clear();

    // Setup Category
    categoriesDb.set('cat-id-1', { id: 'cat-id-1', name: 'Snacks', description: 'Chips and crackers' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);

    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    // Security tokens
    adminToken = await jwtService.signAsync({ sub: 'admin-1', username: 'adminuser', role: 'admin', sessionId: 'sess-1' });
    customerToken = await jwtService.signAsync({ sub: 'cust-1', username: 'custuser', role: 'customer', sessionId: 'sess-2' });
  });

  describe('Category Flow', () => {
    it('should create and retrieve categories', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bakery',
          description: 'Bread and cakes',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/products/categories')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.data.categories).toHaveLength(2); // Snacks + Bakery
    });
  });

  describe('Product CRUD and Scanner Cache flow', () => {
    it('should create product, read from cache, and reject customer updates', async () => {
      // 1. Create product (Admin only)
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          barcode: '4005808815821',
          name: 'Nivea Soft Cream 200ml',
          price: 4.99,
          stock: 80,
          categoryId: 'cat-id-1',
        })
        .expect(201);

      const productId = createRes.body.data.product.id;
      expect(redisCacheDb.has('product:barcode:4005808815821')).toBe(true);

      // 2. Scan barcode (Redis cache hit)
      const scanRes = await request(app.getHttpServer())
        .get('/api/v1/products/scan/4005808815821')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(scanRes.body.source).toBe('cache');
      expect(scanRes.body.data.product.name).toBe('Nivea Soft Cream 200ml');

      // 3. Customer tries to modify (should get 403 Forbidden)
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          price: 1.99,
        })
        .expect(403);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
