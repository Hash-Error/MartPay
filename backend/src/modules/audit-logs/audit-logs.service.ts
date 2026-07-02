import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });
  }

  async logEvent(eventType: string, message: string, userId?: string, details?: any) {
    this.logger.log(`[AUDIT EVENT] [${eventType}]: ${message} (User: ${userId || 'anonymous'})`);
    return this.prisma.auditLog.create({
      data: {
        eventType,
        message,
        userId: userId || null,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
      },
    });
  }
}
