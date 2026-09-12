Waffo Node.js SDK
English | 中文

npm version License: MIT Node.js Version

Official Node.js/TypeScript SDK for Waffo Payment Platform, providing one-stop global payment solutions for AI products, SaaS services, and more.

Latest Release Highlights
Subscription update API: Added subscription().update() with amount, trialPeriodAmount, and scheduledAmounts support.
Scheduled amount coverage: Added scheduledAmounts fields across subscription create, change, update, and inquiry product info types.
E2E and contract hardening: Added subscription update E2E coverage, auto-injected captureRequestedAt for order.capture(), and expanded nested schema field validation.
Introduction
Core Features
Global Payments: Support for credit cards, debit cards, e-wallets, virtual accounts, and more payment methods covering mainstream global payment channels
Subscription Management: Complete subscription lifecycle management with trial periods, recurring billing, and subscription upgrades/downgrades
Refund Processing: Flexible full/partial refund capabilities with refund status tracking
Webhook Notifications: Real-time payment result push notifications for payments, refunds, subscription status changes, and more
Security & Reliability: PCI DSS certified, RSA signature verification, enforced TLS 1.2+ encryption
Use Cases
Scenario	Description
AI Products	ChatGPT-like applications, AI writing tools, AI image generation with usage-based billing or subscriptions
SaaS Services	Enterprise software subscriptions, online collaboration tools, cloud services with periodic payments
Content Platforms	Membership subscriptions, paid content, tipping scenarios
Table of Contents
Latest Release Highlights
Requirements
Installation
Quick Start
Configuration
Framework Integration
API Usage
Order Management
Subscription Management
Refund Query
Merchant Configuration
Webhook Handling
Payment Method Types
Advanced Configuration
Custom HTTP Transport
TLS Security Configuration
Debug Logging
Handling New API Fields (ExtraParams)
Error Handling
Support
License
Development & Testing
Requirements
Node.js >= 18.0.0
npm, yarn, or pnpm
Version Compatibility
Node.js Version	Support Status
22.x	✅ Fully Supported
20.x LTS	✅ Fully Supported (Recommended)
18.x LTS	✅ Fully Supported
< 18.x	❌ Not Supported
Installation
npm install @waffo/waffo-node
# or
yarn add @waffo/waffo-node
# or
pnpm add @waffo/waffo-node
Quick Start
1. Initialize the SDK
import { Waffo, Environment } from '@waffo/waffo-node';

const waffo = new Waffo({
  apiKey: 'your-api-key',
  privateKey: 'your-base64-encoded-private-key',
  waffoPublicKey: 'waffo-public-key',  // From Waffo Dashboard
  merchantId: 'your-merchant-id',       // Auto-injected into requests
  environment: Environment.SANDBOX,     // SANDBOX or PRODUCTION
});
2. Create a Payment Order
import { randomUUID } from 'crypto';

// Generate idempotency key (max 32 chars)
const paymentRequestId = randomUUID().replace(/-/g, '');
// Important: Persist this ID to database for retry and query

const response = await waffo.order().create({
  paymentRequestId,
  merchantOrderId: `ORDER_${Date.now()}`,
  orderCurrency: 'HKD',
  orderAmount: '100.00',
  orderDescription: 'Test Product',
  notifyUrl: 'https://your-site.com/webhook',
  userInfo: {
    userId: 'user_123',
    userEmail: 'user@example.com',
    userTerminal: 'WEB',
  },
  paymentInfo: {
    productName: 'ONE_TIME_PAYMENT',
  },
  goodsInfo: {
    goodsUrl: 'https://your-site.com/product/001',
  },
});

if (response.isSuccess()) {
  const data = response.getData();
  console.log('Redirect URL:', data.orderAction);
  console.log('Acquiring Order ID:', data.acquiringOrderId);
  console.log('Order Status:', data.orderStatus);
} else {
  console.log('Error:', response.getMessage());
}
3. Query Order Status
const response = await waffo.order().inquiry({
  acquiringOrderId: 'acquiring_order_id',
});

if (response.isSuccess()) {
  const data = response.getData();
  console.log('Order Status:', data.orderStatus);
  console.log('Merchant Order ID:', data.merchantOrderId);
  console.log('Order Amount:', data.orderAmount);
  console.log('Order Currency:', data.orderCurrency);
  // Tip: Verify amount and currency match your records
}
Configuration
Full Configuration Options
import { Waffo, Environment } from '@waffo/waffo-node';

const waffo = new Waffo({
  // Required
  apiKey: 'your-api-key',                    // API Key
  privateKey: 'your-base64-private-key',     // Base64 encoded merchant private key
  waffoPublicKey: 'waffo-public-key',        // Waffo public key (from Dashboard)
  environment: Environment.SANDBOX,           // SANDBOX or PRODUCTION (required)

  // Optional
  merchantId: 'your-merchant-id',            // Default merchant ID (auto-injected)
  connectTimeout: 10000,                     // Connection timeout in ms (default: 10000)
  readTimeout: 30000,                        // Read timeout in ms (default: 30000)
  logger: console,                           // Custom logger
  httpTransport: customTransport,            // Custom HTTP transport
});
Environment Variables
# Set environment variables
export WAFFO_API_KEY=your-api-key
export WAFFO_PRIVATE_KEY=your-private-key
export WAFFO_PUBLIC_KEY=waffo-public-key       # Waffo public key
export WAFFO_ENVIRONMENT=SANDBOX               # Required: SANDBOX or PRODUCTION
export WAFFO_MERCHANT_ID=your-merchant-id      # Optional
import { Waffo } from '@waffo/waffo-node';

