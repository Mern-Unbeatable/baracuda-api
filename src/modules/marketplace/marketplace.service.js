import prisma from '../../config/prisma.js';

export class MarketplaceService {
  async createPremiumPhoto(userId, data, mediaFiles) {
    const {
      kind,
      theme,
      zodiacSign,
      zodiacSigns,
      categoryId,
      subcategoryId,
      title,
      price,
      resolution,
      quality,
      isAiGenerated,
      copyrightConfirmed,
    } = data;

    // Map images and videos like artwork
    let imageMedias = [];
    let videoMedias = [];

    const images = mediaFiles.filter(f => f.fieldname === 'images');
    const videos = mediaFiles.filter(f => f.fieldname === 'video');

    if (kind === 'TWELVE') {
      const parsedSigns = typeof zodiacSigns === 'string' ? JSON.parse(zodiacSigns) : zodiacSigns;
      const signsOrder = parsedSigns || ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];
      imageMedias = images.map((file, index) => ({
        kind: 'IMAGE',
        slotIndex: index,
        zodiacSign: signsOrder[index] || null,
        url: `/uploads/${file.filename}`,
        format: file.mimetype,
        bytes: file.size,
      }));
    } else if (kind === 'SIX') {
      const ZODIAC_SIGNS = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];
      imageMedias = images.map((file, index) => {
        let mappedSign = null;
        if (theme === 'RED') {
          mappedSign = ZODIAC_SIGNS[index] || null; // 0 to 5
        } else if (theme === 'BLUE') {
          mappedSign = ZODIAC_SIGNS[index + 6] || null; // 6 to 11
        }
        return {
          kind: 'IMAGE',
          slotIndex: theme === 'BLUE' ? index + 6 : index,
          zodiacSign: mappedSign,
          url: `/uploads/${file.filename}`,
          format: file.mimetype,
          bytes: file.size,
        };
      });
    } else {
      // SINGLE
      imageMedias = images.map((file, index) => ({
        kind: 'IMAGE',
        slotIndex: index,
        url: `/uploads/${file.filename}`,
        format: file.mimetype,
        bytes: file.size,
      }));
    }

    if (videos.length > 0) {
      videoMedias = videos.map(file => ({
        kind: 'VIDEO',
        slotIndex: 0,
        url: `/uploads/${file.filename}`,
        format: file.mimetype,
        bytes: file.size,
      }));
    }

    const allMedia = [...imageMedias, ...videoMedias];

    // Use $transaction to insert photo + media in one round trip
    const [premiumPhoto] = await prisma.$transaction([
      prisma.premiumPhoto.create({
        data: {
          userId,
          kind,
          theme: theme || null,
          zodiacSign: zodiacSign || null,
          categoryId: categoryId || null,
          title,
          price,
          resolution: resolution || null,
          quality: quality || null,
          isAiGenerated: isAiGenerated || false,
          copyrightConfirmed: copyrightConfirmed || false,
          media: {
            create: allMedia
          }
        },
        // Only select id — caller only needs the id for the response
        select: { id: true }
      })
    ]);

    return premiumPhoto;
  }

  async getAllPremiumPhotos(filters = {}, skip = 0, take = 10) {
    const where = { isActive: true };

    if (filters.userId) where.userId = filters.userId;
    if (filters.kind && filters.kind.toUpperCase() !== 'ALL') {
      where.kind = filters.kind.toUpperCase();
    }
    if (filters.categoryId) where.categoryId = filters.categoryId;

    const orderBy = [
      { totalSales: 'desc' },
      { createdAt: 'desc' }
    ];

    const [photos, total] = await Promise.all([
      prisma.premiumPhoto.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          kind: true,
          title: true,
          price: true,
          likesCount: true,
          viewsCount: true,
          createdAt: true,
          // First image only for the card thumbnail
          media: {
            where: { kind: 'IMAGE', slotIndex: 0 },
            take: 1,
            select: { url: true }
          }
        }
      }),
      prisma.premiumPhoto.count({ where })
    ]);

    return { data: photos, total };
  }

  async getPremiumPhotoById(id) {
    return prisma.premiumPhoto.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatar: true, createdAt: true, _count: { select: { followers: true, following: true } } } },
        category: true,
        media: true,
        promotions: {
          where: { isActive: true, endsAt: { gt: new Date() } }
        }
      }
    });
  }

  async updatePremiumPhoto(id, userId, data) {
    const photo = await prisma.premiumPhoto.findUnique({ where: { id } });
    if (!photo) throw new Error('Photo not found');
    if (photo.userId !== userId) throw new Error('Unauthorized');

    return prisma.premiumPhoto.update({
      where: { id },
      data,
      select: { id: true }
    });
  }

  async deletePremiumPhoto(id, userId) {
    const photo = await prisma.premiumPhoto.findUnique({ where: { id } });
    if (!photo) throw new Error('Photo not found');
    if (photo.userId !== userId) throw new Error('Unauthorized');

    return prisma.premiumPhoto.update({
      where: { id },
      data: { isActive: false }
    });
  }

  async applyPromotion(premiumPhotoId, userId, tierId, durationDays, startsAt, endsAt, amountPaid) {
    return prisma.promotedAlbum.create({
      data: {
        premiumPhotoId,
        userId,
        tierId,
        durationDays,
        startsAt,
        endsAt,
        amountPaid,
        isActive: true
      }
    });
  }
}
