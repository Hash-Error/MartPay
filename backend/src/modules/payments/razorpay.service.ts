import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpay: Razorpay | null = null;
  private isMockMode = true;
  private keySecret = '';

  constructor(private configService: ConfigService) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (keyId && keySecret) {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
      this.keySecret = keySecret;
      this.isMockMode = false;
      this.logger.log('Razorpay SDK initialized successfully.');
    } else {
      this.logger.warn('RAZORPAY credentials not found. Operating in Razorpay mock mode.');
    }
  }

  async createOrder(amount: number, currency = 'INR') {
    if (this.isMockMode || !this.razorpay) {
      const mockOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
      return {
        id: mockOrderId,
        amount,
        currency,
        status: 'created',
      };
    }

    // Convert decimal amount to paise (e.g. 100 INR = 10000 paise)
    const paiseAmount = Math.round(amount * 100);

    const order = await this.razorpay.orders.create({
      amount: paiseAmount,
      currency,
      receipt: `receipt_${Date.now()}`,
    });

    return {
      id: order.id,
      amount,
      currency: order.currency,
      status: order.status,
    };
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    if (this.isMockMode) {
      return signature === 'mock_signature';
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    return expectedSignature === signature;
  }

  async createRefund(paymentId: string, amount?: number) {
    if (this.isMockMode || !this.razorpay) {
      return {
        id: `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`,
        status: 'processed',
        amount: amount || 0,
      };
    }

    const refundParams: any = {};
    if (amount) {
      refundParams.amount = Math.round(amount * 100); // convert to paise
    }

    const refund = await this.razorpay.payments.refund(paymentId, refundParams);
    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount ? refund.amount / 100 : 0,
    };
  }
}
