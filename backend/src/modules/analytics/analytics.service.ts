import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────

  private startOfDay(d: Date): Date {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return this.startOfDay(d);
  }

  private weeksAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n * 7);
    return this.startOfDay(d);
  }

  private monthsAgo(n: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    d.setDate(1);
    return this.startOfDay(d);
  }

  private dateKey(d: Date): string {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private weekKey(d: Date): string {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  private monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of arr) {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }

  // ─────────────────────────────────────────────────
  // REVENUE SUMMARY
  // ─────────────────────────────────────────────────

  async getRevenueSummary() {
    const allPayments = await this.prisma.payment.findMany({ where: { status: 'success' } });

    const now = new Date();
    const todayStart = this.startOfDay(now);
    const weekStart = this.daysAgo(7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const total = allPayments.reduce((s, p) => s + p.amount, 0);
    const today = allPayments.filter(p => p.createdAt >= todayStart).reduce((s, p) => s + p.amount, 0);
    const thisWeek = allPayments.filter(p => p.createdAt >= weekStart).reduce((s, p) => s + p.amount, 0);
    const thisMonth = allPayments.filter(p => p.createdAt >= monthStart).reduce((s, p) => s + p.amount, 0);
    const avgOrderValue = allPayments.length > 0 ? total / allPayments.length : 0;

    return {
      status: 'success',
      data: {
        total: parseFloat(total.toFixed(2)),
        today: parseFloat(today.toFixed(2)),
        thisWeek: parseFloat(thisWeek.toFixed(2)),
        thisMonth: parseFloat(thisMonth.toFixed(2)),
        avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
        transactionCount: allPayments.length,
      },
    };
  }

  // ─────────────────────────────────────────────────
  // DAILY SALES (last 30 days)
  // ─────────────────────────────────────────────────

  async getDailySales() {
    const since = this.daysAgo(30);
    const payments = await this.prisma.payment.findMany({
      where: { status: 'success', createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = this.groupBy(payments, p => this.dateKey(p.createdAt));

    // Fill all 30 days (even empty ones)
    const series: { date: string; revenue: number; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = this.dateKey(d);
      const bucket = grouped.get(key) || [];
      series.push({
        date: key,
        revenue: parseFloat(bucket.reduce((s, p) => s + p.amount, 0).toFixed(2)),
        count: bucket.length,
      });
    }

    return { status: 'success', data: { series } };
  }

  // ─────────────────────────────────────────────────
  // WEEKLY SALES (last 12 weeks)
  // ─────────────────────────────────────────────────

  async getWeeklySales() {
    const since = this.weeksAgo(12);
    const payments = await this.prisma.payment.findMany({
      where: { status: 'success', createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = this.groupBy(payments, p => this.weekKey(p.createdAt));

    const series = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, bucket]) => ({
        week,
        revenue: parseFloat(bucket.reduce((s, p) => s + p.amount, 0).toFixed(2)),
        count: bucket.length,
      }));

    return { status: 'success', data: { series } };
  }

  // ─────────────────────────────────────────────────
  // MONTHLY SALES (last 12 months)
  // ─────────────────────────────────────────────────

  async getMonthlySales() {
    const since = this.monthsAgo(12);
    const payments = await this.prisma.payment.findMany({
      where: { status: 'success', createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = this.groupBy(payments, p => this.monthKey(p.createdAt));

    // Fill all 12 months
    const series: { month: string; revenue: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = this.monthKey(d);
      const bucket = grouped.get(key) || [];
      series.push({
        month: key,
        revenue: parseFloat(bucket.reduce((s, p) => s + p.amount, 0).toFixed(2)),
        count: bucket.length,
      });
    }

    return { status: 'success', data: { series } };
  }

  // ─────────────────────────────────────────────────
  // TOP PRODUCTS (by revenue, last 30 days)
  // ─────────────────────────────────────────────────

  async getTopProducts(limit = 10) {
    const since = this.daysAgo(30);
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['paid', 'completed_exit'] },
        createdAt: { gte: since },
      },
    });

    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const order of orders) {
      const items = order.items as Array<{ barcode: string; name: string; price: number; quantity: number }>;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const key = item.barcode;
        const prev = productMap.get(key) || { name: item.name, quantity: 0, revenue: 0 };
        productMap.set(key, {
          name: item.name,
          quantity: prev.quantity + item.quantity,
          revenue: parseFloat((prev.revenue + item.price * item.quantity).toFixed(2)),
        });
      }
    }

    const topProducts = Array.from(productMap.entries())
      .map(([barcode, data]) => ({ barcode, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return { status: 'success', data: { topProducts } };
  }

  // ─────────────────────────────────────────────────
  // PEAK HOURS (order count grouped by hour-of-day)
  // ─────────────────────────────────────────────────

  async getPeakHours() {
    const since = this.daysAgo(30);
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['paid', 'completed_exit'] },
        createdAt: { gte: since },
      },
    });

    // Initialise all 24 hours at 0
    const hourMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;

    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours();
      hourMap[hour]++;
    }

    const series = Object.entries(hourMap).map(([hour, count]) => ({
      hour: parseInt(hour),
      label: `${hour.toString().padStart(2, '0')}:00`,
      count,
    }));

    const peakHour = series.reduce((max, h) => (h.count > max.count ? h : max), series[0]);

    return { status: 'success', data: { series, peakHour } };
  }

  // ─────────────────────────────────────────────────
  // CUSTOMER INSIGHTS
  // ─────────────────────────────────────────────────

  async getCustomerInsights() {
    const allCustomers = await this.prisma.user.findMany({
      where: { role: 'customer' },
      orderBy: { createdAt: 'asc' },
    });

    const since30 = this.daysAgo(30);
    const since7 = this.daysAgo(7);

    const newThisMonth = allCustomers.filter(u => u.createdAt >= since30).length;
    const newThisWeek = allCustomers.filter(u => u.createdAt >= since7).length;

    // Returning customers: placed more than 1 paid order
    const orders = await this.prisma.order.findMany({
      where: { status: { in: ['paid', 'completed_exit', 'returned'] } },
      select: { userId: true },
    });

    const orderCounts = new Map<string, number>();
    for (const o of orders) {
      orderCounts.set(o.userId, (orderCounts.get(o.userId) || 0) + 1);
    }
    const returningCustomers = [...orderCounts.values()].filter(count => count > 1).length;

    // Signups per week (last 8 weeks)
    const signupSeries: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = this.weeksAgo(i + 1);
      const weekEnd = this.weeksAgo(i);
      const key = this.weekKey(weekStart);
      const count = allCustomers.filter(u => u.createdAt >= weekStart && u.createdAt < weekEnd).length;
      signupSeries.push({ week: key, count });
    }

    return {
      status: 'success',
      data: {
        total: allCustomers.length,
        newThisMonth,
        newThisWeek,
        returningCustomers,
        signupSeries,
      },
    };
  }

  // ─────────────────────────────────────────────────
  // GROWTH CHARTS (MoM revenue % change)
  // ─────────────────────────────────────────────────

  async getGrowthCharts() {
    const since = this.monthsAgo(13);
    const payments = await this.prisma.payment.findMany({
      where: { status: 'success', createdAt: { gte: since } },
    });

    // Group by month
    const grouped = this.groupBy(payments, p => this.monthKey(p.createdAt));

    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = this.monthKey(d);
      const bucket = grouped.get(key) || [];
      monthlyRevenue.push({ month: key, revenue: parseFloat(bucket.reduce((s, p) => s + p.amount, 0).toFixed(2)) });
    }

    // Calculate month-over-month growth %
    const growth = monthlyRevenue.slice(1).map((curr, idx) => {
      const prev = monthlyRevenue[idx].revenue;
      const growthPct = prev === 0 ? null : parseFloat((((curr.revenue - prev) / prev) * 100).toFixed(1));
      return { month: curr.month, revenue: curr.revenue, growthPct };
    });

    // Compute best and worst months
    const sorted = [...growth].filter(g => g.growthPct !== null).sort((a, b) => (b.growthPct as number) - (a.growthPct as number));
    const bestMonth = sorted[0] || null;
    const worstMonth = sorted[sorted.length - 1] || null;

    return {
      status: 'success',
      data: { growth, bestMonth, worstMonth },
    };
  }
}
