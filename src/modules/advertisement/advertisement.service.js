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

    // Generate unique internal order reference just for PayPal custom_id mapping if needed
    // But we can directly use the advertisement ID.
    const tempId = data.email + '-' + Date.now();

    // Generate PayPal Order
    const orderData = await paymentService.createPayPalOrder({
      userId: userId || tempId, // PayPal service expects some string
      amount: amount,
      currency: 'USD',
      description: `Advertisement placement for ${data.durationDays} days`,
      customId: JSON.stringify({ type: 'ADVERTISEMENT', duration: data.durationDays })
    });

    const paymentId = orderData.order.id;

    // Save to DB as PENDING
    const advertisement = await prisma.advertisement.create({
      data: {
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
        paymentId,
        status: 'PENDING'
      }
    });

    return {
      advertisement,
      paymentId: orderData.order.id,
      approvalUrl: orderData.approvalUrl
    };
  }

  async capturePayment(paymentId) {
    // 1. Capture PayPal Order (this throws an error if it fails)
    await paymentService.capturePayPalOrder(paymentId);

    // 2. Find pending advertisement
    const advertisement = await prisma.advertisement.findUnique({
      where: { paymentId }
    });

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
