import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('sendNotification (Preferences Filters)', () => {
    it('should send email and push by default, bypassing SMS', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        phoneNumber: '+123456789',
        notificationSetting: null, // defaults: email=true, push=true, sms=false
      });

      const res = await service.sendNotification('user-1', 'security_alert', 'Alert!');
      expect(res.status).toBe('success');
      expect(res.sent.email).toBe(true);
      expect(res.sent.push).toBe(true);
      expect(res.sent.sms).toBe(false);
    });

    it('should respect custom settings, enabling SMS and bypassing email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        phoneNumber: '+123456789',
        notificationSetting: {
          emailAlerts: false,
          pushAlerts: true,
          smsAlerts: true,
        },
      });

      const res = await service.sendNotification('user-1', 'order_created', 'Order Created!');
      expect(res.status).toBe('success');
      expect(res.sent.email).toBe(false);
      expect(res.sent.push).toBe(true);
      expect(res.sent.sms).toBe(true);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.sendNotification('user-2', 'refund', 'Refund')).rejects.toThrow(NotFoundException);
    });
  });
});
