import prisma from "../../config/prisma.js";

class PaymentService {
  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_SECRET;
    // Use sandbox for development, live for production
    this.baseUrl =
      process.env.NODE_ENV === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
        
    // Token Cache
    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  async generateAccessToken() {
    // Return cached token if valid
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      "base64",
    );
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error_description || "Failed to generate PayPal access token",
      );
      
    // Cache the token (subtracting 5 minutes for buffer)
    this.cachedToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    
    return data.access_token;
  }

  async createOneTimeDonation(submissionId, amount, name, email, userId) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new Error("Artwork not found");

    const accessToken = await this.generateAccessToken();

    // Create PayPal Order
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: parseFloat(amount).toFixed(2),
          },
          description: `One-Time Donation for Artwork ${submissionId}`,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: process.env.FRONTEND_URL
              ? `${process.env.FRONTEND_URL}/payment/success`
              : `http://localhost:3000/payment/success`,
            cancel_url: process.env.FRONTEND_URL
              ? `${process.env.FRONTEND_URL}/payment/cancel`
              : `http://localhost:3000/payment/cancel`,
            landing_page: "GUEST_CHECKOUT",
            user_action: "PAY_NOW",
            payment_method_preference: "UNRESTRICTED"
          }
        }
      },
    };

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(
        "PayPal Order Error Details:",
        JSON.stringify(data, null, 2),
      );
      throw new Error(data.message || "Failed to create PayPal order");
    }

    // Store in DB as PENDING
    const donation = await prisma.donation.create({
      data: {
        submissionId,
        artistId: submission.userId,
        donorId: userId || null,
        donorName: name,
        donorEmail: email,
        amount,
        currency: "USD",
        paymentId: data.id, // PayPal Order ID
        status: "PENDING",
        type: "ONE_TIME",
      },
    });

    const approveLink = data.links.find(
      (link) => link.rel === "approve" || link.rel === "payer-action"
    );
    return {
      donationId: donation.id,
      paymentId: data.id,
      checkoutUrl: approveLink ? approveLink.href : null,
    };
  }

  async captureOneTimeDonation(paymentId) {
    const accessToken = await this.generateAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paymentId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to capture PayPal order");

    if (data.status === "COMPLETED") {
      await prisma.donation.updateMany({
        where: { paymentId },
        data: { status: "COMPLETED" },
      });

      // Fetch the donation record to generate invoice
      const donation = await prisma.donation.findFirst({
        where: { paymentId },
        include: { artist: true }
      });

      if (donation) {
        const amountPaid = parseFloat(donation.amount);
        const platformFee = amountPaid * 0.10; // 10% fee
        const artistReceives = amountPaid - platformFee;

        return { 
          status: "COMPLETED",
          invoice: {
            artistName: donation.artist.username || donation.artist.name || "Artist",
            amountPaid: amountPaid.toFixed(2),
            platformFee: platformFee.toFixed(2),
            artistReceives: artistReceives.toFixed(2),
            paymentMethod: "PayPal",
            transactionId: data.id,
            date: new Date().toISOString()
          }
        };
      }

      return { status: "COMPLETED" };
    }
    return { status: data.status };
  }

  async createMonthlyDonation(submissionId, amount, name, email, userId) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new Error("Artwork not found");

    const accessToken = await this.generateAccessToken();

    // Since PayPal Subscriptions require a Pre-created Product and Plan,
    // this usually involves dynamic plan creation or using an existing general plan.
    // For simplicity in this module, we will throw a placeholder error,
    // as dynamic subscription plan creation per amount is complex and usually requires a different setup.
    // NOTE: This can be implemented by creating a product on the fly, then a plan on the fly, then a subscription.

    // Create Product
    const productResponse = await fetch(
      `${this.baseUrl}/v1/catalogs/products`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Monthly Donation for Artwork ${submissionId}`,
          type: "DIGITAL",
          category: "DONATION",
        }),
      },
    );
    const productData = await productResponse.json();

    // Create Plan
    const planResponse = await fetch(`${this.baseUrl}/v1/billing/plans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productData.id,
        name: `Monthly Support $${amount}`,
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: parseFloat(amount).toFixed(2),
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });
    const planData = await planResponse.json();

    // Create Subscription
    const subResponse = await fetch(
      `${this.baseUrl}/v1/billing/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: planData.id,
          subscriber: {
            name: {
              given_name: name.split(" ")[0],
              surname: name.split(" ").slice(1).join(" ") || name,
            },
            email_address: email,
          },
          application_context: {
            return_url: process.env.FRONTEND_URL
              ? `${process.env.FRONTEND_URL}/payment/success`
              : `http://localhost:3000/payment/success`,
            cancel_url: process.env.FRONTEND_URL
              ? `${process.env.FRONTEND_URL}/payment/cancel`
              : `http://localhost:3000/payment/cancel`,
            landing_page: "BILLING",
            user_action: "SUBSCRIBE_NOW",
          },
        }),
      },
    );
    const subData = await subResponse.json();
    if (!subResponse.ok) {
      console.error(
        "PayPal Subscription Error Details:",
        JSON.stringify(subData, null, 2),
      );
      throw new Error(
        subData.message || "Failed to create PayPal subscription",
      );
    }

    const donation = await prisma.donation.create({
      data: {
        submissionId,
        artistId: submission.userId,
        donorId: userId || null,
        donorName: name,
        donorEmail: email,
        amount,
        currency: "USD",
        subscriptionId: subData.id,
        status: "PENDING",
        type: "MONTHLY",
      },
    });

    const approveLink = subData.links.find((link) => link.rel === "approve");
    return {
      donationId: donation.id,
      subscriptionId: subData.id,
      checkoutUrl: approveLink ? approveLink.href : null,
    };
  }
  async createPromotionPayment(submissionId, durationDays, userId) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new Error("Artwork not found");
    if (submission.userId !== userId) throw new Error("Unauthorized");

    let amount = 0;
    if (durationDays === 7) amount = 40;
    else if (durationDays === 15) amount = 60;
    else if (durationDays === 30) amount = 100;
    else throw new Error("Invalid promotion duration");

    const accessToken = await this.generateAccessToken();

    // Create PayPal Order
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: parseFloat(amount).toFixed(2),
          },
          description: `Promoted Artwork ${submissionId} for ${durationDays} days`,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: process.env.FRONTEND_URL
              ? `${process.env.FRONTEND_URL}/payment/success`
              : `http://localhost:3000/payment/success`,
            cancel_url: process.env.FRONTEND_URL
              ? `${process.env.FRONTEND_URL}/payment/cancel`
              : `http://localhost:3000/payment/cancel`,
            landing_page: "GUEST_CHECKOUT",
            user_action: "PAY_NOW",
            payment_method_preference: "UNRESTRICTED"
          }
        }
      },
    };

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(
        "PayPal Order Error Details (Promotion):",
        JSON.stringify(data, null, 2),
      );
      throw new Error(data.message || "Failed to create PayPal order");
    }

    // Store in DB as PENDING Payment
    const payment = await prisma.payment.create({
      data: {
        userId,
        purpose: "PROMOTION",
        amount,
        currency: "USD",
        status: "PENDING",
        provider: "PAYPAL",
        providerRef: data.id,
        submissionId,
        metadata: { durationDays },
      },
    });

    const approveLink = data.links.find(
      (link) => link.rel === "approve" || link.rel === "payer-action"
    );
    return {
      paymentId: data.id,
      checkoutUrl: approveLink ? approveLink.href : null,
    };
  }

  async capturePromotionPayment(paymentId) {
    const accessToken = await this.generateAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paymentId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();
    
    let isCompleted = false;
    if (response.ok && data.status === "COMPLETED") {
      isCompleted = true;
    } else if (!response.ok) {
      // Check if it's already captured
      const isAlreadyCaptured = data.details && data.details.some(d => d.issue === "ORDER_ALREADY_CAPTURED");
      if (isAlreadyCaptured) {
        isCompleted = true;
      } else {
        throw new Error(data.message || "Failed to capture PayPal order");
      }
    }

    if (isCompleted) {
      const payment = await prisma.payment.findFirst({
        where: { providerRef: paymentId, status: "PENDING" },
      });

      if (payment) {
        // Mark payment as PAID
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "PAID" },
        });
        
        // Dynamically import artworkService to avoid circular dependency
        const { ArtworkService } = await import("../artwork/artwork.service.js");
        const artworkService = new ArtworkService();
        
        // Activate the promotion
        await artworkService.promoteArtwork(
          payment.submissionId,
          payment.userId,
          payment.metadata.durationDays
        );
        
        return { success: true, paymentId };
      }
    }
    return { success: false, status: data.status };
  }
  async createPayPalOrder({ userId, amount, currency, description, customId }) {
    const accessToken = await this.generateAccessToken();

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency || "GBP",
            value: parseFloat(amount).toFixed(2),
          },
          description: description || "PayPal Order",
          custom_id: customId
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: process.env.FRONTEND_URL
              ? `${process.env.FRONTEND_URL}/payment/success`
              : `http://localhost:3000/payment/success`,
            cancel_url: process.env.FRONTEND_URL
              ? `${process.env.FRONTEND_URL}/payment/cancel`
              : `http://localhost:3000/payment/cancel`,
            landing_page: "GUEST_CHECKOUT",
            user_action: "PAY_NOW",
            payment_method_preference: "UNRESTRICTED"
          }
        }
      },
    };

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("PayPal Order Error Details:", JSON.stringify(data, null, 2));
      throw new Error(data.message || "Failed to create PayPal order");
    }

    const approveLink = data.links.find(
      (link) => link.rel === "approve" || link.rel === "payer-action"
    );

    return {
      order: data,
      approvalUrl: approveLink ? approveLink.href : null,
    };
  }

  async capturePayPalOrder(paymentId) {
    const accessToken = await this.generateAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paymentId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    let data = await response.json();
    
    let isCompleted = false;
    if (response.ok && data.status === "COMPLETED") {
      isCompleted = true;
    } else if (!response.ok) {
      const isAlreadyCaptured = data.details && data.details.some(d => d.issue === "ORDER_ALREADY_CAPTURED");
      if (isAlreadyCaptured) {
        isCompleted = true;
      } else {
        throw new Error(data.message || "Failed to capture PayPal order");
      }
    }

    if (isCompleted) {
      // Always fetch the actual order details since the capture response might lack custom_id
      const orderRes = await fetch(`${this.baseUrl}/v2/checkout/orders/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (orderRes.ok) {
        data = await orderRes.json();
      }
      return data.purchase_units && data.purchase_units[0] ? data.purchase_units[0] : data;
    }
    
    throw new Error(`Order capture failed with status: ${data.status}`);
  }
}

export default new PaymentService();
