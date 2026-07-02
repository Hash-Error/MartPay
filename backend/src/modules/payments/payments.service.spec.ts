import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from './stripe.service';
import { RazorpayService } from './razorpay.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let stripeService: StripeService;
  let razorpayService: RazorpayService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockStripeService = {
    createPaymentIntent: jest.fn(),
    verifyPaymentIntent: jest.fn(),
    createRefund: jest.fn(),
  };

  const mockRazorpayService = {
    createOrder: jest.fn(),
    verifySignature: jest.fn(),
    createRefund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: RazorpayService, useValue: mockRazorpayService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    stripeService = module.get<StripeService>(StripeService);
    razorpayService = module.get<RazorpayService>(RazorpayService);

    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should initialize stripe payment successfully', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', totalAmount: 100, status: 'pending' });
      mockPrismaService.payment.create.mockResolvedValue({ id: 'pay-id', status: 'pending' });
      mockStripeService.createPaymentIntent.mockResolvedValue({ id: 'intent-id', clientSecret: 'secret_123' });

      const res = await service.createPayment({
        orderId: 'order-id',
        provider: 'stripe',
      });

      expect(res.status).toBe('success');
      expect(res.data.clientSecret).toBe('secret_123');
      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(100, 'usd');
    });
  });

  describe('verifyPayment', () => {
    it('should verify stripe succeeded captures and issue QR tokens', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', totalAmount: 100, status: 'pending' });
      mockPrismaService.payment.findFirst.mockResolvedValue({ id: 'pay-id', provider: 'stripe', transactionId: 'intent-id' });
      mockStripeService.verifyPaymentIntent.mockResolvedValue({ status: 'succeeded' });

      const res = await service.verifyPayment({
        orderId: 'order-id',
        transactionId: 'intent-id',
      });

      expect(res.status).toBe('success');
      expect(res.data.qrToken).toBeDefined();
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-id' },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });

    it('should fail if signature is invalid for Razorpay', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', totalAmount: 100, status: 'pending' });
      mockPrismaService.payment.findFirst.mockResolvedValue({ id: 'pay-id', provider: 'razorpay', transactionId: 'rzp-order-id' });
      mockRazorpayService.verifySignature.mockReturnValue(false); // bad sign

      await expect(
        service.verifyPayment({
          orderId: 'order-id',
          transactionId: 'rzp-order-id',
          paymentId: 'rzp-pay-id',
          signature: 'bad-sig',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
