import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  // ----------------------------------------------------
  // CORE DISPATCH ENGINE (RESPECTS PREFERENCES)
  // ----------------------------------------------------

  async sendNotification(userId: string, eventType: string, message: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { notificationSetting: true },
    });

    if (!user) {
      throw new NotFoundException('Recipient user not found');
    }

    const emailAlerts = user.notificationSetting?.emailAlerts ?? true;
    const pushAlerts = user.notificationSetting?.pushAlerts ?? true;
    const smsAlerts = user.notificationSetting?.smsAlerts ?? false;

    const sent = { email: false, push: false, sms: false };

    // 1. Email Channel
    if (emailAlerts && user.email) {
      this.sendEmailMock(user.email, `MartPay - ${eventType.toUpperCase()}`, message);
      sent.email = true;
    }

    // 2. Push Channel
    if (pushAlerts) {
      this.sendPushMock(user.id, eventType, message);
      sent.push = true;
    }

    // 3. SMS Channel
    if (smsAlerts && user.phoneNumber) {
      this.sendSmsMock(user.phoneNumber, message);
      sent.sms = true;
    }

    return {
      status: 'success',
      sent,
    };
  }

  // ----------------------------------------------------
  // EVENT HELPER INTERFACES
  // ----------------------------------------------------

  async notifyOrderCreated(userId: string, orderId: string, amount: number) {
    return this.sendNotification(
      userId,
      'order_created',
      `Your checkout order has been successfully created. Order ID: ${orderId}. Total Amount: $${amount.toFixed(2)}.`,
    );
  }

  async notifyPaymentSuccess(userId: string, orderId: string, amount: number, paymentRef: string) {
    return this.sendNotification(
      userId,
      'payment_success',
      `Payment capture successful. Order ID: ${orderId}. Amount Paid: $${amount.toFixed(2)}. Gateway Tx ID: ${paymentRef}.`,
    );
  }

  async notifyRefund(userId: string, orderId: string, amount: number, refundRef: string) {
    return this.sendNotification(
      userId,
      'refund',
      `Refund processed successfully. Order ID: ${orderId}. Amount Refunded: $${amount.toFixed(2)}. Refund Tx ID: ${refundRef}.`,
    );
  }

  async notifyOffer(userId: string, title: string, details: string) {
    return this.sendNotification(
      userId,
      'offer',
      `Exclusive Deal for you: "${title}". ${details}`,
    );
  }

  async notifySecurityAlert(userId: string, alertTitle: string, details: string) {
    return this.sendNotification(
      userId,
      'security_alert',
      `Security Alert: ${alertTitle}. details: ${details}. If this wasn't you, reset your password immediately.`,
    );
  }

  // ----------------------------------------------------
  // CHANNEL MOCK HANDLERS (LOG PIPELINES)
  // ----------------------------------------------------

  private sendEmailMock(to: string, subject: string, body: string) {
    this.logger.log(`[Email Dispatch] To: ${to} | Subject: ${subject} | Message: ${body}`);
  }

  private sendPushMock(userId: string, title: string, body: string) {
    this.logger.log(`[Push Notification Dispatch] To User ID: ${userId} | Title: ${title} | Body: ${body}`);
  }

  private sendSmsMock(toPhone: string, body: string) {
    this.logger.log(`[SMS Text Dispatch] To Phone: ${toPhone} | Message: ${body}`);
  }
}