const waffo = Waffo.fromEnv();
Environment URLs
Environment	Base URL	Description
SANDBOX	https://api-sandbox.waffo.com	Test environment
PRODUCTION	https://api.waffo.com	Production environment
Important: Environment must be explicitly specified. SDKs do not default to any environment to prevent accidental requests to wrong environments.

Request-Level Configuration
const response = await waffo.order().create(params, {
  connectTimeout: 10000,
  readTimeout: 30000,
});
Framework Integration
Express Integration
import express from 'express';
import { Waffo, Environment } from '@waffo/waffo-node';

const app = express();
const waffo = new Waffo({
  apiKey: process.env.WAFFO_API_KEY!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
  waffoPublicKey: process.env.WAFFO_PUBLIC_KEY!,
  environment: Environment.SANDBOX,
});

// Webhook endpoint
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const body = req.body.toString();
  const signature = req.headers['x-signature'] as string;

  const webhookHandler = waffo.webhook()
    .onPayment((notification) => {
      console.log('Payment received:', notification.result?.acquiringOrderId);
    });

  const result = await webhookHandler.handleWebhook(body, signature);
  res.setHeader('X-SIGNATURE', result.responseSignature);
  res.status(200).json(result.responseBody);
});

app.listen(3000);
NestJS Integration
// waffo.module.ts
import { Module, Global } from '@nestjs/common';
import { Waffo, Environment } from '@waffo/waffo-node';

@Global()
@Module({
  providers: [
    {
      provide: 'WAFFO',
      useFactory: () => {
        return new Waffo({
          apiKey: process.env.WAFFO_API_KEY!,
          privateKey: process.env.WAFFO_PRIVATE_KEY!,
          waffoPublicKey: process.env.WAFFO_PUBLIC_KEY!,
          environment: Environment.SANDBOX,
        });
      },
    },
  ],
  exports: ['WAFFO'],
})
export class WaffoModule {}

// payment.controller.ts
import { Controller, Post, Body, Headers, Inject, Res } from '@nestjs/common';
import { Waffo } from '@waffo/waffo-node';
import { Response } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(@Inject('WAFFO') private readonly waffo: Waffo) {}

  @Post('webhook')
  async handleWebhook(
    @Body() body: string,
    @Headers('x-signature') signature: string,
    @Res() res: Response,
  ) {
    const webhookHandler = this.waffo.webhook()
      .onPayment((notification) => {
        console.log('Payment received:', notification.result?.acquiringOrderId);
      });

    const result = await webhookHandler.handleWebhook(body, signature);
    res.setHeader('X-SIGNATURE', result.responseSignature);
    res.status(200).json(result.responseBody);
  }
}
Fastify Integration
import Fastify from 'fastify';
import { Waffo, Environment } from '@waffo/waffo-node';

const fastify = Fastify();
const waffo = new Waffo({
  apiKey: process.env.WAFFO_API_KEY!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
  waffoPublicKey: process.env.WAFFO_PUBLIC_KEY!,
  environment: Environment.SANDBOX,
});

// Register raw body parser for webhooks
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  done(null, body);
});

fastify.post('/webhook', async (request, reply) => {
  const body = request.body as string;
  const signature = request.headers['x-signature'] as string;

  const webhookHandler = waffo.webhook()
    .onPayment((notification) => {
      console.log('Payment received:', notification.result?.acquiringOrderId);
    });

  const result = await webhookHandler.handleWebhook(body, signature);
  reply.header('X-SIGNATURE', result.responseSignature);
  return result.responseBody;
});

fastify.listen({ port: 3000 });
API Usage
Order Management
Create Order
import { randomUUID } from 'crypto';

const response = await waffo.order().create({
  paymentRequestId: randomUUID().replace(/-/g, ''),  // Idempotency key, persist it
  merchantOrderId: `ORDER_${Date.now()}`,
  orderCurrency: 'BRL',  // Brazilian Real
  orderAmount: '100.00',
  orderDescription: 'Product Name',
  orderRequestedAt: new Date().toISOString(),
  merchantInfo: {
    merchantId: 'your-merchant-id',
  },
  userInfo: {
    userId: 'user_123',
    userEmail: 'user@example.com',
    userTerminal: 'WEB',
  },
  paymentInfo: {
    productName: 'ONE_TIME_PAYMENT',
    payMethodType: 'CREDITCARD',  // CREDITCARD, DEBITCARD, EWALLET, VA, etc.
    // payMethodName: 'CC_VISA',  // Optional: specify exact payment method
  },
  goodsInfo: {
    goodsUrl: 'https://your-site.com/product/001',
  },
  notifyUrl: 'https://your-site.com/webhook',
  successRedirectUrl: 'https://your-site.com/success',
  failedRedirectUrl: 'https://your-site.com/failed',
  cancelRedirectUrl: 'https://your-site.com/cancel',
});

if (response.isSuccess()) {
  const data = response.getData();
  console.log('Checkout URL:', data.orderAction);
}
Combine Multiple Payment Methods
// Allow user to choose between credit card or debit card
paymentInfo: {
  productName: 'ONE_TIME_PAYMENT',
  payMethodType: 'CREDITCARD,DEBITCARD',  // Comma-separated for multiple types
}
Query Order
const response = await waffo.order().inquiry({
  acquiringOrderId: 'acquiring_order_id',
});
Cancel Order
const response = await waffo.order().cancel({
  acquiringOrderId: 'acquiring_order_id',
  orderRequestedAt: new Date().toISOString(),
});
Refund Order
import { randomUUID } from 'crypto';

// Generate idempotency key (max 32 chars)
const refundRequestId = randomUUID().replace(/-/g, '');
// Important: Persist this ID for retry and query

