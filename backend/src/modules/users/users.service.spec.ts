import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    session: {
      updateMany: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    paymentMethod: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    notificationSetting: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user details if active', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        username: 'johndoe',
        isActive: true,
      });

      const res = await service.getProfile('user-id');
      expect(res.status).toBe('success');
      expect(res.data.user.username).toBe('johndoe');
    });

    it('should throw NotFoundException if inactive or missing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('user-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', isActive: true });
      mockPrismaService.user.findFirst.mockResolvedValue(null); // email not taken
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'newemail@example.com',
      });

      const res = await service.updateProfile('user-id', { email: 'newemail@example.com' });
      expect(res.status).toBe('success');
      expect(res.data.user.email).toBe('newemail@example.com');
    });

    it('should throw ConflictException if email taken by another user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', isActive: true });
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'other-id' }); // taken

      await expect(
        service.updateProfile('user-id', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteAccount', () => {
    it('should deactivate account and revoke sessions', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', isActive: true });
      
      const res = await service.deleteAccount('user-id');
      expect(res.status).toBe('success');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { isActive: false },
      });
      expect(mockPrismaService.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        data: { isRevoked: true },
      });
    });
  });

  describe('Address management', () => {
    it('should reset other default flags if adding default address', async () => {
      mockPrismaService.address.create.mockResolvedValue({ id: 'addr-id', isDefault: true });

      const res = await service.addAddress('user-id', {
        title: 'Home',
        street: '123 St',
        city: 'Seattle',
        postalCode: '12345',
        country: 'USA',
        isDefault: true,
      });

      expect(res.status).toBe('success');
      expect(mockPrismaService.address.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        data: { isDefault: false },
      });
    });
  });

  describe('Payment methods management', () => {
    it('should mask card number and return token', async () => {
      mockPrismaService.paymentMethod.create.mockResolvedValue({
        id: 'card-id',
        cardNumberMasked: '**** **** **** 4444',
      });

      const res = await service.addPaymentMethod('user-id', {
        cardHolderName: 'John Doe',
        cardNumber: '1111222233334444',
        cardType: 'Visa',
        expirationDate: '12/28',
      });

      expect(res.status).toBe('success');
      expect(mockPrismaService.paymentMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cardNumberMasked: '**** **** **** 4444',
            token: expect.stringContaining('tok_mock_'),
          }),
        }),
      );
    });
  });
});
