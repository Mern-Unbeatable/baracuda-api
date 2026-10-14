import prisma from '../../config/prisma.js';
import paymentService from '../payment/payment.service.js';
import { TranslateUtil } from '../../utils/translate.js';
import { ZipArchive } from 'archiver';
import path from 'path';
import fs from 'fs';

export class MarketplaceService {
  async createPremiumPhoto(userId, data, mediaFiles, sourceLang = 'en') {
    const {
      kind,
      theme,
      zodiacSign,
      zodiacSigns,
      categoryId,
      subcategoryId,
      price,
      resolution,
      quality,
      isAiGenerated,
      copyrightConfirmed,
    } = data;

    let title = data.title;
    let title_pl = data.title;
    let story = data.story;
    let story_pl = data.story;

    const translationPromises = [];
    
    if (title) {
      if (sourceLang === 'pl') {
        translationPromises.push(
          TranslateUtil.translateText(data.title, 'en', 'pl').then(res => { title = res; })
        );
      } else {
        translationPromises.push(
          TranslateUtil.translateText(data.title, 'pl', 'en').then(res => { title_pl = res; })
        );
      }
    }
    
    if (story) {
      if (sourceLang === 'pl') {
        translationPromises.push(
          TranslateUtil.translateText(data.story, 'en', 'pl').then(res => { story = res; })
        );
      } else {
        translationPromises.push(
          TranslateUtil.translateText(data.story, 'pl', 'en').then(res => { story_pl = res; })
        );
      }
    }
    
    if (translationPromises.length > 0) {
      await Promise.all(translationPromises);
    }

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
          title_pl,
          story,
          story_pl,
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
          title_pl: true,
          story: true,
          story_pl: true,
          price: true,
          likesCount: true,
          viewsCount: true,
          createdAt: true,
          // First image only for the card thumbnail
          media: {
            where: { OR: [{ kind: 'IMAGE', slotIndex: 0 }, { kind: 'VIDEO' }] },
            take: 2,
            select: { url: true, slotIndex: true, format: true, zodiacSign: true, kind: true }
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

  async updatePremiumPhoto(id, userId, data, sourceLang = 'en') {
    const photo = await prisma.premiumPhoto.findUnique({ where: { id } });
    if (!photo) throw new Error('Photo not found');
    if (photo.userId !== userId) throw new Error('Unauthorized');

    const translationPromises = [];

    if (data.title) {
      if (sourceLang === 'pl') {
        data.title_pl = data.title;
        translationPromises.push(
          TranslateUtil.translateText(data.title, 'en', 'pl').then(res => { data.title = res; })
        );
      } else {
        translationPromises.push(
          TranslateUtil.translateText(data.title, 'pl', 'en').then(res => { data.title_pl = res; })
        );
      }
    }

    if (data.story !== undefined) {
      if (data.story === null || data.story === '') {
        data.story_pl = null;
      } else {
        if (sourceLang === 'pl') {
          data.story_pl = data.story;
          translationPromises.push(
            TranslateUtil.translateText(data.story, 'en', 'pl').then(res => { data.story = res; })
          );
        } else {
          translationPromises.push(
            TranslateUtil.translateText(data.story, 'pl', 'en').then(res => { data.story_pl = res; })
          );
        }
      }
    }

    if (translationPromises.length > 0) {
      await Promise.all(translationPromises);
    }

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

  async getPublicPremiumPhotos(filters = {}, sort = 'newest', skip = 0, take = 10, viewerId = null) {
    const where = { isActive: true };

    if (filters.kind && filters.kind.toUpperCase() !== 'ALL') {
      where.kind = filters.kind.toUpperCase();
    }
    if (filters.subcategoryId) {
      // If a specific subcategory is provided, we just filter by that exact ID
      where.categoryId = filters.subcategoryId;
    } else if (filters.categoryId) {
      // If only parent category is provided, fetch it and its children
      const categories = await prisma.category.findMany({
        where: {
          OR: [
            { id: filters.categoryId },
            { parentId: filters.categoryId }
          ]
        },
        select: { id: true }
      });
      const categoryIds = categories.map(c => c.id);
      
      if (categoryIds.length > 0) {
        where.categoryId = { in: categoryIds };
      } else {
        where.categoryId = filters.categoryId;
      }
    }
    
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { title_pl: { contains: filters.search, mode: 'insensitive' } },
        { story: { contains: filters.search, mode: 'insensitive' } },
        { story_pl: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { viewsCount: 'desc' };
    } else if (sort === 'most_liked') {
      orderBy = { likesCount: 'desc' };
    }

    const now = new Date();
    
    // Conditions for active promotion vs unpromoted
    const activePromoCondition = { isActive: true, endsAt: { gt: now } };
    const promotedWhere = { ...where, promotions: { some: activePromoCondition } };
    const unpromotedWhere = { ...where, promotions: { none: activePromoCondition } };

    const select = {
      id: true,
      kind: true,
      title: true,
      title_pl: true,
      story: true,
      story_pl: true,
      price: true,
      likesCount: true,
      viewsCount: true,
      createdAt: true,
      media: {
        select: { url: true, format: true },
        orderBy: { slotIndex: 'asc' },
        take: 1
      },
      user: { select: { id: true, name: true, avatar: true } },
      category: { select: { name: true } },
      ...(viewerId && { 
        premiumPhotoLikes: { where: { userId: viewerId }, select: { id: true } },
        savedPremiumPhotos: { where: { userId: viewerId }, select: { id: true } }
      })
    };

    const [promotedCount, unpromotedCount] = await Promise.all([
      prisma.premiumPhoto.count({ where: promotedWhere }),
      prisma.premiumPhoto.count({ where: unpromotedWhere })
    ]);

    const total = promotedCount + unpromotedCount;
    let photos = [];

    if (skip < promotedCount) {
      const promotedTake = Math.min(take, promotedCount - skip);
      const promotedData = await prisma.premiumPhoto.findMany({
        where: promotedWhere, select, orderBy, skip, take: promotedTake
      });
      photos = photos.concat(promotedData);

      if (photos.length < take && unpromotedCount > 0) {
        const unpromotedData = await prisma.premiumPhoto.findMany({
          where: unpromotedWhere, select, orderBy, skip: 0, take: take - photos.length
        });
        photos = photos.concat(unpromotedData);
      }
    } else {
      const unpromotedData = await prisma.premiumPhoto.findMany({
        where: unpromotedWhere, select, orderBy, skip: skip - promotedCount, take
      });
      photos = photos.concat(unpromotedData);
    }
    
    // Map isLiked and isSaved
    const formattedPhotos = photos.map(photo => {
      const isLiked = photo.premiumPhotoLikes && photo.premiumPhotoLikes.length > 0;
      const isSaved = photo.savedPremiumPhotos && photo.savedPremiumPhotos.length > 0;
      delete photo.premiumPhotoLikes;
      delete photo.savedPremiumPhotos;
      return { ...photo, isLiked, isSaved };
    });

    return { data: formattedPhotos, total };
  }

  async getPublicPremiumPhotoDetails(id, viewerId = null) {
    const photo = await prisma.premiumPhoto.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatar: true, createdAt: true, _count: { select: { followers: true, following: true } } } },
        category: true,
        media: {
          orderBy: { slotIndex: 'asc' }
        },
        ...(viewerId && { 
          premiumPhotoLikes: { where: { userId: viewerId }, select: { id: true } },
          savedPremiumPhotos: { where: { userId: viewerId }, select: { id: true } }
        })
      }
    });

    if (photo && viewerId) {
      try {
        await prisma.premiumPhotoView.create({
          data: { premiumPhotoId: id, viewerId }
        });
        // If create succeeds, it means this viewerId hasn't viewed this premium photo before
        await prisma.premiumPhoto.update({
          where: { id },
          data: { viewsCount: { increment: 1 } }
        });
        photo.viewsCount += 1;
      } catch (err) {
        // Unique constraint violation (P2002) means they already viewed it, ignore.
      }
      
      const isLiked = photo.premiumPhotoLikes && photo.premiumPhotoLikes.length > 0;
      const isSaved = photo.savedPremiumPhotos && photo.savedPremiumPhotos.length > 0;
      delete photo.premiumPhotoLikes;
      delete photo.savedPremiumPhotos;
      return { ...photo, isLiked, isSaved };
    }

    return photo;
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

  async toggleLikePremiumPhoto(id, userId) {
    const existingLike = await prisma.premiumPhotoLike.findUnique({
      where: {
        premiumPhotoId_userId: { premiumPhotoId: id, userId }
      }
    });

    if (existingLike) {
      await prisma.$transaction([
        prisma.premiumPhotoLike.delete({ where: { id: existingLike.id } }),
        prisma.premiumPhoto.update({ where: { id }, data: { likesCount: { decrement: 1 } } })
      ]);
      return { liked: false };
    } else {
      await prisma.$transaction([
        prisma.premiumPhotoLike.create({ data: { premiumPhotoId: id, userId } }),
        prisma.premiumPhoto.update({ where: { id }, data: { likesCount: { increment: 1 } } })
      ]);
      return { liked: true };
    }
  }

  async toggleSavePremiumPhoto(id, userId) {
    const photo = await prisma.premiumPhoto.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!photo) throw new Error('Photo not found');
    if (photo.userId === userId) throw new Error('You cannot save your own photo');

    const existingSave = await prisma.savedPremiumPhoto.findUnique({
      where: {
        premiumPhotoId_userId: { premiumPhotoId: id, userId }
      }
    });

    if (existingSave) {
      await prisma.save.delete({ where: { id: existingSave.id } });
      return { message: 'Photo unsaved successfully', saved: false };
    } else {
      await prisma.save.create({
        data: {
          submissionId: id,
          userId
        }
      });
      return { message: 'Photo saved successfully', saved: true };
    }
  }

  async reportPremiumPhoto(id, userId, reason, details) {
    const photo = await prisma.premiumPhoto.findUnique({
      where: { id }
    });
    if (!photo) {
      throw new Error('Premium photo not found');
    }
    if (photo.userId === userId) {
      throw new Error('You cannot report your own photo');
    }

    return prisma.report.create({
      data: {
        premiumPhotoId: id,
        userId,
        reason,
        details
      }
    });
  }

  async createPurchaseOrder(premiumPhotoId, userId, email, fullName) {
    const photo = await prisma.premiumPhoto.findUnique({ where: { id: premiumPhotoId } });
    if (!photo) throw new Error('Premium photo not found');

    // Create PayPal order
    const customData = JSON.stringify({ premiumPhotoId });
    const orderData = await paymentService.createPayPalOrder({
      userId,
      amount: photo.price,
      currency: 'GBP',
      description: `Purchase Premium Photo - ${photo.id}`,
      customId: customData
    });

    // Save pending order
    const order = await prisma.order.create({
      data: {
        userId: userId || null, // allow guest
        email,
        fullName,
        total: photo.price,
        currency: 'GBP',
        status: 'PENDING',
        paymentMethod: 'PAYPAL',
        paymentId: orderData.order.id,
        items: {
          create: [{ premiumPhotoId, price: photo.price }]
        }
      }
    });

    return {
      orderId: order.id,
      paymentId: orderData.order.id,
      approvalUrl: orderData.approvalUrl
    };
  }

  async capturePurchaseOrder(paymentId) {
    // Run PayPal capture and DB order fetch CONCURRENTLY to save time!
    const [captureData, order] = await Promise.all([
      paymentService.capturePayPalOrder(paymentId),
      prisma.order.findFirst({
        where: { paymentId },
        include: { items: true }
      })
    ]);

    if (!order) throw new Error('Order not found for this payment');

    // Update order status to PAID and fetch photo details
    const updateOrderPromise = prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
      include: {
        items: {
          include: {
            premiumPhoto: {
              select: {
                id: true,
                title: true,
                title_pl: true,
                media: { orderBy: { slotIndex: 'asc' }, take: 1, select: { url: true, format: true } }
              }
            }
          }
        }
      }
    });

    const updatePromises = [updateOrderPromise];

    // Update total sales for the premium photo concurrently
    if (order.items && order.items.length > 0) {
      updatePromises.push(
        prisma.premiumPhoto.update({
          where: { id: order.items[0].premiumPhotoId },
          data: { totalSales: { increment: 1 } }
        })
      );
    }

    const [updatedOrder] = await Promise.all(updatePromises);
    return updatedOrder;
  }

  async downloadPurchasedPhoto(premiumPhotoId, userId, orderId) {
    // Verify purchase
    let orderWhere = { status: 'PAID', items: { some: { premiumPhotoId } } };
    
    if (userId) {
      orderWhere.userId = userId;
    } else if (orderId) {
      orderWhere.id = orderId;
    } else {
      throw new Error('Unauthorized access');
    }

    const validOrder = await prisma.order.findFirst({
      where: orderWhere
    });

    if (!validOrder) {
      throw new Error('Not purchased');
    }

    // Get all media for this photo
    const photo = await prisma.premiumPhoto.findUnique({
      where: { id: premiumPhotoId },
      include: { media: { orderBy: { slotIndex: 'asc' } } }
    });

    if (!photo || !photo.media || photo.media.length === 0) {
      throw new Error('No media found for this photo');
    }

    // Generate Zip Stream
    const archive = new ZipArchive({ zlib: { level: 9 } });

    photo.media.forEach((m, i) => {
      // url usually contains relative path, we need to map to physical file
      // assuming uploads folder is in root
      const fileUrl = m.url.startsWith('/') ? m.url.slice(1) : m.url;
      const filePath = path.resolve(process.cwd(), fileUrl);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        archive.file(filePath, { name: `${photo.kind}_media_${i + 1}${ext}` });
      } else {
        console.warn(`File not found for zipping: ${filePath}`);
      }
    });

    archive.finalize();
    return archive;
  }

  async getMyPurchaseStats(userId) {
    const orders = await prisma.order.findMany({
      where: { userId, status: 'PAID' },
      include: { items: true }
    });

    let totalPurchases = 0;
    let totalSpent = 0;

    orders.forEach(order => {
      totalSpent += parseFloat(order.total);
      totalPurchases += order.items.length;
    });

    return {
      totalPurchases,
      totalSpent: totalSpent.toFixed(2),
      availableDownloads: totalPurchases // assuming all purchased items can be downloaded
    };
  }

  async getMyPurchases(userId, skip = 0, take = 10) {
    const [items, total] = await Promise.all([
      prisma.orderItem.findMany({
        where: { order: { userId, status: 'PAID' } },
        include: {
          order: { select: { createdAt: true, paymentMethod: true, paymentId: true } },
          premiumPhoto: {
            select: {
              id: true,
              title: true,
              title_pl: true,
              price: true,
              license: true,
              user: { select: { name: true, avatar: true } },
              media: { orderBy: { slotIndex: 'asc' }, take: 1, select: { url: true, format: true } }
            }
          }
        },
        orderBy: { order: { createdAt: 'desc' } },
        skip,
        take
      }),
      prisma.orderItem.count({
        where: { order: { userId, status: 'PAID' } }
      })
    ]);

    return { data: items, total };
  }
}