const response = await waffo.order().refund({
  refundRequestId,
  acquiringOrderId: 'acquiring_order_id',
  refundAmount: '50.00',
  refundReason: 'Customer requested refund',
});
Capture Order
// For pre-authorized payments
const response = await waffo.order().capture({
  paymentRequestId: 'unique-request-id',
  merchantId: 'merchant-123',
  captureAmount: '10.00',
});
Subscription Management
Create Subscription
import { randomUUID } from 'crypto';

const subscriptionRequest = randomUUID().replace(/-/g, '');

const response = await waffo.subscription().create({
  subscriptionRequest,
  merchantSubscriptionId: `MSUB_${Date.now()}`,
  currency: 'HKD',
  amount: '99.00',
  payMethodType: 'CREDITCARD,DEBITCARD,APPLEPAY,GOOGLEPAY',
  productInfo: {
    description: 'Monthly Subscription',
    periodType: 'MONTHLY',
    periodInterval: '1',
  },
  userInfo: {
    userId: 'user_123',
    userEmail: 'user@example.com',
  },
  requestedAt: new Date().toISOString(),
  successRedirectUrl: 'https://your-site.com/subscription/success',
  failedRedirectUrl: 'https://your-site.com/subscription/failed',
  cancelRedirectUrl: 'https://your-site.com/subscription/cancel',
  notifyUrl: 'https://your-site.com/webhook/subscription',
  subscriptionManagementUrl: 'https://your-site.com/subscription/manage',
});

if (response.isSuccess()) {
  const data = response.getData();
  console.log('Waffo Subscription ID:', data.subscriptionId);
  console.log('Status:', data.subscriptionStatus);
  console.log('Action:', data.subscriptionAction);
}
Subscription with Trial Period
productInfo: {
  description: 'Monthly subscription with 7-day free trial',
  periodType: 'MONTHLY',
  periodInterval: '1',
  numberOfPeriod: '12',
  // Trial period configuration
  trialPeriodType: 'DAILY',
  trialPeriodInterval: '7',
  trialPeriodAmount: '0',  // Free trial
  numberOfTrialPeriod: '1',
}
Query Subscription
// Query by subscriptionId
const response = await waffo.subscription().inquiry({
  subscriptionId: 'subscription_id',
  paymentDetails: 1,  // 1: include payment details, 0: exclude
});

// Or query by subscriptionRequest
const response = await waffo.subscription().inquiry({
  subscriptionRequest: 'subscription_request',
});
Cancel Subscription
const response = await waffo.subscription().cancel({
  subscriptionId: 'subscription_id',
});
Get Subscription Management URL
const response = await waffo.subscription().manage({
  subscriptionId: 'subscription_id',
});

if (response.isSuccess()) {
  const managementUrl = response.getData().managementUrl;
  // Redirect user to this URL to manage subscription
}
Update Subscription
Update the billing amounts of an active subscription without re-authorization. Provide subscriptionRequest or subscriptionId. To charge a seat add-on immediately, include topupInfo; the updated billing amounts take effect from the next billing period.

const response = await waffo.subscription().update({
  subscriptionId: 'subscription_id',
  amount: '129.00',  // New per-period amount from the next billing period
  productInfo: {
    trialPeriodAmount: '0',
    scheduledAmounts: [
      { period: '2', amount: '99.00' },   // Per-period override
      { period: '3', amount: '129.00' },
    ],
  },
  topupInfo: {
    topupRequest: 'mimo-topup-001', // Idempotency key for this top-up
    topupAmount: '30.00',           // Amount charged immediately
    description: 'Seat add-on 3 seats',
    orderExpiredAt: '2030-01-01T00:00:00Z',
  },
});

if (response.isSuccess()) {
  const data = response.getData();
  console.log('Previous Amount:', data.previousAmount);
  console.log('New Amount:', data.newAmount);
  console.log('Next Effective Period:', data.nextEffectivePeriod);
  console.log('Top-up Order:', data.topupInfo?.acquiringOrderId);
  console.log('Top-up Status:', data.topupInfo?.topupStatus);
}
Subscription Change (Upgrade/Downgrade)
Change an existing subscription to a new plan (upgrade or downgrade).

Change Subscription
import { randomUUID } from 'crypto';
import { WaffoUnknownStatusError } from '@waffo/waffo-node';

// New subscription request ID for the change
const subscriptionRequest = randomUUID().replace(/-/g, '');
const originSubscriptionRequest = 'original-subscription-request-id';

try {
  const response = await waffo.subscription().change({
    subscriptionRequest,
    originSubscriptionRequest,
    remainingAmount: '50.00',  // Remaining value from original subscription
    currency: 'HKD',
    requestedAt: new Date().toISOString(),
    notifyUrl: 'https://your-site.com/webhook/subscription',
    productInfoList: [
      {
        description: 'Annual Premium Subscription (12 months)',
        periodType: 'MONTHLY',
        periodInterval: '12',
        amount: '999.00',
      },
    ],
    userInfo: {
      userId: 'user_123',
      userEmail: 'user@example.com',
    },
    goodsInfo: {
      goodsId: 'GOODS_PREMIUM',
      goodsName: 'Premium Plan',
    },
    paymentInfo: {
      productName: 'SUBSCRIPTION',
    },
    // Optional fields
    merchantSubscriptionId: `MSUB_UPGRADE_${Date.now()}`,
    successRedirectUrl: 'https://your-site.com/subscription/upgrade/success',
    failedRedirectUrl: 'https://your-site.com/subscription/upgrade/failed',
    cancelRedirectUrl: 'https://your-site.com/subscription/upgrade/cancel',
    subscriptionManagementUrl: 'https://your-site.com/subscription/manage',
  });

  if (response.isSuccess()) {
    const data = response.getData();
    console.log('Change Status:', data.subscriptionChangeStatus);
    console.log('New Subscription ID:', data.subscriptionId);

    // Handle different statuses
    if (data.subscriptionChangeStatus === 'AUTHORIZATION_REQUIRED') {
      // User needs to authorize the change
      const action = JSON.parse(data.subscriptionAction);
      console.log('Redirect user to:', action.webUrl);
    } else if (data.subscriptionChangeStatus === 'SUCCESS') {
      // Change completed successfully
      console.log('Subscription upgraded successfully');
    }
  }
} catch (error) {
  if (error instanceof WaffoUnknownStatusError) {
    // Status unknown - DO NOT assume failure! User may have completed payment
    console.error('Unknown status, need to query:', error.message);

    // Correct handling: Call inquiry API to confirm actual status
    const inquiryResponse = await waffo.subscription().changeInquiry({
      subscriptionRequest,
      originSubscriptionRequest,
    });
    // Or wait for Webhook callback
  } else {
    throw error;
  }
}
Subscription Change Status Values
Status	Description
IN_PROGRESS	Change is being processed
AUTHORIZATION_REQUIRED	User needs to authorize the change (redirect to webUrl)
SUCCESS	Change completed successfully
CLOSED	Change was closed (timeout or failed)
Query Subscription Change Status
const response = await waffo.subscription().changeInquiry({
  subscriptionRequest: 'new-subscription-request-id',
  originSubscriptionRequest: 'original-subscription-request-id',
});

