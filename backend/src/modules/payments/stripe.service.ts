import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;
  private isMockMode = true;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-01-27' as any,
      });
      this.isMockMode = false;
      this.logger.log('Stripe SDK initialized successfully.');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not found. Operating in Stripe mock mode.');
    }
  }

  async createPaymentIntent(amount: number, currency = 'usd'): Promise<any> {
    if (this.isMockMode || !this.stripe) {
      const mockId = `pi_mock_${Math.random().toString(36).substring(2, 12)}`;
      return {
        id: mockId,
        clientSecret: `${mockId}_secret_${Math.random().toString(36).substring(2, 6)}`,
        amount,
        currency,
        status: 'requires_payment_method',
      };
    }

    // Convert decimal amount to cents for Stripe
    const centsAmount = Math.round(amount * 100);

    const intent = await this.stripe.paymentIntents.create({
      amount: centsAmount,
      currency,
      metadata: { integration: 'martpay' },
    });

    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      amount,
      currency,
      status: intent.status,
    };
  }

  async verifyPaymentIntent(id: string): Promise<any> {
    if (this.isMockMode || !this.stripe) {
      if (id.startsWith('pi_mock_')) {
        return { status: 'succeeded', amountReceived: 100 };
      }
      return { status: 'failed', amountReceived: 0 };
    }

    const intent = await this.stripe.paymentIntents.retrieve(id);
    return {
      status: intent.status,
      amountReceived: intent.amount_received ? intent.amount_received / 100 : 0,
    };
  }

  async createRefund(transactionId: string, amount?: number): Promise<any> {
    if (this.isMockMode || !this.stripe) {
      return {
        id: `re_mock_${Math.random().toString(36).substring(2, 12)}`,
        status: 'succeeded',
        amount: amount || 0,
      };
    }

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: transactionId,
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // convert to cents
    }

    const refund = await this.stripe.refunds.create(refundParams);
    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount ? refund.amount / 100 : 0,
    };
  }
}
