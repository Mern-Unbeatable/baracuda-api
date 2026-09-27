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
        description_pl: data.description_pl || null,
        location: data.location,
        location_pl: data.location_pl || null,
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

  async generateInvoicePdf(id, lang = 'en') {
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
    return InvoicePdfGenerator.generate(advertisement, lang);
  }

  // --- PUBLIC APIs ---

  async getPublicAds(req, pageName) {
    const { UrlUtil } = await import('../../utils/urlUtil.js');

    const where = { 
      status: 'ACTIVE',
      endsAt: { gt: new Date() }
    };
    if (pageName) {
      where.selectPage = { equals: pageName, mode: 'insensitive' };
    }

    const ads = await prisma.advertisement.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return ads.map(ad => {
      const baseResponse = {
        id: ad.id,
        businessName: ad.businessName,
        businessType: ad.businessType,
        description: ad.description,
        description_pl: ad.description_pl,
        media: UrlUtil.getAbsoluteUrl(req, ad.businessImage)
      };

      if (ad.businessType === 'LOCAL') {
        baseResponse.location = ad.location;
        baseResponse.location_pl = ad.location_pl;
      } else if (ad.businessType === 'ONLINE') {
        baseResponse.websiteUrl = ad.websiteUrl;
      }

      return baseResponse;
    });
  }

  // --- ADMIN APIs ---

  async getAllAdvertisements(query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    
    if (query.status) {
      // Map admin's query statuses to DB statuses
      if (query.status === 'PENDING') {
        where.status = 'IN_REVIEW';
      } else if (query.status === 'EXPIRED') {
        where.OR = [
          { status: 'EXPIRED' },
          { status: 'ACTIVE', endsAt: { lt: new Date() } }
        ];
      } else if (query.status === 'ACTIVE') {
        where.status = 'ACTIVE';
        where.endsAt = { gt: new Date() };
      } else {
        where.status = query.status;
      }
    } else {
      // By default, exclude unpaid (PENDING in DB) advertisements
      where.status = { not: 'PENDING' };
    }

    const [data, total] = await Promise.all([
      prisma.advertisement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } }
      }),
      prisma.advertisement.count({ where })
    ]);

    // Map DB statuses back to Admin expected statuses
    const mappedData = data.map(ad => {
      let mappedStatus = ad.status;
      if (ad.status === 'IN_REVIEW') mappedStatus = 'PENDING';
      if (ad.status === 'ACTIVE' && ad.endsAt && ad.endsAt < new Date()) mappedStatus = 'EXPIRED';
      
      return { ...ad, status: mappedStatus };
    });

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getAdvertisementById(id) {
    const advertisement = await prisma.advertisement.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!advertisement) throw new Error('Advertisement not found');
    
    // Map status for Admin
    let mappedStatus = advertisement.status;
    if (advertisement.status === 'IN_REVIEW') mappedStatus = 'PENDING';
    if (advertisement.status === 'ACTIVE' && advertisement.endsAt && advertisement.endsAt < new Date()) mappedStatus = 'EXPIRED';

    return { ...advertisement, status: mappedStatus };
  }

  async updateStatus(id, status) {
    const validStatuses = ['PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Allowed: PENDING, ACTIVE, REJECTED, EXPIRED');
    }

    // Map Admin's input status to DB status
    let dbStatusToSet = status;
    if (status === 'PENDING') dbStatusToSet = 'IN_REVIEW';

    const ad = await prisma.advertisement.findUnique({ where: { id } });
    if (!ad) throw new Error('Advertisement not found');

    const updateData = { status: dbStatusToSet };
    
    // If the admin is publishing (ACTIVE), set the start and end dates
    if (dbStatusToSet === 'ACTIVE' && ad.status !== 'ACTIVE') {
      updateData.startsAt = new Date();
      
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + ad.durationDays);
      updateData.endsAt = endsAt;
    }

    const updatedAd = await prisma.advertisement.update({
      where: { id },
      data: updateData
    });

    // Map status back for Admin response
    let mappedStatus = updatedAd.status;
    if (updatedAd.status === 'IN_REVIEW') mappedStatus = 'PENDING';

    return { ...updatedAd, status: mappedStatus };
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