if (response.isSuccess()) {
  const data = response.getData();
  console.log('Change Status:', data.subscriptionChangeStatus);
  console.log('New Subscription ID:', data.subscriptionId);
  console.log('Remaining Amount:', data.remainingAmount);
  console.log('Currency:', data.currency);
}
Refund Query
// Query by refundRequestId (merchant-generated idempotency key)
const response = await waffo.refund().inquiry({
  refundRequestId: 'refund_request_id',
});

// Or query by acquiringRefundOrderId (Waffo refund order ID)
const response = await waffo.refund().inquiry({
  acquiringRefundOrderId: 'acquiring_refund_order_id',
});
Merchant Configuration
Query Merchant Configuration
// merchantId is auto-injected from config if not provided
const response = await waffo.merchantConfig().inquiry({});

if (response.isSuccess()) {
  const data = response.getData();
  console.log('Daily Limit:', data.totalDailyLimit);
  console.log('Remaining Daily Limit:', data.remainingDailyLimit);
  console.log('Transaction Limit:', data.transactionLimit);
}
Query Available Payment Methods
The payMethodDetails response includes the payment method category, supported currency, order amount limits, and refund policy. currentStatus can be absent when real-time availability is temporarily unavailable.

// merchantId is auto-injected from config if not provided
const response = await waffo.payMethodConfig().inquiry({});

if (response.isSuccess()) {
  const data = response.getData();
  for (const detail of data?.payMethodDetails ?? []) {
    console.log({
      name: detail.payMethodName,
      type: detail.payMethodType,
      country: detail.country,
      currency: detail.currency,
      amountRange: [detail.orderAmountMin, detail.orderAmountMax],
      refundAllowed: detail.refundAllowed,
      currentStatus: detail.currentStatus,
    });
  }
} else {
  console.error('Pay method config inquiry failed:', response.getCode(), response.getMessage());
}
Wallet Address Inquiry (x402)
Inquire the on-chain stablecoin receiving address for an x402 payment. The response returns the target network, the on-chain token contract, and the Waffo platform wallet address to send funds to. Phase 1 supports USDC.

// paymentRequestId: unique idempotency key for this inquiry
// orderCurrency: settlement currency of the order (Phase 1 supports USDC)
// merchantInfo is auto-injected from config if not provided
const response = await waffo.wallet().inquiry({
  paymentRequestId: 'unique-request-id',
  orderCurrency: 'USDC',
});

if (response.isSuccess()) {
  const data = response.getData();
  console.log('Network:', data?.network); // CAIP-2 network id, e.g. eip155:8453 (Base mainnet)
  console.log('Asset:', data?.asset);     // on-chain token contract address
  console.log('Pay to:', data?.payTo);    // Waffo platform receiving wallet address
} else {
  console.error('Wallet inquiry failed:', response.getCode(), response.getMessage());
}
Wallet Inquiry Response Fields
Field	Description
network	CAIP-2 network id (Phase 1: eip155:8453, Base mainnet)
asset	On-chain token contract address for the network + currency
payTo	Waffo platform receiving wallet address (send funds here)
Webhook Handling
Waffo pushes payment results, refund results, subscription status changes, and more via webhooks.

Webhook Handler Example
import { Waffo, Environment } from '@waffo/waffo-node';
import express from 'express';

const app = express();
const waffo = new Waffo({ /* config */ });

