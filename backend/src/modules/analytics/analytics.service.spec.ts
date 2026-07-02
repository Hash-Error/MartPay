import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../database/prisma.service';

const now = new Date();
const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
const lastMonth = new Date(now); lastMonth.setMonth(now.getMonth() - 1);

const mockPayments = [
  { id: 'p1', amount: 100, status: 'success', createdAt: now },
  { id: 'p2', amount: 200, status: 'success', createdAt: yesterday },
  { id: 'p3', amount: 50,  status: 'success', createdAt: lastMonth },
  { id: 'p4', amount: 999, status: 'failed',  createdAt: now },       // should be excluded
];

const mockOrders = [
  {
    id: 'o1',
    userId: 'u1',
    status: 'paid',
    createdAt: now,
    items: [
      { barcode: 'BC001', name: 'Rice', price: 5, quantity: 10 },
      { barcode: 'BC002', name: 'Milk', price: 2, quantity: 3 },
    ],
    totalAmount: 56,
  },
  {
    id: 'o2',
    userId: 'u2',
    status: 'completed_exit',
    createdAt: yesterday,
    items: [{ barcode: 'BC001', name: 'Rice', price: 5, quantity: 4 }],
    totalAmount: 20,
  },
];

const mockUsers = [
  { id: 'u1', role: 'customer', createdAt: now },
  { id: 'u2', role: 'customer', createdAt: yesterday },
  { id: 'u3', role: 'admin',    createdAt: now },       // excluded from count
];

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrisma = {
    payment: { findMany: jest.fn() },
    order:   { findMany: jest.fn() },
    user:    { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  // ── Revenue Summary ──────────────────────────────

  describe('getRevenueSummary', () => {
    it('should sum only successful payments', async () => {
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments.filter(p => p.status === 'success'));
      const res = await service.getRevenueSummary();
      expect(res.status).toBe('success');
      expect(res.data.total).toBe(350);
      expect(res.data.transactionCount).toBe(3);
    });

    it('should return zero avg when no payments', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      const res = await service.getRevenueSummary();
      expect(res.data.avgOrderValue).toBe(0);
    });
  });

  // ── Daily Sales ──────────────────────────────────

  describe('getDailySales', () => {
    it('should return 30 data points', async () => {
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments.filter(p => p.status === 'success'));
      const res = await service.getDailySales();
      expect(res.status).toBe('success');
      expect(res.data.series.length).toBe(30);
    });

    it('should bucket today payment correctly', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([{ id: 'p1', amount: 100, status: 'success', createdAt: now }]);
      const res = await service.getDailySales();
      const todayKey = now.toISOString().slice(0, 10);
      const todaySlot = res.data.series.find((s: any) => s.date === todayKey);
      expect(todaySlot?.revenue).toBe(100);
      expect(todaySlot?.count).toBe(1);
    });
  });

  // ── Weekly Sales ─────────────────────────────────

  describe('getWeeklySales', () => {
    it('should return non-empty week series for recent payments', async () => {
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments.filter(p => p.status === 'success'));
      const res = await service.getWeeklySales();
      expect(res.status).toBe('success');
      expect(res.data.series.length).toBeGreaterThan(0);
    });
  });

  // ── Monthly Sales ────────────────────────────────

  describe('getMonthlySales', () => {
    it('should return exactly 12 monthly buckets', async () => {
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments.filter(p => p.status === 'success'));
      const res = await service.getMonthlySales();
      expect(res.data.series.length).toBe(12);
    });
  });

  // ── Top Products ─────────────────────────────────

  describe('getTopProducts', () => {
    it('should rank Rice above Milk by revenue', async () => {
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      const res = await service.getTopProducts(10);
      expect(res.status).toBe('success');
      expect(res.data.topProducts[0].barcode).toBe('BC001');  // Rice: 70 revenue
      expect(res.data.topProducts[0].quantity).toBe(14);      // 10 + 4
    });

    it('should respect the limit param', async () => {
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      const res = await service.getTopProducts(1);
      expect(res.data.topProducts.length).toBe(1);
    });
  });

  // ── Peak Hours ───────────────────────────────────

  describe('getPeakHours', () => {
    it('should always return 24 hour slots', async () => {
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      const res = await service.getPeakHours();
      expect(res.data.series.length).toBe(24);
    });

    it('should identify the correct peak hour', async () => {
      const orderAtNoon = { ...mockOrders[0], createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12) };
      mockPrisma.order.findMany.mockResolvedValue([orderAtNoon]);
      const res = await service.getPeakHours();
      expect(res.data.peakHour.hour).toBe(12);
    });
  });

  // ── Customer Insights ────────────────────────────

  describe('getCustomerInsights', () => {
    it('should count only customers (not admins)', async () => {
      mockPrisma.user.findMany.mockResolvedValue(mockUsers.filter(u => u.role === 'customer'));
      mockPrisma.order.findMany.mockResolvedValue([]);
      const res = await service.getCustomerInsights();
      expect(res.data.total).toBe(2);
    });

    it('should detect returning customers (>1 order)', async () => {
      mockPrisma.user.findMany.mockResolvedValue(mockUsers.filter(u => u.role === 'customer'));
      mockPrisma.order.findMany.mockResolvedValue([
        { userId: 'u1' }, { userId: 'u1' }, { userId: 'u2' },  // u1 is returning
      ]);
      const res = await service.getCustomerInsights();
      expect(res.data.returningCustomers).toBe(1);
    });
  });

  // ── Growth Charts ────────────────────────────────

  describe('getGrowthCharts', () => {
    it('should return 12 growth data points', async () => {
      mockPrisma.payment.findMany.mockResolvedValue(mockPayments.filter(p => p.status === 'success'));
      const res = await service.getGrowthCharts();
      expect(res.status).toBe('success');
      expect(res.data.growth.length).toBe(12);
    });

    it('should flag null growth when previous month had no revenue', async () => {
      // All payments in current month only
      mockPrisma.payment.findMany.mockResolvedValue([
        { id: 'p1', amount: 100, status: 'success', createdAt: now },
      ]);
      const res = await service.getGrowthCharts();
      // At least one growthPct should be null (months with 0 prev revenue)
      const hasNull = res.data.growth.some((g: any) => g.growthPct === null);
      expect(hasNull).toBe(true);
    });
  });
});
