import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private auditLogsService: AuditLogsService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, password, role } = registerDto;
    const existing = await this.usersService.findByUsername(username);
    if (existing) {
      throw new ConflictException('Username is already taken');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role || 'customer';
    
    const user = await this.usersService.create(username, passwordHash, userRole);
    
    await this.auditLogsService.logEvent(
      'USER_REGISTRATION',
      `User ${username} successfully registered with role ${userRole}`,
      user.id,
    );

    // Return user without password
    const { passwordHash: _, ...result } = user;
    return {
      status: 'success',
      data: { user: result },
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { username, password } = loginDto;
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      await this.auditLogsService.logEvent(
        'AUTH_FAILED',
        `Failed login attempt for non-existent user: ${username}`,
        undefined,
        { ipAddress, userAgent },
      );
      throw new UnauthorizedException('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await this.auditLogsService.logEvent(
        'AUTH_FAILED',
        `Failed login attempt (incorrect password) for user: ${username}`,
        user.id,
        { ipAddress, userAgent },
      );
      throw new UnauthorizedException('Invalid username or password');
    }

    // Generate tokens
    const { accessToken, refreshToken, expiresAt, sessionId } = await this.issueTokenPair(
      user.id,
      user.username,
      user.role,
      ipAddress,
      userAgent,
    );

    await this.auditLogsService.logEvent(
      'USER_LOGIN_SUCCESS',
      `User ${username} logged in successfully`,
      user.id,
      { sessionId, ipAddress, userAgent },
    );

    return {
      status: 'success',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      },
    };
  }

  async logout(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });

    await this.auditLogsService.logEvent(
      'USER_LOGOUT',
      `Session ${sessionId} successfully logged out`,
      userId,
    );

    return { status: 'success', message: 'Logged out successfully' };
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    try {
      const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
      const payload = await this.jwtService.verifyAsync(refreshToken, { secret });
      
      const sessionId = payload.sessionId;
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });

      if (!session || session.isRevoked || session.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Session is invalid or expired');
      }

      // Replay Attack protection: verify matching refresh token hash
      const isMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (!isMatch) {
        // Potential token theft: revoke everything for this session
        await this.prisma.session.update({
          where: { id: sessionId },
          data: { isRevoked: true },
        });
        await this.auditLogsService.logEvent(
          'TOKEN_REPLAY_ATTACK',
          `Revoked compromised refresh token attempt for session: ${sessionId}`,
          session.userId,
        );
        throw new UnauthorizedException('Session is invalid or expired');
      }

      // Rotate tokens
      const newTokens = await this.issueTokenPair(
        session.user.id,
        session.user.username,
        session.user.role,
        ipAddress,
        userAgent,
        sessionId, // keep the same session row
      );

      await this.auditLogsService.logEvent(
        'TOKEN_REFRESHED',
        `Successfully rotated tokens for session ${sessionId}`,
        session.user.id,
      );

      return {
        status: 'success',
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        },
      };
    } catch (err) {
      throw new UnauthorizedException('Session is invalid or expired');
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { username } = forgotPasswordDto;
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new NotFoundException('Username not found');
    }

    // Generate random 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL
    
    await this.usersService.updateOtp(user.id, otpCode, otpExpiresAt, 'PASSWORD_RESET');
    
    this.logger.log(`[OTP SIMULATED] Password reset OTP code for user ${username}: ${otpCode}`);

    await this.auditLogsService.logEvent(
      'FORGOT_PASSWORD_REQUEST',
      `Issued password reset OTP to user ${username}`,
      user.id,
    );

    return {
      status: 'success',
      message: 'Verification OTP sent successfully',
      // We return the otpCode for development/testing convenience
      data: { otpCode },
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { username, otpCode } = verifyOtpDto;
    const user = await this.usersService.findByUsername(username);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.validateOtpDetails(user, otpCode, 'PASSWORD_RESET');

    await this.auditLogsService.logEvent(
      'OTP_VERIFICATION_SUCCESS',
      `Successfully verified OTP code for user ${username}`,
      user.id,
    );

    return {
      status: 'success',
      message: 'OTP verified successfully',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { username, otpCode, newPassword } = resetPasswordDto;
    const user = await this.usersService.findByUsername(username);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.validateOtpDetails(user, otpCode, 'PASSWORD_RESET');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, passwordHash);
    await this.usersService.clearOtp(user.id);

    await this.auditLogsService.logEvent(
      'PASSWORD_RESET_SUCCESS',
      `Successfully reset password via OTP validation for user ${username}`,
      user.id,
    );

    return {
      status: 'success',
      message: 'Password reset successfully',
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;
    const user = await this.usersService.findById(userId);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect current password');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, newHash);

    await this.auditLogsService.logEvent(
      'PASSWORD_CHANGE_SUCCESS',
      `User ${user.username} successfully updated their password`,
      user.id,
    );

    return {
      status: 'success',
      message: 'Password updated successfully',
    };
  }

  async registerDevice(userId: string, registerDeviceDto: RegisterDeviceDto) {
    const { deviceId, deviceName, deviceToken } = registerDeviceDto;
    
    const device = await this.prisma.device.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
      update: {
        deviceName,
        deviceToken,
      },
      create: {
        userId,
        deviceId,
        deviceName,
        deviceToken,
      },
    });

    await this.auditLogsService.logEvent(
      'DEVICE_REGISTRATION',
      `Registered device: ${deviceName || 'unknown'} (${deviceId})`,
      userId,
    );

    return {
      status: 'success',
      data: { device },
    };
  }

  async getSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: 'success',
      data: { sessions },
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });

    await this.auditLogsService.logEvent(
      'SESSION_REVOKED',
      `Revoked session registration ${sessionId}`,
      userId,
    );

    return {
      status: 'success',
      message: 'Session revoked successfully',
    };
  }

  // Helper: Token generation and database caching rotation
  private async issueTokenPair(
    userId: string,
    username: string,
    role: string,
    ipAddress?: string,
    userAgent?: string,
    existingSessionId?: string,
  ) {
    const accessSecret = this.configService.get<string>('JWT_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessExpiration = this.configService.get<string>('JWT_EXPIRATION', '3600s');
    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');

    let sessionId = existingSessionId;

    if (!sessionId) {
      // Create a placeholder session to get ID
      const session = await this.prisma.session.create({
        data: {
          userId,
          refreshTokenHash: 'placeholder',
          userAgent,
          ipAddress,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // temp
        },
      });
      sessionId = session.id;
    }

    const payload = { sub: userId, username, role, sessionId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { secret: accessSecret, expiresIn: accessExpiration as any }),
      this.jwtService.signAsync(payload, { secret: refreshSecret, expiresIn: refreshExpiration as any }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    // 7 days conversion
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save actual details
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        userAgent,
        ipAddress,
        expiresAt,
        isRevoked: false,
      },
    });

    return { accessToken, refreshToken, expiresAt, sessionId };
  }

  // Helper: OTP validation
  private validateOtpDetails(user: any, otpCode: string, purpose: string) {
    if (!user.otpCode || user.otpCode !== otpCode) {
      throw new BadRequestException('Invalid OTP code');
    }
    if (user.otpPurpose !== purpose) {
      throw new BadRequestException('Invalid OTP purpose');
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP code has expired');
    }
  }
}