// Create webhook handler
const webhookHandler = waffo.webhook()
  .onPayment((notification) => {
    console.log('Payment notification received:');
    console.log('  Acquiring Order ID:', notification.result?.acquiringOrderId);
    console.log('  Order Status:', notification.result?.orderStatus);
    console.log('  Payment Amount:', notification.result?.orderAmount);
    console.log('  Payment Currency:', notification.result?.orderCurrency);

    // Tip: First verify amount and currency match your records
    // Then handle based on orderStatus

    if (notification.result?.orderStatus === 'PAY_SUCCESS') {
      // Payment successful - update order status, deliver goods, etc.
    }
  })
  .onRefund((notification) => {
    console.log('Refund notification:', notification.result?.acquiringRefundOrderId);
    // Handle refund notification
  })
  .onSubscriptionStatus((notification) => {
    console.log('Subscription status notification:');
    console.log('  Subscription ID:', notification.result?.subscriptionId);
    console.log('  Subscription Status:', notification.result?.subscriptionStatus);

    switch (notification.result?.subscriptionStatus) {
      case 'ACTIVE':
        // Subscription activated - grant membership privileges
        break;
      case 'CLOSE':
        // Subscription closed (timeout or failed)
        break;
      case 'MERCHANT_CANCELLED':
        // Merchant cancelled subscription
        break;
      case 'USER_CANCELLED':
        // User cancelled subscription
        break;
      case 'CHANNEL_CANCELLED':
        // Channel cancelled subscription
        break;
      case 'EXPIRED':
        // Subscription expired
        break;
    }
  })
  .onSubscriptionPeriodChanged((notification) => {
    console.log('Subscription period changed:', notification.result?.subscriptionId);
    // Key fields to track:
    // - notification.result?.period: Current period number
    // - notification.result?.nextChargeAt: Next billing time
    // - notification.result?.subscriptionStatus: Subscription status
    // - notification.result?.orderStatus: Current billing order status (SUCCESS/FAILED)
    // - notification.result?.orderAmount: Billing amount
    // - notification.result?.orderCurrency: Billing currency
  })
  .onSubscriptionChange((notification) => {
    console.log('Subscription change notification:');
    console.log('  Change Request ID:', notification.result?.subscriptionRequest);
    console.log('  Change Status:', notification.result?.subscriptionChangeStatus);
    console.log('  Origin Subscription:', notification.result?.originSubscriptionId);
    console.log('  New Subscription:', notification.result?.subscriptionId);

    if (notification.result?.subscriptionChangeStatus === 'SUCCESS') {
      // Subscription change successful
      // - Original subscription is now MERCHANT_CANCELLED
      // - New subscription is now ACTIVE
      // Update user's subscription level accordingly
    } else if (notification.result?.subscriptionChangeStatus === 'CLOSED') {
      // Subscription change failed/closed
      // Original subscription remains unchanged
    }
  });

// Express route
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const body = req.body.toString();
  const signature = req.headers['x-signature'] as string;

  const result = await webhookHandler.handleWebhook(body, signature);

  res.setHeader('X-SIGNATURE', result.responseSignature);
  res.status(200).json(result.responseBody);
});
Webhook Notification Types
Event Type	Handler Method	Description
PAYMENT_NOTIFICATION	onPayment()	Payment result notification (triggered on every payment attempt, including retries)
REFUND_NOTIFICATION	onRefund()	Refund result notification
SUBSCRIPTION_STATUS_NOTIFICATION	onSubscriptionStatus()	Subscription status change notification (triggered when subscription main record status changes)
SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION	onSubscriptionPeriodChanged()	Subscription period change notification (final result of each period)
SUBSCRIPTION_CHANGE_NOTIFICATION	onSubscriptionChange()	Subscription change (upgrade/downgrade) result notification
Subscription Notification Types Explained
Notification Type	Trigger Condition	Scope	Includes Retry Events	Typical Use Case
SUBSCRIPTION_STATUS_NOTIFICATION	Subscription main record status changes	Subscription level	No	Track subscription lifecycle: first payment success activation (ACTIVE), cancellation (MERCHANT_CANCELLED, CHANNEL_CANCELLED), first payment failure close (CLOSE), etc.
SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION	Subscription period reaches final state	Period level	No (only final result)	Only need final result of each period, no intermediate retry events
SUBSCRIPTION_CHANGE_NOTIFICATION	Subscription change (upgrade/downgrade) completes	Change request level	No (only final result)	Track subscription change results: SUCCESS or CLOSED
PAYMENT_NOTIFICATION	Every payment order	Payment order level	Yes (includes all retries)	Need complete details of every payment attempt, including failure reasons, timestamps, retry details
Selection Guide:

If you only care about subscription activation/cancellation, use SUBSCRIPTION_STATUS_NOTIFICATION
If you only care about final renewal result of each period, use SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION
If you only care about subscription change (upgrade/downgrade) final result, use SUBSCRIPTION_CHANGE_NOTIFICATION
If you need to track every payment attempt (including retries), use PAYMENT_NOTIFICATION
Subscription Payment Note: Each period's payment (including first payment and renewals) triggers PAYMENT_NOTIFICATION events. You can get subscription-related info (subscriptionId, period, etc.) from subscriptionInfo.

Subscription Change (Upgrade/Downgrade) Webhook Note: When a subscription change is processed, the following notifications are triggered:

SUBSCRIPTION_CHANGE_NOTIFICATION: When subscription change completes (SUCCESS or CLOSED)
SUBSCRIPTION_STATUS_NOTIFICATION: When original subscription status changes to MERCHANT_CANCELLED
SUBSCRIPTION_STATUS_NOTIFICATION: When new subscription status changes to ACTIVE
PAYMENT_NOTIFICATION: If upgrade requires additional payment (price difference)
Webhook Notification Payload Examples
The following examples show the actual payload structure for each notification type.

