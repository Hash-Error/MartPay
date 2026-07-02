import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockUsersService = {
    findByUsername: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    updateOtp: jest.fn(),
    clearOtp: jest.fn(),
    updatePassword: jest.fn(),
  };

  const mockAuditLogsService = {
    logEvent: jest.fn().mockResolvedValue({}),
  };

  const mockPrismaService = {
    session: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    device: {
      upsert: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mockToken'),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'JWT_SECRET') return 'secret';
      if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 'user-uuid',
        username: 'newuser',
        passwordHash: 'hashedPass',
        role: 'customer',
        createdAt: new Date(),
      });

      const res = await service.register({
        username: 'newuser',
        password: 'Password123!',
        role: 'customer',
      });

      expect(res.status).toBe('success');
      expect(res.data.user.username).toBe('newuser');
      expect(mockUsersService.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if username exists', async () => {
      mockUsersService.findByUsername.mockResolvedValue({ id: '1' });

      await expect(
        service.register({
          username: 'existinguser',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should log in a user with valid credentials', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockUsersService.findByUsername.mockResolvedValue({
        id: 'user-uuid',
        username: 'testuser',
        passwordHash: hash,
        role: 'customer',
      });

      mockPrismaService.session.create.mockResolvedValue({ id: 'session-uuid' });
      mockPrismaService.session.update.mockResolvedValue({});

      const res = await service.login({
        username: 'testuser',
        password: 'Password123!',
      });

      expect(res.status).toBe('success');
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.user.username).toBe('testuser');
    });

    it('should throw UnauthorizedException for invalid username', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.login({
          username: 'wronguser',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockUsersService.findByUsername.mockResolvedValue({
        id: 'user-uuid',
        username: 'testuser',
        passwordHash: hash,
        role: 'customer',
      });

      await expect(
        service.login({
          username: 'testuser',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword / OTP flow', () => {
    it('should issue an OTP code on forgotPassword', async () => {
      mockUsersService.findByUsername.mockResolvedValue({ id: 'user-uuid', username: 'testuser' });

      const res = await service.forgotPassword({ username: 'testuser' });

      expect(res.status).toBe('success');
      expect(res.data.otpCode).toHaveLength(6);
      expect(mockUsersService.updateOtp).toHaveBeenCalled();
    });

    it('should verify correct OTP', async () => {
      const expiry = new Date(Date.now() + 5 * 60 * 1000);
      mockUsersService.findByUsername.mockResolvedValue({
        id: 'user-uuid',
        username: 'testuser',
        otpCode: '123456',
        otpPurpose: 'PASSWORD_RESET',
        otpExpiresAt: expiry,
      });

      const res = await service.verifyOtp({ username: 'testuser', otpCode: '123456' });

      expect(res.status).toBe('success');
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const expiry = new Date(Date.now() + 5 * 60 * 1000);
      mockUsersService.findByUsername.mockResolvedValue({
        id: 'user-uuid',
        username: 'testuser',
        otpCode: '123456',
        otpPurpose: 'PASSWORD_RESET',
        otpExpiresAt: expiry,
      });

      await expect(
        service.verifyOtp({ username: 'testuser', otpCode: 'wrong_code' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired OTP', async () => {
      const expiry = new Date(Date.now() - 5 * 60 * 1000); // expired
      mockUsersService.findByUsername.mockResolvedValue({
        id: 'user-uuid',
        username: 'testuser',
        otpCode: '123456',
        otpPurpose: 'PASSWORD_RESET',
        otpExpiresAt: expiry,
      });

      await expect(
        service.verifyOtp({ username: 'testuser', otpCode: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should update password with correct current password', async () => {
      const currentHash = await bcrypt.hash('OldPass123!', 10);
      mockUsersService.findById.mockResolvedValue({
        id: 'user-uuid',
        username: 'testuser',
        passwordHash: currentHash,
      });

      const res = await service.changePassword('user-uuid', {
        oldPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      });

      expect(res.status).toBe('success');
      expect(mockUsersService.updatePassword).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException with incorrect current password', async () => {
      const currentHash = await bcrypt.hash('OldPass123!', 10);
      mockUsersService.findById.mockResolvedValue({
        id: 'user-uuid',
        username: 'testuser',
        passwordHash: currentHash,
      });

      await expect(
        service.changePassword('user-uuid', {
          oldPassword: 'WrongOldPass!',
          newPassword: 'NewPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
