import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService } from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = {
    check: jest.fn().mockImplementation((indicators) => {
      // Simulate resolving indicators
      const results = indicators.map((ind) => ind());
      return Promise.all(results).then(() => ({
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      }));
    }),
  };

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  };

  const mockRedisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', async () => {
    const res = await controller.check();
    expect(res.status).toBe('ok');
    expect(res.info.database.status).toBe('up');
    expect(res.info.redis.status).toBe('up');
  });
});