PAYMENT_NOTIFICATION
{
  "eventType": "PAYMENT_NOTIFICATION",
  "result": {
    "acquiringOrderId": "A2026xxxxxxxxxxxxxxxxxxxx",
    "orderStatus": "PAY_SUCCESS",
    "orderAmount": "109.00",
    "orderCurrency": "USD",
    "finalDealAmount": "109.00",
    "userCurrency": "USD",
    "orderDescription": "Sample Product",
    "orderRequestedAt": "2026-02-28T10:05:58.000Z",
    "orderCompletedAt": "2026-02-28T10:06:10.000Z",
    "orderUpdatedAt": "2026-02-28T10:06:10.000Z",
    "refundExpiryAt": "2026-08-26T23:59:59.999Z",
    "userInfo": {
      "userId": "user@example.com",
      "userEmail": "user@example.com"
    },
    "merchantInfo": {
      "merchantId": "YOUR_MERCHANT_ID"
    },
    "goodsInfo": {
      "goodsId": "goods_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "goodsName": "Sample Product"
    },
    "addressInfo": {},
    "paymentInfo": {
      "productName": "SUBSCRIPTION",
      "payMethodType": "CREDITCARD",
      "payMethodName": "CC_VISA",
      "payMethodProperties": "{\"cardToken\":\"CARD_TOKEN_XXXXXXXXXXXXXXXXXXXX\",\"cardTransactionType\":\"CIT\"}",
      "payMethodResponse": "{\"maskCardData\":\"XXXX42****XX4242\"}"
    },
    "subscriptionInfo": {
      "subscriptionId": "SC2026xxxxxxxxxxxxxxxxxxxxxxxxxx",
      "subscriptionRequest": "sub_req_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "merchantRequest": "sub_req_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "period": "1"
    },
    "cancelRedirectUrl": "https://YOUR_DOMAIN/checkout/YOUR_CHECKOUT_ID"
  }
}
For x402 stablecoin payments, PAYMENT_NOTIFICATION.result also includes x402Info with x402Request, paymentSignatureHeader, and x402Response.

SUBSCRIPTION_STATUS_NOTIFICATION / SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION
These two notification types share the same payload structure:

{
  "eventType": "SUBSCRIPTION_STATUS_NOTIFICATION",
  "result": {
    "subscriptionId": "SC2026xxxxxxxxxxxxxxxxxxxxxxxxxx",
    "subscriptionRequest": "sub_req_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "merchantSubscriptionId": "sub_req_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "subscriptionStatus": "ACTIVE",
    "currency": "USD",
    "userCurrency": "USD",
    "amount": "109.00",
    "requestedAt": "2026-02-28T10:05:58.000Z",
    "updatedAt": "2026-02-28T10:06:10.000Z",
    "userInfo": {
      "userId": "user@example.com",
      "userEmail": "user@example.com"
    },
    "merchantInfo": {
      "merchantId": "YOUR_MERCHANT_ID"
    },
    "goodsInfo": {
      "goodsId": "goods_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "goodsName": "Sample Product"
    },
    "productInfo": {
      "periodType": "MONTHLY",
      "periodInterval": "1",
      "currentPeriod": "1",
      "startDateTime": "2026-02-28T10:06:10.000Z",
      "nextPaymentDateTime": "2026-03-28T10:06:10.000Z",
      "description": "Sample Product"
    },
    "paymentInfo": {
      "productName": "SUBSCRIPTION",
      "payMethodType": "CREDITCARD",
      "payMethodName": "CC_VISA",
      "payMethodProperties": "{}"
    },
    "paymentDetails": [
      {
        "period": "1",
        "acquiringOrderId": "A2026xxxxxxxxxxxxxxxxxxxx",
        "orderAmount": "109.00",
        "orderCurrency": "USD",
        "orderStatus": "PAY_SUCCESS",
        "orderUpdatedAt": "2026-02-28T10:06:10.000Z"
      }
    ]
  }
}
Payment Method Types
payMethodType Reference
Type	Description	Example payMethodName
CREDITCARD	Credit Card	CC_VISA, CC_MASTERCARD, CC_AMEX, CC_JCB, etc.
DEBITCARD	Debit Card	DC_VISA, DC_MASTERCARD, DC_ELO, etc.
EWALLET	E-Wallet	GCASH, DANA, PROMPTPAY, GRABPAY, etc.
VA	Virtual Account	BCA, BNI, BRI, MANDIRI, etc.
APPLEPAY	Apple Pay	APPLEPAY
GOOGLEPAY	Google Pay	GOOGLEPAY
Usage Examples
Specify a type and let the user choose on the checkout page:

{"paymentInfo": {"payMethodType": "CREDITCARD"}}
Specify an exact payment method:

{"paymentInfo": {"payMethodType": "CREDITCARD", "payMethodName": "CC_VISA"}}
Combine multiple types:

{"paymentInfo": {"payMethodType": "CREDITCARD,DEBITCARD"}}
Select an e-wallet channel:

{"paymentInfo": {"payMethodType": "EWALLET", "payMethodName": "GCASH"}}
Note: For available ProductName, PayMethodType, PayMethodName values, merchants can log in to Waffo Portal to view contracted payment methods (Home → Service → Pay-in).

Advanced Configuration
Custom HTTP Transport (axios)
The SDK uses native fetch by default. For connection pooling or advanced features, implement custom transport:

import { Waffo, Environment } from '@waffo/waffo-node';
import type { HttpTransport, HttpRequest, HttpResponse } from '@waffo/waffo-node';
import axios, { AxiosInstance } from 'axios';
import https from 'https';

// Create custom HTTP transport using axios
class AxiosHttpTransport implements HttpTransport {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      httpsAgent: new https.Agent({
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
      }),
    });
  }

  async send(request: HttpRequest): Promise<HttpResponse> {
    try {
      const response = await this.client.request({
        method: request.method as 'POST' | 'GET',
        url: request.url,
        headers: request.headers,
        data: request.body,
        timeout: request.timeout,
        validateStatus: () => true, // Don't throw on non-2xx
      });

      // Convert headers to Record<string, string>
      const headers: Record<string, string> = {};
      Object.entries(response.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      });

      return {
        statusCode: response.status,
        headers,
        body: typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data),
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }
}

const waffo = new Waffo({
  apiKey: 'your-api-key',
  privateKey: 'your-private-key',
  waffoPublicKey: 'waffo-public-key',
  environment: Environment.SANDBOX,
  httpTransport: new AxiosHttpTransport(),
});
TLS Security Configuration
The SDK enforces TLS 1.2 or higher by default for all HTTPS communication.

When implementing custom HTTP transport, ensure TLS 1.2+ is configured:

import https from 'https';

