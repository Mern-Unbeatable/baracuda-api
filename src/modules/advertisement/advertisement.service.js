import prisma from '../../config/prisma.js';
import paymentService from '../payment/payment.service.js';

export class AdvertisementService {
  async createAdvertisement(data, mediaFile, userId) {
    if (!mediaFile) {
      throw new Error('Business image is required');
    }

    const businessImage = `/uploads/${mediaFile.filename}`;
    let amount = 0;

    if (data.durationDays === 7) amount = 35;
    else if (data.durationDays === 14) amount = 60;
    else if (data.durationDays === 30) amount = 100;
    else throw new Error('Invalid duration days');

    const tempId = data.email + '-' + Date.now();
    const crypto = await import('crypto');
    const advertisementId = crypto.randomUUID();

    // Start PayPal Order Generation and DB Creation CONCURRENTLY to save time
    const paypalPromise = paymentService.createPayPalOrder({
      userId: userId || tempId,
      amount: amount,
      currency: 'USD',
      description: `Advertisement placement for ${data.durationDays} days`,
      customId: JSON.stringify({ type: 'ADVERTISEMENT', duration: data.durationDays })
    });

    const dbPromise = prisma.advertisement.create({
      data: {
        id: advertisementId,
        userId: userId || null,
        name: data.name,
        email: data.email,
        phone: data.phone,
        businessType: data.businessType,
        businessName: data.businessName,
        selectPage: data.selectPage,
        websiteUrl: data.businessType === 'ONLINE' ? data.websiteUrl : null,
        description: data.description,
        location: data.location,
        businessImage,
        durationDays: data.durationDays,
        amount,
        status: 'PENDING'
      }
    });

    // Wait for both to finish
    const [orderData, advertisement] = await Promise.all([paypalPromise, dbPromise]);

    // Link the paymentId to the advertisement record
    await prisma.advertisement.update({
      where: { id: advertisementId },
      data: { paymentId: orderData.order.id }
    });

    advertisement.paymentId = orderData.order.id;

    return {
      advertisement,
      paymentId: orderData.order.id,
      approvalUrl: orderData.approvalUrl
    };
  }

  async generateInvoicePdf(id) {
    const advertisement = await prisma.advertisement.findUnique({
      where: { id }
    });

    if (!advertisement) {
      throw new Error('Advertisement not found');
    }

    if (advertisement.status === 'PENDING') {
      throw new Error('Invoice not available for unpaid advertisements');
    }

    const { InvoicePdfGenerator } = await import('./advertisement.pdf.js');
    return InvoicePdfGenerator.generate(advertisement);
  }

  async capturePayment(paymentId) {
    // Run PayPal capture and DB fetch concurrently to save time
    const [captureData, advertisement] = await Promise.all([
      paymentService.capturePayPalOrder(paymentId),
      prisma.advertisement.findUnique({
        where: { paymentId }
      })
    ]);

    if (!advertisement) {
      throw new Error('Advertisement not found for this payment');
    }

    if (advertisement.status !== 'PENDING') {
      return advertisement; // Already processed
    }

    // 3. Update status to IN_REVIEW. Admin will later set it to ACTIVE and define startsAt/endsAt
    const updatedAd = await prisma.advertisement.update({
      where: { id: advertisement.id },
      data: {
        status: 'IN_REVIEW'
      }
    });

    return updatedAd;
  }
}
