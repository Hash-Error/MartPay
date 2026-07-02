import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;

  // In-memory mock database
  const usersDb = new Map<string, any>();
  const addressesDb = new Map<string, any>();
  const paymentsDb = new Map<string, any>();
  const notificationsDb = new Map<string, any>();
  const ordersDb = new Map<string, any>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(usersDb.get(where.id) || null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where.email) {
          const user = Array.from(usersDb.values()).find((u) => u.email === where.email && u.id !== where.id?.not);
          return Promise.resolve(user || null);
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const user = usersDb.get(where.id);
        if (!user) return Promise.resolve(null);
        const updated = { ...user, ...data };
        usersDb.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    address: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        const list = Array.from(addressesDb.values()).filter((a) => a.userId === where.userId);
        return Promise.resolve(list);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(addressesDb.get(where.id) || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `address-${Date.now()}`;
        const addr = { id, createdAt: new Date(), ...data };
        addressesDb.set(id, addr);
        return Promise.resolve(addr);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        Array.from(addressesDb.values())
          .filter((a) => a.userId === where.userId)
          .forEach((a) => {
            addressesDb.set(a.id, { ...a, ...data });
          });
        return Promise.resolve({ count: 1 });
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const addr = addressesDb.get(where.id);
        if (!addr) return Promise.resolve(null);
        const updated = { ...addr, ...data };
        addressesDb.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        addressesDb.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
    },
    paymentMethod: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(Array.from(paymentsDb.values()).filter((p) => p.userId === where.userId));
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(paymentsDb.get(where.id) || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `card-${Date.now()}`;
        const card = { id, createdAt: new Date(), ...data };
        paymentsDb.set(id, card);
        return Promise.resolve(card);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        Array.from(paymentsDb.values())
          .filter((p) => p.userId === where.userId)
          .forEach((p) => {
            paymentsDb.set(p.id, { ...p, ...data });
          });
        return Promise.resolve({ count: 1 });
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        paymentsDb.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
    },
    notificationSetting: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(notificationsDb.get(where.userId) || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        notificationsDb.set(data.userId, data);
        return Promise.resolve(data);
      }),
      upsert: jest.fn().mockImplementation(({ where, update, create }) => {
        let setting = notificationsDb.get(where.userId);
        if (setting) {
          setting = { ...setting, ...update };
        } else {
          setting = { ...create };
        }
        notificationsDb.set(where.userId, setting);
        return Promise.resolve(setting);
      }),
    },
    order: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        const list = Array.from(ordersDb.values()).filter(
          (o) => o.userId === where.userId && ['paid', 'completed_exit'].includes(o.status),
        );
        return Promise.resolve(list);
      }),
    },
    session: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockRedisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    usersDb.clear();
    addressesDb.clear();
    paymentsDb.clear();
    notificationsDb.clear();
    ordersDb.clear();

    // Add mock user
    usersDb.set('user-uuid-1', {
      id: 'user-uuid-1',
      username: 'johndoe',
      email: 'johndoe@example.com',
      fullName: 'John Doe',
      isActive: true,
      role: 'customer',
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

    // Issue valid Access Token
    accessToken = await jwtService.signAsync({
      sub: 'user-uuid-1',
      username: 'johndoe',
      role: 'customer',
      sessionId: 'session-1',
    });
  });

  describe('GET /api/v1/users/profile', () => {
    it('should fetch authenticated user profile', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.user.email).toBe('johndoe@example.com');
        });
    });

    it('should fail if access token is missing', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/users/profile', () => {
    it('should update profile parameters successfully', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          fullName: 'Johnathan Doe',
        })
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.user.fullName).toBe('Johnathan Doe');
        });
    });

    it('should reject invalid email formatting', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'invalid-email',
        })
        .expect(400);
    });
  });

  describe('Address Book Flow', () => {
    it('should create and retrieve user addresses', async () => {
      // 1. Post new address
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Office',
          street: '456 Business Rd',
          city: 'New York',
          postalCode: '10001',
          country: 'USA',
          isDefault: true,
        })
        .expect(201);

      expect(createRes.body.status).toBe('success');
      expect(createRes.body.data.address.title).toBe('Office');

      // 2. Get list of addresses
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getRes.body.data.addresses).toHaveLength(1);
    });
  });

  describe('Mock Card payment tokens flow', () => {
    it('should save and delete payment methods', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/users/payments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cardHolderName: 'John Doe',
          cardNumber: '4111111111111111',
          cardType: 'Visa',
          expirationDate: '12/28',
        })
        .expect(201);

      expect(createRes.body.status).toBe('success');
      expect(createRes.body.data.paymentMethod.cardNumberMasked).toBe('**** **** **** 1111');

      const cardId = createRes.body.data.paymentMethod.id;

      // Delete payment method
      await request(app.getHttpServer())
        .delete(`/api/v1/users/payments/${cardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('GET & PATCH /api/v1/users/notifications', () => {
    it('should fetch and update notification options successfully', async () => {
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/users/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getRes.body.status).toBe('success');
      expect(getRes.body.data.notificationSettings.emailAlerts).toBe(true);

      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/users/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          smsAlerts: true,
        })
        .expect(200);

      expect(patchRes.body.data.notificationSettings.smsAlerts).toBe(true);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
