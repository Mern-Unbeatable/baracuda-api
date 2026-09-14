import prisma from '../../config/prisma.js';

class PaymentService {
  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_SECRET;
    // Use sandbox for development, live for production
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }

  async generateAccessToken() {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Failed to generate PayPal access token');
    return data.access_token;
  }

  async createOneTimeDonation(submissionId, amount, name, email, userId) {
    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new Error('Artwork not found');

    const accessToken = await this.generateAccessToken();

    // Create PayPal Order
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: parseFloat(amount).toFixed(2)
        },
        description: `One-Time Donation for Artwork ${submissionId}`
      }],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
      }
    };

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to create PayPal order');

    // Store in DB as PENDING
    const donation = await prisma.donation.create({
      data: {
        submissionId,
        artistId: submission.userId,
        donorId: userId || null,
        donorName: name,
        donorEmail: email,
        amount,
        currency: 'USD',
        paymentId: data.id, // PayPal Order ID
        status: 'PENDING',
        type: 'ONE_TIME'
      }
    });

    const approveLink = data.links.find(link => link.rel === 'approve');
    return {
      donationId: donation.id,
      paymentId: data.id,
      checkoutUrl: approveLink ? approveLink.href : null
    };
  }

  async captureOneTimeDonation(paymentId) {
    const accessToken = await this.generateAccessToken();

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${paymentId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to capture PayPal order');

    if (data.status === 'COMPLETED') {
      await prisma.donation.updateMany({
        where: { paymentId },
        data: { status: 'COMPLETED' }
      });
      return { status: 'COMPLETED' };
    }
    return { status: data.status };
  }

  async createMonthlyDonation(submissionId, amount, name, email, userId) {
    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new Error('Artwork not found');

    const accessToken = await this.generateAccessToken();

    // Since PayPal Subscriptions require a Pre-created Product and Plan,
    // this usually involves dynamic plan creation or using an existing general plan.
    // For simplicity in this module, we will throw a placeholder error,
    // as dynamic subscription plan creation per amount is complex and usually requires a different setup.
    // NOTE: This can be implemented by creating a product on the fly, then a plan on the fly, then a subscription.
    
    // Create Product
    const productResponse = await fetch(`${this.baseUrl}/v1/catalogs/products`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Monthly Donation for Artwork ${submissionId}`,
        type: 'DIGITAL',
        category: 'DONATION'
      })
    });
    const productData = await productResponse.json();

    // Create Plan
    const planResponse = await fetch(`${this.baseUrl}/v1/billing/plans`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productData.id,
        name: `Monthly Support $${amount}`,
        billing_cycles: [{
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: parseFloat(amount).toFixed(2), currency_code: 'USD' }
          }
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        }
      })
    });
    const planData = await planResponse.json();

    // Create Subscription
    const subResponse = await fetch(`${this.baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planData.id,
        subscriber: {
          name: { given_name: name.split(' ')[0], surname: name.split(' ').slice(1).join(' ') || name },
          email_address: email
        },
        application_context: {
          return_url: `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
        }
      })
    });
    const subData = await subResponse.json();

    const donation = await prisma.donation.create({
      data: {
        submissionId,
        artistId: submission.userId,
        donorId: userId || null,
        donorName: name,
        donorEmail: email,
        amount,
        currency: 'USD',
        subscriptionId: subData.id,
        status: 'PENDING',
        type: 'MONTHLY'
      }
    });

    const approveLink = subData.links.find(link => link.rel === 'approve');
    return {
      donationId: donation.id,
      subscriptionId: subData.id,
      checkoutUrl: approveLink ? approveLink.href : null
    };
  }
}

export default new PaymentService();
