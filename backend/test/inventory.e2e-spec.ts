import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('InventoryController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let adminToken: string;
  let customerToken: string;

  // In-memory mock database
  const warehousesDb = new Map<string, any>();
  const inventoryDb = new Map<string, any>();
  const movementsDb = new Map<string, any>();
  const productsDb = new Map<string, any>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    $transaction: jest.fn().mockImplementation(async (cb) => {
      return cb(mockPrismaService);
    }),
    warehouse: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.name) {
          const wh = Array.from(warehousesDb.values()).find((w) => w.name === where.name);
          return Promise.resolve(wh || null);
        }
        return Promise.resolve(warehousesDb.get(where.id) || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `wh-${Date.now()}`;
        const wh = { id, ...data };
        warehousesDb.set(id, wh);
        return Promise.resolve(wh);
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(warehousesDb.values()));
      }),
    },
    product: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(productsDb.get(where.id) || null);
      }),
    },
    inventoryItem: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.productId_warehouseId) {
          const item = Array.from(inventoryDb.values()).find(
            (i) => i.productId === where.productId_warehouseId.productId && i.warehouseId === where.productId_warehouseId.warehouseId
          );
          return Promise.resolve(item || null);
        }
        return Promise.resolve(inventoryDb.get(where.id) || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let list = Array.from(inventoryDb.values()).filter((i) => i.warehouseId === where?.warehouseId);
        if (where?.stock?.lte) {
          // Low stock alert query mock
          list = Array.from(inventoryDb.values()).filter((i) => i.stock <= i.lowStockThreshold);
        }
        return Promise.resolve(
          list.map((item) => ({
            ...item,
            product: productsDb.get(item.productId) || { name: 'Mock Product' },
            warehouse: warehousesDb.get(item.warehouseId) || { name: 'Mock WH' },
          })),
        );
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `item-${Date.now()}`;
        const item = { id, createdAt: new Date(), ...data };
        inventoryDb.set(id, item);
        return Promise.resolve(item);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const item = inventoryDb.get(where.id);
        if (!item) return Promise.resolve(null);
        const updated = { ...item, ...data };
        inventoryDb.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      fields: {
        lowStockThreshold: 'lowStockThreshold',
      },
    },
    inventoryMovement: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `move-${Date.now()}`;
        const log = { id, createdAt: new Date(), ...data };
        movementsDb.set(id, log);
        return Promise.resolve(log);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          Array.from(movementsDb.values()).filter((m) => m.inventoryItemId === where.inventoryItemId),
        );
      }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockRedisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    warehousesDb.clear();
    inventoryDb.clear();
    movementsDb.clear();
    productsDb.clear();

    // Seed mock product
    productsDb.set('prod-id-1', { id: 'prod-id-1', name: 'Premium Apple 1kg', barcode: '12345678' });

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

  describe('Warehouse Flow', () => {
    it('should allow admin to create warehouses and list them', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'North Depot',
          address: '77 Depot Rd',
          city: 'Chicago',
          postalCode: '60601',
          country: 'USA',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.data.warehouses).toHaveLength(1);
    });
  });

  describe('Inventory Adjustments Flow', () => {
    let warehouseId: string;

    beforeEach(async () => {
      const whRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'North Depot',
          address: '77 Depot Rd',
          city: 'Chicago',
          postalCode: '60601',
          country: 'USA',
        });
      
      warehouseId = whRes.body.data.warehouse.id;
    });

    it('should initialize stock and apply single and batch movements', async () => {
      // 1. Initialize
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/${warehouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: 'prod-id-1',
          stock: 40,
          lowStockThreshold: 15,
        })
        .expect(201);

      // 2. Perform Single Movement
      const moveRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/${warehouseId}/movement`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: 'prod-id-1',
          quantity: 10,
          type: 'RECEIPT',
        })
        .expect(201);

      expect(moveRes.body.data.inventoryItem.stock).toBe(50); // 40 + 10

      // 3. Batch Update (Atomic transaction)
      const batchRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/${warehouseId}/batch`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          updates: [
            { productId: 'prod-id-1', quantity: -38, type: 'DISPATCH' }, // stock 50 -> 12 (Low Stock!)
          ],
        })
        .expect(200);

      expect(batchRes.body.status).toBe('success');

      // 4. Verify Low Stock Trigger
      const lowStockRes = await request(app.getHttpServer())
        .get('/api/v1/inventory/low-stock')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(lowStockRes.body.data.lowStockItems).toHaveLength(1);
      expect(lowStockRes.body.data.lowStockItems[0].stock).toBe(12);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