const httpsAgent = new https.Agent({
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  // Optional: reject unauthorized certificates (default: true)
  rejectUnauthorized: true,
});

// Use with axios or other HTTP clients
import axios from 'axios';
const client = axios.create({
  httpsAgent,
});
Debug Logging
Enable debug logging to troubleshoot issues during development:

# Enable all Waffo SDK debug logs
DEBUG=waffo:* npm start

# Enable only HTTP request/response logs
DEBUG=waffo:http npm start

# Enable only signing logs
DEBUG=waffo:sign npm start
Or configure programmatically:

const waffo = new Waffo({
  // ... other config
  logger: {
    debug: (msg: string) => console.debug('[WAFFO]', msg),
    info: (msg: string) => console.info('[WAFFO]', msg),
    warn: (msg: string) => console.warn('[WAFFO]', msg),
    error: (msg: string) => console.error('[WAFFO]', msg),
  },
});
Timeout Configuration Recommendations
Operation Type	Connect Timeout	Read Timeout	Notes
Create Order	5s	30s	Recommended
Create Subscription	5s	30s	Recommended
Refund Operation	5s	30s	Recommended
Query Operations	5s	15s	Can be shorter
Connection Pool Recommendations
Scenario	Max Connections	Max Per Route	Notes
Low Traffic (< 10 QPS)	20	10	Default config sufficient
Medium Traffic (10-100 QPS)	50	20	Consider using OkHttp
High Traffic (> 100 QPS)	100-200	50	Consider Apache HttpClient
Instance Reuse
SDK instances are thread-safe. Recommended to use as singleton in your application:

// Create once, reuse everywhere
const waffo = new Waffo({ /* config */ });

export { waffo };
RSA Utilities
import { RsaUtils } from '@waffo/waffo-node';

// Generate key pair (for testing)
const keyPair = RsaUtils.generateKeyPair();
console.log('Public Key (submit to Waffo):', keyPair.publicKey);
console.log('Private Key (keep on your server):', keyPair.privateKey);

// Sign data
const signature = RsaUtils.sign(data, privateKey);

// Verify signature
const isValid = RsaUtils.verify(data, signature, publicKey);
Handling New API Fields (ExtraParams)
When Waffo API adds new fields that are not yet defined in the SDK, you can use the ExtraParams feature to access these fields without waiting for an SDK update.

Reading Unknown Fields from Responses
// Get extra field from response
const response = await waffo.order().inquiry({ paymentRequestId: 'REQ001' });
if (response.isSuccess()) {
  const data = response.getData();

  // Access field not yet defined in SDK
  const newField = data.extraParams?.['newField'];

  // Or use type assertion if you know the type
  const typedValue = data.extraParams?.['newField'] as string;
}

// Get extra field from webhook notification
webhookHandler.onPaymentNotification((notification) => {
  const result = notification.result;
  const newField = result.extraParams?.['newField'];
});
Sending Extra Fields in Requests
// TypeScript types include index signature [key: string]: unknown
// You can directly add extra fields to any request
const response = await waffo.order().create({
  paymentRequestId: 'REQ001',
  merchantOrderId: 'ORDER001',
  // ... other required fields
  newField: 'value',           // Extra field - no type error
  nested: { key: 123 }         // Nested object - works too
});
Important Notes
Upgrade SDK Promptly

ExtraParams is designed as a temporary solution for accessing new API fields before SDK updates.

Best Practices:

Check SDK release notes regularly for new field support
Once SDK officially supports the field, migrate from getExtraParam("field") to the official getter (e.g., getField())
The SDK logs a warning when you use getExtraParam() on officially supported fields
Why migrate?

Official getters provide type safety
Better IDE auto-completion and documentation
Reduced risk of typos in field names
Error Handling
Error Handling Pattern
SDKs use a hybrid error handling approach:

Business errors: Returned via ApiResponse, check with response.isSuccess()
Unknown status exceptions: Only for write operations (may affect funds or status), network timeout or server returning E0001 error code throws WaffoUnknownStatusError
Methods That Throw Unknown Status Exception
Only these methods that may affect funds or status throw WaffoUnknownStatusError:

Method	Description
order().create()	Create order, may initiate payment
order().refund()	Refund, may cause fund changes
order().cancel()	Cancel order, affects order status
subscription().create()	Create subscription, may cause initial charge
subscription().cancel()	Cancel subscription, affects subscription status
Query methods do not throw this exception (e.g., inquiry()), because query operations can be safely retried without affecting funds or status.

WaffoUnknownStatusError Handling
⚠️ IMPORTANT WARNING

When WaffoUnknownStatusError is caught, it means the operation result is uncertain.

DO NOT directly close the order or assume payment failed! The user may have already completed payment.

Correct handling:

Call waffo.order().inquiry() to query actual order status
Or wait for Waffo webhook callback notification
Use Waffo's returned order status as the final authority
import { Waffo, WaffoUnknownStatusError } from '@waffo/waffo-node';

try {
  const response = await waffo.order().create(params);

  if (response.isSuccess()) {
    // Handle success
    const data = response.getData();
    console.log('Redirect URL:', data.orderAction);
  } else {
    // Handle business error (non-E0001 error code)
    console.log('Error:', response.getMessage());
  }
} catch (error) {
  if (error instanceof WaffoUnknownStatusError) {
    // ⚠️ IMPORTANT: Payment status unknown
    //
    // [WRONG] Do not close order directly! User may have paid
    // [CORRECT]
    //   1. Call inquiry API to query actual order status
    //   2. Or wait for Waffo webhook callback
    //   3. Use Waffo's returned status as authority

    console.warn('Status unknown, need to query:', error.message);

    // Query order status (inquiry doesn't throw, can call directly)
    const inquiryResponse = await waffo.order().inquiry({
      paymentRequestId: params.paymentRequestId,
    });

    if (inquiryResponse.isSuccess()) {
      const status = inquiryResponse.getData().orderStatus;
      console.log('Actual order status:', status);
    } else {
      // Query failed, wait for webhook callback
      console.error('Query failed, waiting for webhook callback');
    }
  } else {
    throw error;
  }
}
WaffoUnknownStatusError Trigger Scenarios
Scenario	Description
Network Timeout	Request timeout, cannot determine if server received request
Connection Failed	Network connection failed, cannot determine server status
E0001 Error Code	Server returned E0001, indicating processing status unknown
Error Code Classification
Error codes are classified by first letter:

