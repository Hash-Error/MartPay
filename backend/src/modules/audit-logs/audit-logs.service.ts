import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    throw new NotImplementedException('Admin audit logs retrieval is not yet implemented.');
  }

  async logEvent(eventType: string, message: string, userId?: string, details?: any) {
    throw new NotImplementedException('Audit logging features are not yet implemented.');
  }
}
