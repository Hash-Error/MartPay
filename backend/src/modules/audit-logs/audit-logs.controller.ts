import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';

@ApiTags('Admin Operations')
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve system audit logs (Admin only)' })
  @ApiResponse({ status: 200, description: 'Audit logs fetched successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden resource.' })
  async findAll() {
    return this.auditLogsService.findAll();
  }
}
