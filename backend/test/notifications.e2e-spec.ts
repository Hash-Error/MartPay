import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let adminToken: string;
  let customerToken: string;

  const usersDb = new Map<string, any>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const u = usersDb.get(where.id);
        if (!u) {
          const role = where.id === 'admin-1' ? 'admin' : 'customer';
          return Promise.resolve({ id: where.id, email: 'user@example.com', role, notificationSetting: null });
        }
        return Promise.resolve(u);
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
    usersDb.clear();

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

    adminToken = await jwtService.signAsync({ sub: 'admin-1', username: 'adminuser', role: 'admin', sessionId: 'sess-1' });
    customerToken = await jwtService.signAsync({ sub: 'cust-1', username: 'custuser', role: 'customer', sessionId: 'sess-2' });
  });

  describe('Notifications Manual Dispatch Engine', () => {
    it('should trigger alert to customer from admin accounts', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'cust-1',
          eventType: 'security_alert',
          message: 'Unauthorized login attempt detected.',
        })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.sent.email).toBe(true);
    });

    it('should reject manual triggers from customer accounts', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications/trigger')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          userId: 'cust-1',
          eventType: 'security_alert',
          message: 'Unauthorized login attempt detected.',
        })
        .expect(403);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
