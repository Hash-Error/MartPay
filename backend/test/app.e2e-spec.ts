import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import { RedisService } from './../src/cache/redis.service';

describe('MartPay Health Check (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  };

  const mockRedisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .then((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.info).toBeDefined();
        expect(res.body.info.database.status).toBe('up');
        expect(res.body.info.redis.status).toBe('up');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
