import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      // Database health check
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (err) {
          return { database: { status: 'down', message: err.message } };
        }
      },
      // Redis health check
      async () => {
        try {
          const res = await this.redis.ping();
          return { redis: { status: res === 'PONG' ? 'up' : 'down' } };
        } catch (err) {
          return { redis: { status: 'down', message: err.message } };
        }
      },
    ]);
  }
}
