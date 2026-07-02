import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import * as bcrypt from 'bcryptjs';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  
  // In-memory mock database
  const usersDb = new Map<string, any>();
  const sessionsDb = new Map<string, any>();
  const devicesDb = new Map<string, any>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.username) {
          const user = Array.from(usersDb.values()).find((u) => u.username === where.username);
          return Promise.resolve(user || null);
        }
        if (where.id) {
          return Promise.resolve(usersDb.get(where.id) || null);
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `user-${Date.now()}-${Math.random()}`;
        const newUser = { id, createdAt: new Date(), ...data };
        usersDb.set(id, newUser);
        return Promise.resolve(newUser);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const user = usersDb.get(where.id);
        if (!user) return Promise.resolve(null);
        const updatedUser = { ...user, ...data };
        usersDb.set(where.id, updatedUser);
        return Promise.resolve(updatedUser);
      }),
    },
    session: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `session-${Date.now()}-${Math.random()}`;
        const newSession = { id, createdAt: new Date(), isRevoked: false, ...data };
        sessionsDb.set(id, newSession);
        return Promise.resolve(newSession);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const session = sessionsDb.get(where.id);
        if (!session) return Promise.resolve(null);
        const updatedSession = { ...session, ...data };
        sessionsDb.set(where.id, updatedSession);
        return Promise.resolve(updatedSession);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(sessionsDb.get(where.id) || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const list = Array.from(sessionsDb.values()).filter(
          (s) => s.userId === where.userId && !s.isRevoked && s.expiresAt.getTime() > Date.now(),
        );
        return Promise.resolve(list);
      }),
    },
    device: {
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const key = `${where.userId_deviceId.userId}_${where.userId_deviceId.deviceId}`;
        let device = devicesDb.get(key);
        if (device) {
          device = { ...device, ...update, updatedAt: new Date() };
        } else {
          device = { id: `device-${Date.now()}`, ...create, createdAt: new Date(), updatedAt: new Date() };
        }
        devicesDb.set(key, device);
        return Promise.resolve(device);
      }),
    },
    auditLog: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `audit-${Date.now()}`;
        return Promise.resolve({ id, timestamp: new Date(), ...data });
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockRedisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    usersDb.clear();
    sessionsDb.clear();
    devicesDb.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Bind global configurations matching main.ts
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
  });

  describe('/api/v1/auth/register (POST)', () => {
    it('should register a new user successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'johndoe',
          password: 'Password123!',
          role: 'customer',
        })
        .expect(201)
        .then((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.user.username).toBe('johndoe');
          expect(res.body.data.user.passwordHash).toBeUndefined();
        });
    });

    it('should reject duplicate registration', async () => {
      const pass = await bcrypt.hash('Password123!', 10);
      usersDb.set('1', { id: '1', username: 'johndoe', passwordHash: pass, role: 'customer' });

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'johndoe',
          password: 'Password123!',
        })
        .expect(409);
    });

    it('should reject malformed payload (short password)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'johndoe',
          password: '123',
        })
        .expect(400);
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should authenticate user and return tokens', async () => {
      const pass = await bcrypt.hash('Password123!', 10);
      usersDb.set('1', { id: '1', username: 'johndoe', passwordHash: pass, role: 'customer' });

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'johndoe',
          password: 'Password123!',
        })
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
        });
    });

    it('should fail with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'wronguser',
          password: 'WrongPassword123!',
        })
        .expect(401);
    });
  });

  describe('JWT Session Management & Device flow', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const pass = await bcrypt.hash('Password123!', 10);
      usersDb.set('user-1', { id: 'user-1', username: 'johndoe', passwordHash: pass, role: 'customer' });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'johndoe', password: 'Password123!' });

      accessToken = loginRes.body.data.accessToken;
      refreshToken = loginRes.body.data.refreshToken;
    });

    it('should fetch active sessions list for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.sessions).toHaveLength(1);
        });
    });

    it('should register a device metadata details', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register-device')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          deviceId: 'device-id-999',
          deviceName: 'Android Emulator',
          deviceToken: 'token-abc',
        })
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe('success');
        });
    });

    it('should reject session queries for missing credentials', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .expect(401);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