Prefix	Category	Description
S	SDK Internal Error	SDK client internal error such as network timeout, signing failure, etc.
A	Merchant Related	Parameter, signature, permission, contract issues on merchant side
B	User Related	User status, balance, authorization issues
C	System Related	Waffo system or payment channel issues
D	Risk Related	Risk control rejection
E	Unknown Status	Server returned unknown status
Complete Error Code Table
SDK Internal Errors (Sxxxx)
Code	Description	Exception Type	Handling Suggestion
S0001	Network Error	WaffoUnknownStatusError	Status unknown, need to query order to confirm
S0002	Invalid Public Key	WaffoError	Check if public key is valid Base64 encoded X509 format
S0003	RSA Signing Failed	WaffoError	Check if private key format is correct
S0004	Response Signature Verification Failed	ApiResponse.error()	Check Waffo public key config, contact Waffo
S0005	Request Serialization Failed	ApiResponse.error()	Check request parameter format
S0006	SDK Unknown Error	ApiResponse.error()	Check logs, contact technical support
S0007	Invalid Private Key	WaffoError	Check if private key is valid Base64 encoded PKCS8 format
Important: S0001 and E0001 (returned by server) indicate unknown status. Do not close order directly! Should call query API or wait for webhook to confirm actual status.

Merchant Related Errors (Axxxxx)
Code	Description	HTTP Status
0	Success	200
A0001	Invalid API Key	401
A0002	Invalid Signature	401
A0003	Parameter Validation Failed	400
A0004	Insufficient Permission	401
A0005	Merchant Limit Exceeded	400
A0006	Merchant Status Abnormal	400
A0007	Unsupported Transaction Currency	400
A0008	Transaction Amount Exceeded	400
A0009	Order Not Found	400
A0010	Merchant Contract Does Not Allow This Operation	400
A0011	Idempotent Parameter Mismatch	400
A0012	Merchant Account Insufficient Balance	400
A0013	Order Already Paid, Cannot Cancel	400
A0014	Refund Rules Do Not Allow Refund	400
A0015	Payment Channel Does Not Support Cancel	400
A0016	Payment Channel Rejected Cancel	400
A0017	Payment Channel Does Not Support Refund	400
A0018	Payment Method Does Not Match Merchant Contract	400
A0019	Cannot Refund Due to Chargeback Dispute	400
A0020	Payment Amount Exceeds Single Transaction Limit	400
A0021	Cumulative Payment Amount Exceeds Daily Limit	400
A0022	Multiple Products Exist, Need to Specify Product Name	400
A0023	Token Expired, Cannot Create Order	400
A0024	Exchange Rate Expired, Cannot Process Order	400
A0026	Unsupported Checkout Language	400
A0027	Refund Count Reached Limit (50 times)	400
A0029	Invalid Card Data Provided by Merchant	400
A0030	Card BIN Not Found	400
A0031	Unsupported Card Scheme or Card Type	400
A0032	Invalid Payment Token Data	400
A0033	Multiple Payment Methods with Same Name, Need to Specify Country	400
A0034	Order Expiry Time Provided by Merchant Has Passed	400
A0035	Current Order Does Not Support Capture Operation	400
A0036	Current Order Status Does Not Allow Capture Operation	400
A0037	User Payment Token Invalid or Expired	400
A0038	MIT Transaction Requires Verified User Payment Token	400
A0039	Order Already Refunded by Chargeback Prevention Service	400
A0040	Order Cannot Be Created Concurrently	400
A0045	MIT Transaction Cannot Process, tokenId Status Unverified	400
User Related Errors (Bxxxxx)
Code	Description	HTTP Status
B0001	User Status Abnormal	400
B0002	User Limit Exceeded	400
B0003	User Insufficient Balance	400
B0004	User Did Not Pay Within Timeout	400
B0005	User Authorization Failed	400
B0006	Invalid Phone Number	400
B0007	Invalid Email Format	400
System Related Errors (Cxxxxx)
Code	Description	HTTP Status
C0001	System Error	500
C0002	Merchant Contract Invalid	500
C0003	Order Status Invalid, Cannot Continue Processing	500
C0004	Order Information Mismatch	500
C0005	Payment Channel Rejected	503
C0006	Payment Channel Error	503
C0007	Payment Channel Under Maintenance	503
Risk Related Errors (Dxxxxx)
Code	Description	HTTP Status
D0001	Risk Control Rejected	406
Unknown Status Errors (Exxxxx)
Code	Description	HTTP Status
E0001	Unknown Status (Need to query or wait for callback)	500
Note: When receiving E0001 error code, it indicates transaction status is unknown. Do not close order directly, should call query API to confirm actual status, or wait for webhook callback notification.

Development & Testing
Build Commands
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format
Generate Types from OpenAPI
# From monorepo root
./scripts/generate-types.sh node
Run Test Vectors
# Run cross-language test vectors
npm run test:vectors
Support
Documentation: Waffo Developer Docs
Issues: GitHub Issues
Technical Support: merchant.support@waffo.com
License
MIT License - See LICENSE file for details.

Readme
Keywords