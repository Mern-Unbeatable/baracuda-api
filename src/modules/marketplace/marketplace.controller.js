import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { UrlUtil } from '../../utils/urlUtil.js';
import paymentService from '../payment/payment.service.js';
import { watermarkService } from '../artwork/watermark.service.js';
import prisma from '../../config/prisma.js';

export class MarketplaceController {
  constructor(marketplaceService) {
    this.marketplaceService = marketplaceService;
    this.paymentService = paymentService;
  }

  formatMediaUrls(req, photo) {
    if (!photo) return photo;
    const formatted = { ...photo };

    // Format all user avatars
    const formatAvatars = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(formatAvatars);
      } else {
        if (obj.avatar && typeof obj.avatar === 'string' && !obj.avatar.startsWith('http')) {
          obj.avatar = UrlUtil.getAbsoluteUrl(req, obj.avatar);
        }
        Object.values(obj).forEach(formatAvatars);
      }
    };
    formatAvatars(formatted);

    if (!formatted.media) return formatted;

    if (formatted.kind === 'TWELVE' || formatted.kind === 'SIX' || formatted.kind === 'SINGLE') {
      const mappedImages = {};
      const videos = [];
      formatted.media.forEach(m => {
        const url = UrlUtil.getAbsoluteUrl(req, m.url);
        if (m.kind === 'VIDEO' || (m.format && m.format.startsWith('video'))) {
          videos.push({ ...m, url });
        } else {
          const key = m.zodiacSign ? m.zodiacSign : `IMAGE_${m.slotIndex}`;
          mappedImages[key] = { ...m, url };
        }
      });
      formatted.images = mappedImages;
      formatted.video = videos.length > 0 ? videos[0] : null;
      delete formatted.media;
    } else {
      formatted.media = formatted.media.map(m => ({
        ...m,
        url: UrlUtil.getAbsoluteUrl(req, m.url)
      }));
    }
    return formatted;
  }

  createPremiumPhoto = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      
      const {
        kind,
        theme,
        zodiacSign,
        categoryId,
        subcategoryId,
        title,
        price,
        resolution,
        quality,
        isAiGenerated,
        copyrightConfirmed,
        zodiacSigns
      } = req.validatedBody || req.body;

      const imageFiles = req.files && req.files['images'] ? req.files['images'] : [];
      const videoFiles = req.files && req.files['video'] ? req.files['video'] : [];
      const mediaFiles = [...imageFiles, ...videoFiles];

      const parsedTitle = typeof title === 'string' ? JSON.parse(title) : title;
      const aiGenerated = isAiGenerated === 'true' || isAiGenerated === true;

      const data = {
        kind,
        theme: theme || null,
        zodiacSign: zodiacSign || null,
        zodiacSigns,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        title: parsedTitle,
        price: parseFloat(price),
        resolution: resolution || null,
        quality: quality || null,
        isAiGenerated: aiGenerated,
        copyrightConfirmed: copyrightConfirmed === 'true' || copyrightConfirmed === true,
      };

      const photo = await this.marketplaceService.createPremiumPhoto(userId, data, mediaFiles);
      
      // Apply AI watermark in background if needed
      if (aiGenerated) {
        watermarkService.applyWatermarkInBackground(mediaFiles, true).catch(console.error);
      }

      return ResponseUtil.actionSuccess(res, 'Premium photo created successfully', photo.id, 201);
    } catch (error) {
      console.error('Error creating premium photo:', error);
      return ResponseUtil.error(res, error.message || 'Error creating premium photo', 500);
    }
  }

  getAllPremiumPhotos = async (req, res) => {
    try {
      const { kind, categoryId, username } = req.query;
      let userId = req.user?.id; // default to logged in user if applicable

      if (username) {
        const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
        if (!user) return ResponseUtil.error(res, 'User not found', 404);
        userId = user.id;
      }
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);

      const result = await this.marketplaceService.getAllPremiumPhotos(
        { kind, categoryId, userId },
        skip,
        take
      );

      const formattedData = result.data.map(p => this.formatMediaUrls(req, p));

      return ResponseUtil.success(res, 'Premium photos fetched successfully', {
        data: formattedData,
        meta: PaginationUtil.getMetadata(result.total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, 'Error fetching premium photos', 500);
    }
  }

  getPremiumPhotoById = async (req, res) => {
    try {
      const photo = await this.marketplaceService.getPremiumPhotoById(req.params.id);
      if (!photo) return ResponseUtil.error(res, 'Premium photo not found', 404);

      const formattedData = this.formatMediaUrls(req, photo);
      return ResponseUtil.success(res, 'Premium photo details fetched', formattedData);
    } catch (error) {
      return ResponseUtil.error(res, 'Error fetching premium photo', 500);
    }
  }

  updatePremiumPhoto = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      
      const { title, story, price } = req.validatedBody || req.body;
      const parsedTitle = typeof title === 'string' ? JSON.parse(title) : title;
      const parsedStory = typeof story === 'string' ? JSON.parse(story) : story;

      const updateData = {
        title: parsedTitle || undefined,
        story: parsedStory !== undefined ? parsedStory : undefined,
        price: price ? parseFloat(price) : undefined,
        camera: req.body.camera,
        resolution: req.body.resolution,
        license: req.body.license,
      };

      // Remove undefined keys
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      const photo = await this.marketplaceService.updatePremiumPhoto(req.params.id, userId, updateData);
      return ResponseUtil.success(res, 'Premium photo updated successfully', { id: photo.id });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  deletePremiumPhoto = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      await this.marketplaceService.deletePremiumPhoto(req.params.id, userId);
      return ResponseUtil.actionSuccess(res, 'Premium photo deleted successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  savePremiumPhoto = async (req, res) => {
    try {
      const result = await this.marketplaceService.savePremiumPhoto(req.params.id, req.user.id);
      return ResponseUtil.success(res, result.message, result);
    } catch (error) {
      return ResponseUtil.error(res, error.message || 'Error saving premium photo', error.message ? 400 : 500);
    }
  };

  reportPremiumPhoto = async (req, res) => {
    try {
      const { reason, details } = req.body;
      if (!reason) {
        return ResponseUtil.error(res, 'Report reason is required', 400);
      }
      const result = await this.marketplaceService.reportPremiumPhoto(req.params.id, req.user.id, reason, details);
      return ResponseUtil.success(res, 'Report submitted successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message || 'Error reporting premium photo', error.message ? 400 : 500);
    }
  };

  promotePremiumPhoto = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      const { durationDays } = req.validatedBody || req.body;

      const tierId = req.body.tierId || 'MOCK_TIER_ID';
      const amount = (durationDays === 7 ? 5 : durationDays === 15 ? 10 : 20);

      const { order, approvalUrl } = await this.paymentService.createPayPalOrder({
        userId,
        amount,
        currency: 'GBP',
        description: `Promotion for premium photo ${id} for ${durationDays} days`,
        customId: JSON.stringify({ premiumPhotoId: id, tierId, durationDays })
      });

      return ResponseUtil.success(res, 'Promotion checkout created', {
        paymentId: order.id,
        approvalUrl
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message || 'Error creating promotion payment', 500);
    }
  }

  capturePromotion = async (req, res) => {
    try {
      const { paymentId } = req.body;
      if (!paymentId) return ResponseUtil.error(res, 'paymentId is required', 400);

      const captureData = await this.paymentService.capturePayPalOrder(paymentId);
      console.log('Capture Data:', JSON.stringify(captureData, null, 2));
      const customData = JSON.parse(captureData.custom_id || '{}');
      
      const { premiumPhotoId, tierId, durationDays } = customData;
      
      if (!premiumPhotoId || !durationDays) {
         return ResponseUtil.error(res, 'Invalid custom data in PayPal order', 400);
      }

      // Mark the PremiumPhoto as promoted using Prisma directly here, 
      // or move to a service method if needed.
      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + durationDays);

      const promotion = await this.marketplaceService.applyPromotion(premiumPhotoId, req.user?.id || 'TEST_USER_ID', tierId, durationDays, startsAt, endsAt, parseFloat(captureData.amount?.value || 0));

      return ResponseUtil.success(res, 'Promotion applied successfully', promotion);
    } catch (error) {
      return ResponseUtil.error(res, error.message || 'Error capturing payment', 500);
    }
  }
  getPublicPremiumPhotos = async (req, res) => {
    try {
      const { kind, categoryId, subcategoryId, sort, search } = req.query;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);
      const viewerId = req.user?.id;

      const result = await this.marketplaceService.getPublicPremiumPhotos(
        { kind, categoryId, subcategoryId, search },
        sort || 'newest',
        skip,
        take,
        viewerId
      );

      const formattedData = result.data.map(p => this.formatMediaUrls(req, p));

      return ResponseUtil.success(res, 'Public premium photos fetched', {
        data: formattedData,
        meta: PaginationUtil.getMetadata(result.total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getPublicPremiumPhotoDetails = async (req, res) => {
    try {
      const viewerId = req.user?.id || req.ip;
      const photo = await this.marketplaceService.getPublicPremiumPhotoDetails(req.params.id, viewerId);
      if (!photo) return ResponseUtil.error(res, 'Premium photo not found', 404);

      const formattedData = this.formatMediaUrls(req, photo);
      return ResponseUtil.success(res, 'Premium photo details fetched', formattedData);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  likePremiumPhoto = async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await this.marketplaceService.toggleLikePremiumPhoto(req.params.id, userId);
      const msg = result.liked ? 'Photo liked successfully' : 'Photo unliked successfully';
      return ResponseUtil.success(res, msg, result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  buyPremiumPhoto = async (req, res) => {
    try {
      const { email, fullName } = req.body;
      if (!email || !fullName) return ResponseUtil.error(res, 'Email and full name are required', 400);
      
      const userId = req.user?.id; // guest allowed
      const result = await this.marketplaceService.createPurchaseOrder(req.params.id, userId, email, fullName);
      
      return ResponseUtil.success(res, 'Purchase checkout created', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  capturePurchase = async (req, res) => {
    try {
      const { paymentId } = req.body;
      if (!paymentId) return ResponseUtil.error(res, 'paymentId is required', 400);

      const result = await this.marketplaceService.capturePurchaseOrder(paymentId);

      if (result.items && result.items.length > 0 && result.items[0].premiumPhoto) {
        result.items[0].premiumPhoto = this.formatMediaUrls(req, result.items[0].premiumPhoto);
      }

      return ResponseUtil.success(res, 'Purchase successful', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  downloadPurchasedPhoto = async (req, res) => {
    try {
      const userId = req.user?.id;
      const { orderId } = req.query; // If guest, they can provide orderId from email receipt

      const zipStream = await this.marketplaceService.downloadPurchasedPhoto(req.params.id, userId, orderId);
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="premium_photo_${req.params.id}.zip"`);
      zipStream.pipe(res);
    } catch (error) {
      if (!res.headersSent) {
        return ResponseUtil.error(res, error.message, (error.message === 'Unauthorized access' || error.message === 'Not purchased') ? 403 : 500);
      }
    }
  }

  getMyPurchaseStats = async (req, res) => {
    try {
      const userId = req.user.id;
      const stats = await this.marketplaceService.getMyPurchaseStats(userId);
      return ResponseUtil.success(res, 'My purchase stats fetched', stats);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getMyPurchases = async (req, res) => {
    try {
      const userId = req.user.id;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);
      const result = await this.marketplaceService.getMyPurchases(userId, skip, take);

      const formattedData = result.data.map(item => {
        if (item.premiumPhoto) {
          item.premiumPhoto = this.formatMediaUrls(req, item.premiumPhoto);
        }
        return item;
      });

      return ResponseUtil.success(res, 'My purchases fetched', {
        data: formattedData,
        meta: PaginationUtil.getMetadata(result.total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  savePremiumPhoto = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await this.marketplaceService.toggleSavePremiumPhoto(id, userId);
      const msg = result.saved ? 'Premium photo saved successfully' : 'Premium photo removed from saved list';
      
      return ResponseUtil.success(res, msg, result);
    } catch (error) {
      if (error.message === 'Photo not found') return ResponseUtil.error(res, error.message, 404);
      if (error.message === 'You cannot save your own photo') return ResponseUtil.error(res, error.message, 400);
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}
