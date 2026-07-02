import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getDashboardStats() {
    // 1. Sales metrics
    const payments = await this.prisma.payment.findMany({
      where: { status: 'success' },
    });
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const successfulSalesCount = payments.length;

    // 2. Counts
    const productsCount = await this.prisma.product.count();
    const storesCount = await this.prisma.store.count();
    const customersCount = await this.prisma.user.count({
      where: { role: 'customer' },
    });
    const employeesCount = await this.prisma.storeEmployee.count();

    // 3. Low Stock Alerts
    const allInventoryItems = await this.prisma.inventoryItem.findMany();
    const lowStockItems = allInventoryItems.filter(item => item.stock <= item.lowStockThreshold);

    return {
      status: 'success',
      data: {
        sales: {
          revenue: totalRevenue,
          count: successfulSalesCount,
        },
        inventory: {
          lowStockAlerts: lowStockItems.length,
        },
        storesCount,
        productsCount,
        customersCount,
        employeesCount,
      },
    };
  }

  async getSalesAnalytics() {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'success' },
      orderBy: { createdAt: 'asc' },
    });

    // Group sales by day of week / simple dates
    const dailyMap = new Map<string, number>();

    payments.forEach((p) => {
      const dateKey = p.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + p.amount);
    });

    const series = Array.from(dailyMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));

    return {
      status: 'success',
      data: {
        series: series.slice(-7), // return last 7 entries
      },
    };
  }

  async getAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({
      take: 20,
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { username: true, role: true } } },
    });

    return {
      status: 'success',
      data: { logs },
    };
  }

  async getSettings() {
    let settings = {
      globalTaxRate: 18.0,
      defaultCurrency: 'USD',
      mockPaymentGateways: true,
    };

    try {
      const val = await this.redisService.get('system:settings');
      if (val) {
        settings = JSON.parse(val);
      }
    } catch (err) {
      // Fallback
    }

    return {
      status: 'success',
      data: { settings },
    };
  }

  async updateSettings(dto: UpdateSystemSettingsDto) {
    const current = (await this.getSettings()).data.settings;
    const updated = {
      ...current,
      ...dto,
    };

    try {
      await this.redisService.set('system:settings', JSON.stringify(updated));
    } catch (err) {
      // Bypass
    }

    return {
      status: 'success',
      message: 'System settings successfully updated',
      data: { settings: updated },
    };
  }
}
