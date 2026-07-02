import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async create(username: string, passwordHash: string, role: string) {
    return this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateOtp(id: string, otpCode: string, otpExpiresAt: Date, otpPurpose: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        otpCode,
        otpExpiresAt,
        otpPurpose,
      },
    });
  }

  async clearOtp(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        otpPurpose: null,
      },
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
      },
    });
  }

  // ----------------------------------------------------
  // PROFILE & ACCOUNT MANAGEMENT
  // ----------------------------------------------------

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      throw new NotFoundException('User profile not found or inactive');
    }
    return { status: 'success', data: { user } };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId, isActive: true } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    if (updateProfileDto.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: {
          email: updateProfileDto.email,
          id: { not: userId },
        },
      });
      if (emailTaken) {
        throw new ConflictException('Email is already associated with another account');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
      },
    });

    return { status: 'success', data: { user: updatedUser } };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId, isActive: true } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // Soft delete: set isActive: false
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Revoke all active login sessions
    await this.prisma.session.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    return {
      status: 'success',
      message: 'Account successfully deactivated and sessions revoked',
    };
  }

  // ----------------------------------------------------
  // ADDRESS BOOK MANAGEMENT
  // ----------------------------------------------------

  async getAddresses(userId: string) {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return { status: 'success', data: { addresses } };
  }

  async addAddress(userId: string, createAddressDto: CreateAddressDto) {
    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        userId,
        ...createAddressDto,
      },
    });

    return { status: 'success', data: { address } };
  }

  async updateAddress(userId: string, addressId: string, updateAddressDto: UpdateAddressDto) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('You do not own this address');
    }

    if (updateAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data: updateAddressDto,
    });

    return { status: 'success', data: { address: updated } };
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('You do not own this address');
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    return { status: 'success', message: 'Address removed successfully' };
  }

  // ----------------------------------------------------
  // SAVED PAYMENT METHODS
  // ----------------------------------------------------

  async getPaymentMethods(userId: string) {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { userId },
      select: {
        id: true,
        cardHolderName: true,
        cardNumberMasked: true,
        cardType: true,
        expirationDate: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return { status: 'success', data: { paymentMethods: methods } };
  }

  async addPaymentMethod(userId: string, savePaymentMethodDto: SavePaymentMethodDto) {
    const { cardNumber, cardHolderName, cardType, expirationDate, isDefault } = savePaymentMethodDto;
    
    // Mask card details
    const last4 = cardNumber.replace(/\s+/g, '').slice(-4);
    const cardNumberMasked = `**** **** **** ${last4}`;

    // Mock secure payment token
    const token = `tok_mock_${Math.random().toString(36).substring(2, 15)}`;

    if (isDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const method = await this.prisma.paymentMethod.create({
      data: {
        userId,
        cardHolderName,
        cardNumberMasked,
        cardType,
        expirationDate,
        token,
        isDefault: isDefault || false,
      },
      select: {
        id: true,
        cardHolderName: true,
        cardNumberMasked: true,
        cardType: true,
        expirationDate: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return { status: 'success', data: { paymentMethod: method } };
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    if (method.userId !== userId) {
      throw new ForbiddenException('You do not own this payment method');
    }

    await this.prisma.paymentMethod.delete({
      where: { id: paymentMethodId },
    });

    return { status: 'success', message: 'Payment method removed successfully' };
  }

  // ----------------------------------------------------
  // NOTIFICATION PREFERENCES
  // ----------------------------------------------------

  async getNotificationSettings(userId: string) {
    let settings = await this.prisma.notificationSetting.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.notificationSetting.create({
        data: {
          userId,
          emailAlerts: true,
          pushAlerts: true,
          smsAlerts: false,
        },
      });
    }

    return { status: 'success', data: { notificationSettings: settings } };
  }

  async updateNotificationSettings(userId: string, updateNotificationsDto: UpdateNotificationsDto) {
    const settings = await this.prisma.notificationSetting.upsert({
      where: { userId },
      update: updateNotificationsDto,
      create: {
        userId,
        emailAlerts: updateNotificationsDto.emailAlerts ?? true,
        pushAlerts: updateNotificationsDto.pushAlerts ?? true,
        smsAlerts: updateNotificationsDto.smsAlerts ?? false,
      },
    });

    return { status: 'success', data: { notificationSettings: settings } };
  }

  // ----------------------------------------------------
  // PURCHASE TRANSACTION HISTORY
  // ----------------------------------------------------

  async getPurchaseHistory(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: ['paid', 'completed_exit'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { status: 'success', data: { purchases: orders } };
  }
}
