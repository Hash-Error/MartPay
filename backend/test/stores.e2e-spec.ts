import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('StoresController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  
  let adminToken: string;
  let cashierToken: string;

  // In-memory mock database
  const storesDb = new Map<string, any>();
  const settingsDb = new Map<string, any>();
  const locationsDb = new Map<string, any>();
  const employeesDb = new Map<string, any>();
  const rolesDb = new Map<string, any>();
  const usersDb = new Map<string, any>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(usersDb.get(where.id) || null);
      }),
    },
    store: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `store-${Date.now()}`;
        const store = { id, isActive: true, name: data.name, phoneNumber: data.phoneNumber, createdAt: new Date() };
        storesDb.set(id, store);
        if (data.setting?.create) {
          settingsDb.set(id, { id: `setting-${id}`, storeId: id, ...data.setting.create });
        }
        return Promise.resolve(store);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const store = storesDb.get(where.id);
        if (store) {
          return Promise.resolve({
            ...store,
            setting: settingsDb.get(where.id) || null,
            locations: Array.from(locationsDb.values()).filter((l) => l.storeId === where.id),
          });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const store = storesDb.get(where.id);
        if (!store) return Promise.resolve(null);
        const updated = { ...store, ...data };
        storesDb.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    storeSetting: {
      upsert: jest.fn().mockImplementation(({ where, update, create }) => {
        let setting = settingsDb.get(where.storeId);
        if (setting) {
          setting = { ...setting, ...update };
        } else {
          setting = { id: `setting-${where.storeId}`, ...create };
        }
        settingsDb.set(where.storeId, setting);
        return Promise.resolve(setting);
      }),
    },
    storeLocation: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(Array.from(locationsDb.values()).filter((l) => l.storeId === where.storeId));
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `loc-${Date.now()}`;
        const loc = { id, createdAt: new Date(), ...data };
        locationsDb.set(id, loc);
        return Promise.resolve(loc);
      }),
    },
    storeEmployee: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          Array.from(employeesDb.values())
            .filter((e) => e.storeId === where.storeId)
            .map((e) => ({
              ...e,
              user: usersDb.get(e.userId) || {},
              role: rolesDb.get(e.roleId) || {},
            })),
        );
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(employeesDb.get(where.id) || null);
        if (where.storeId_userId) {
          const key = `${where.storeId_userId.storeId}_${where.storeId_userId.userId}`;
          const emp = employeesDb.get(key);
          if (emp) {
            return Promise.resolve({
              ...emp,
              role: rolesDb.get(emp.roleId) || { permissions: [] },
            });
          }
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      }),
      upsert: jest.fn().mockImplementation(({ where, update, create }) => {
        const key = `${where.storeId_userId.storeId}_${where.storeId_userId.userId}`;
        let emp = employeesDb.get(key);
        if (emp) {
          emp = { ...emp, ...update, updatedAt: new Date() };
        } else {
          emp = { id: `emp-${Date.now()}`, ...create, createdAt: new Date(), updatedAt: new Date() };
        }
        employeesDb.set(key, emp);
        employeesDb.set(emp.id, emp);
        return Promise.resolve({
          ...emp,
          role: rolesDb.get(emp.roleId) || { permissions: [] },
        });
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        const emp = employeesDb.get(where.id);
        if (emp) {
          const key = `${emp.storeId}_${emp.userId}`;
          employeesDb.delete(key);
          employeesDb.delete(where.id);
        }
        return Promise.resolve({ id: where.id });
      }),
    },
    storeRole: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.name) {
          const role = Array.from(rolesDb.values()).find((r) => r.name === where.name);
          return Promise.resolve(role || null);
        }
        return Promise.resolve(rolesDb.get(where.id) || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `role-${Date.now()}`;
        const role = { id, ...data };
        rolesDb.set(id, role);
        return Promise.resolve(role);
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(rolesDb.values()));
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
    storesDb.clear();
    settingsDb.clear();
    locationsDb.clear();
    employeesDb.clear();
    rolesDb.clear();
    usersDb.clear();

    // Configure users
    usersDb.set('admin-id', { id: 'admin-id', username: 'adminuser', role: 'admin', isActive: true });
    usersDb.set('cashier-id', { id: 'cashier-id', username: 'cashieruser', role: 'customer', isActive: true });

    // Seed mock roles
    rolesDb.set('role-cashier-id', {
      id: 'role-cashier-id',
      name: 'STORE_CASHIER',
      permissions: ['read:catalog', 'write:orders'],
    });

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

    // Tokens
    adminToken = await jwtService.signAsync({ sub: 'admin-id', username: 'adminuser', role: 'admin', sessionId: 'sess-1' });
    cashierToken = await jwtService.signAsync({ sub: 'cashier-id', username: 'cashieruser', role: 'customer', sessionId: 'sess-2' });
  });

  describe('POST /api/v1/stores (Create Store)', () => {
    it('should allow global admin to create store', () => {
      return request(app.getHttpServer())
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'MartPay Market 1',
          phoneNumber: '+111222333',
        })
        .expect(201)
        .then((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.store.name).toBe('MartPay Market 1');
        });
    });

    it('should reject store creation for non-admin accounts', () => {
      return request(app.getHttpServer())
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          name: 'Unauthorized Market',
        })
        .expect(403);
    });
  });

  describe('Stores locations and permissions checks', () => {
    let storeId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Central Branch' });

      storeId = createRes.body.data.store.id;
      
      // Assign cashier-id as STORE_CASHIER on Central Branch
      const key = `${storeId}_cashier-id`;
      employeesDb.set(key, { id: 'emp-1', storeId, userId: 'cashier-id', roleId: 'role-cashier-id' });
    });

    it('should fetch store details by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.store.name).toBe('Central Branch');
        });
    });

    it('should allow admin to add location and reject cashier', async () => {
      // 1. Admin post location
      await request(app.getHttpServer())
        .post(`/api/v1/stores/${storeId}/locations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          address: '456 Market St',
          city: 'Chicago',
          postalCode: '60601',
          country: 'USA',
        })
        .expect(201);

      // 2. Cashier post location (forbidden)
      await request(app.getHttpServer())
        .post(`/api/v1/stores/${storeId}/locations`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          address: '789 Denied St',
          city: 'Chicago',
          postalCode: '60601',
          country: 'USA',
        })
        .expect(403);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
