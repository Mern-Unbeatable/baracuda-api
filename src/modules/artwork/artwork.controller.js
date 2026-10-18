import path from 'path';
import { UrlUtil } from '../../utils/urlUtil.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { ResponseUtil } from '../../utils/response.js';
import { watermarkService } from './watermark.service.js';
import prisma from '../../config/prisma.js';
import { TranslateUtil } from '../../utils/translate.js';

export class ArtworkController {
  constructor(artworkService) {
    this.artworkService = artworkService;
  }

  formatMediaUrls(req, artwork) {
    if (!artwork) return artwork;
    const formatted = { ...artwork };
    
    const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
    
    const applyTranslations = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(applyTranslations);
      } else {
        if (sourceLang === 'pl') {
          if (obj.title_pl) obj.title = obj.title_pl;
          if (obj.story_pl) obj.story = obj.story_pl;
          if (obj.name_pl) obj.name = obj.name_pl;
          if (obj.description_pl) obj.description = obj.description_pl;
          if (obj.tags_pl && obj.tags_pl.length > 0) obj.tags = obj.tags_pl;
          if (obj.features_pl && obj.features_pl.length > 0) obj.features = obj.features_pl;
        }
        Object.keys(obj).forEach(key => {
          if (obj[key] && typeof obj[key] === 'object') {
            applyTranslations(obj[key]);
          }
        });
      }
    };
    applyTranslations(formatted);
    
    if (formatted.category) {
      formatted.categoryName = formatted.category.name || null;
      delete formatted.category;
    }
    if (formatted.subcategory !== undefined) {
      if (formatted.subcategory) {
        formatted.subcategoryName = formatted.subcategory.name || null;
      }
      delete formatted.subcategory;
    }
    
    if (formatted.prizeMoney) {
      formatted.prizeMoney = parseFloat(formatted.prizeMoney);
    }
    
    if (formatted.promotion && formatted.promotion.amountPaid) {
      formatted.promotion.amountPaid = parseFloat(formatted.promotion.amountPaid);
    }
    
    if (formatted.albumType) {
      if (formatted.albumType.prizeMoney) formatted.albumType.prizeMoney = parseFloat(formatted.albumType.prizeMoney);
      if (formatted.albumType.entryFee) formatted.albumType.entryFee = parseFloat(formatted.albumType.entryFee);
    }

    // Helper to format all avatar fields recursively in the object
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
    
    // Format all user avatars (e.g., in user, comments, donations, etc)
    formatAvatars(formatted);

    // Format featuredImage to full absolute URL
    if (formatted.featuredImage && typeof formatted.featuredImage === 'string') {
      formatted.featuredImage = UrlUtil.getAbsoluteUrl(req, formatted.featuredImage);
    }

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
      formatted.video = videos.length > 0 ? videos[0] : null; // Usually 1 video
      delete formatted.media; // Replaced by structured images and video
    } else if (formatted.kind === 'VIDEO') {
      const v = formatted.media && formatted.media[0];
      if (v) {
        const videoUrl = UrlUtil.getAbsoluteUrl(req, v.url);
        formatted.video = {
          id: v.id,
          url: videoUrl,
          duration: v.duration || null,
          format: v.format || null
        };
      }
      formatted.aiBadge = formatted.isAiGenerated === true;
      delete formatted.media;

      // Remove photo/competition specific fields that do not apply to standalone video
      delete formatted.tags;
      delete formatted.camera;
      delete formatted.resolution;
      delete formatted.format;
      delete formatted.quality;
      delete formatted.theme;
      delete formatted.zodiacSign;
      delete formatted.prizeMoney;
      delete formatted.copyrightConfirmed;
      delete formatted.albumTypeId;
      delete formatted.competitionId;
      delete formatted.rank;
    } else {
      formatted.media = formatted.media.map(m => ({
        ...m,
        url: UrlUtil.getAbsoluteUrl(req, m.url)
      }));
    }
    return formatted;
  }

  createArtwork = async (req, res) => {
    try {
      // For authenticated routes, assume req.user is set by auth middleware
      const userId = req.user?.id || 'TEST_USER_ID';
      
      const {
        kind,
        theme,
        zodiacSign,
        visibility,
        competitionState,
        categoryId,
        subcategoryId,
        title,
        story,
        tags,
        camera,
        resolution,
        format,
        isAiGenerated,
        copyrightConfirmed,
        quality,
        zodiacSigns
      } = req.validatedBody || req.body;

      // Extract uploaded files from req.files
      // multer config allows 'images' and 'video'
      const imageFiles = req.files && req.files['images'] ? req.files['images'] : [];
      const videoFiles = req.files && req.files['video'] ? req.files['video'] : [];
      const mediaFiles = [...imageFiles, ...videoFiles];

      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';

      const data = {
        kind,
        theme: theme || null,
        zodiacSign: zodiacSign || null,
        visibility: visibility || 'PUBLIC',
        competitionState: competitionState || 'PROFILE_ONLY',
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        title: title,
        story: story || null,
        tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
        camera: camera || null,
        resolution: resolution || null,
        format: format || null,
        isAiGenerated: isAiGenerated === 'true' || isAiGenerated === true,
        copyrightConfirmed: copyrightConfirmed === 'true' || copyrightConfirmed === true,
        quality: quality || null,
        zodiacSigns: zodiacSigns ? (Array.isArray(zodiacSigns) ? zodiacSigns : JSON.parse(zodiacSigns)) : null
      };

      const result = await this.artworkService.createArtwork(userId, data, mediaFiles, sourceLang);
      ResponseUtil.actionSuccess(res, 'Artwork created successfully', result.id, 201);
      
      // Run watermark asynchronously so response isn't blocked
      const aiGenerated = isAiGenerated === 'true' || isAiGenerated === true;
      watermarkService.applyWatermarkInBackground(mediaFiles, aiGenerated).catch(console.error);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  createVideoComment = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const videoFile = req.files?.video ? req.files.video[0] : null;
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';

      if (!videoFile) {
        return ResponseUtil.error(res, 'Video file is required (field name: video)', 400);
      }

      const result = await this.artworkService.createVideoComment(userId, req.body, videoFile, sourceLang);

      // Run watermark asynchronously so response isn't blocked if AI Generated
      const isAiGenerated = req.body.isAiGenerated === true || req.body.isAiGenerated === 'true';
      if (isAiGenerated) {
        const mediaToWatermark = [videoFile];
        if (result.featuredImage) {
          const thumbPath = path.join(process.cwd(), result.featuredImage.replace(/^\//, ''));
          mediaToWatermark.push({ path: thumbPath, mimetype: 'image/jpeg' });
        }
        watermarkService.applyWatermarkInBackground(mediaToWatermark, true).catch(console.error);
      }

      return ResponseUtil.actionSuccess(res, '1-minute video comment uploaded successfully', null, 201);
    } catch (error) {
      next(error);
    }
  };

  getMyVideoComments = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);
      const { data, total } = await this.artworkService.getUserVideoComments(userId, skip, take);
      const formattedData = data.map(v => this.formatMediaUrls(req, v));
      const meta = PaginationUtil.getMetadata(total, page, limit);
      return res.status(200).json({ success: true, message: 'Video comments fetched successfully', data: formattedData, meta });
    } catch (error) {
      next(error);
    }
  };

  getAllArtworks = async (req, res) => {
    try {
      const { kind, promoted, status, sort, username } = req.query;
      
      let targetUserId = req.user?.id;
      if (username) {
        const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
        if (!user) return ResponseUtil.error(res, 'User not found', 404);
        targetUserId = user.id;
      }
      
      const userId = targetUserId || 'TEST_USER_ID';
      
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);
      
      const filters = { kind, promoted, status };
      const result = await this.artworkService.getAllArtworks(userId, filters, sort, skip, take);
      
      // Format URLs and remove unused fields to save bandwidth
      const formattedData = result.data.map(a => {
        const formatted = this.formatMediaUrls(req, a);
        
        // PROFILE_ONLY artworks don't need competition or vote data
        if (formatted.competitionState === 'PROFILE_ONLY') {
          delete formatted.votesCount;
          delete formatted.rank;
          delete formatted.competition;
        } else {
          // IN_COMPETITION or ENDED don't need likesCount according to user
          delete formatted.likesCount;
        }
        
        return formatted;
      });
      
      const meta = PaginationUtil.getMetadata(result.total, page, limit);
      
      res.status(200).json({ success: true, data: formattedData, meta });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  getArtworkDetails = async (req, res) => {
    try {
      const { id } = req.params;
      const result = await this.artworkService.getArtworkDetails(id);
      if (!result) {
        return res.status(404).json({ success: false, error: 'Artwork not found' });
      }
      res.status(200).json({ success: true, data: this.formatMediaUrls(req, result) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  downloadArtwork = async (req, res) => {
    try {
      const { id } = req.params;
      await this.artworkService.downloadArtworkAsZip(id, res);
    } catch (error) {
      // If error happens before headers are sent, return JSON error
      if (!res.headersSent) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.end();
      }
    }
  }

  deleteArtwork = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      await this.artworkService.deleteArtwork(id, userId);
      res.status(200).json({ success: true, message: 'Artwork deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  updateArtwork = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      const data = req.validatedBody || req.body;
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
      
      if (data.tags && typeof data.tags === 'string') {
        try {
          data.tags = JSON.parse(data.tags);
        } catch (e) {
          data.tags = [];
        }
      }
      
      const result = await this.artworkService.updateArtwork(id, userId, data, sourceLang);
      res.status(200).json({ success: true, data: this.formatMediaUrls(req, result) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  promoteArtwork = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      const { durationDays } = req.validatedBody || req.body;
      
      const { default: paymentService } = await import('../payment/payment.service.js');
      const result = await paymentService.createPromotionPayment(id, Number(durationDays), userId);
      
      res.status(200).json({ success: true, data: result, message: 'Checkout URL generated successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  capturePromotion = async (req, res) => {
    try {
      const { paymentId } = req.validatedBody || req.body;
      
      const { default: paymentService } = await import('../payment/payment.service.js');
      const result = await paymentService.capturePromotionPayment(paymentId);
      
      res.status(200).json({ success: true, data: result, message: 'Promotion payment captured successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  switchToCompetition = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      
      const result = await this.artworkService.switchToCompetition(id, userId);
      ResponseUtil.actionSuccess(res, 'Successfully switched to competition', result.id);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  resubmitArtwork = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      
      const result = await this.artworkService.resubmitArtwork(id, userId);
      ResponseUtil.actionSuccess(res, 'Successfully resubmitted to active competition', result.id);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  getPublicArtworks = async (req, res, next) => {
    try {
      const { status, sort, categoryId, subcategoryId } = req.query;
      const viewerId = req.user?.id;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);
      const filters = { status, categoryId, subcategoryId };
      const artworks = await this.artworkService.getPublicArtworks(filters, sort || 'newest', skip, take, viewerId);
      
      const formattedData = artworks.data.map(a => {
        const formatted = this.formatMediaUrls(req, a);
        if (formatted.competitionState === 'PROFILE_ONLY') {
          delete formatted.votesCount;
        } else {
          delete formatted.likesCount;
        }
        return formatted;
      });
      const meta = PaginationUtil.getMetadata(artworks.total, page, limit);
      return res.status(200).json({ success: true, message: 'Public artworks retrieved successfully', data: formattedData, meta });
    } catch (err) {
      next(err);
    }
  }

  getPublicArtworkDetails = async (req, res, next) => {
    try {
      const { id } = req.params;
      const viewerId = req.user?.id || req.ip;
      const artwork = await this.artworkService.getPublicArtworkDetails(id, viewerId);
      const formatted = this.formatMediaUrls(req, artwork);
      if (formatted.competitionState === 'PROFILE_ONLY') {
        delete formatted.votesCount;
      } else {
        delete formatted.likesCount;
      }
      return ResponseUtil.success(res, 'Artwork details retrieved successfully', formatted);
    } catch (err) {
      next(err);
    }
  }

  voteArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      const result = await this.artworkService.voteArtwork(id, userId, ipAddress);
      return ResponseUtil.success(res, 'Vote recorded successfully', result);
    } catch (err) {
      next(err);
    }
  }

  likeArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await this.artworkService.toggleLikeArtwork(id, userId);
      const msg = result.liked ? 'Artwork liked successfully' : 'Artwork unliked successfully';
      return ResponseUtil.success(res, msg, result);
    } catch (err) {
      next(err);
    }
  }

  saveArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await this.artworkService.toggleSaveArtwork(id, userId);
      const msg = result.saved ? 'Artwork saved successfully' : 'Artwork removed from saved list';
      return ResponseUtil.success(res, msg, result);
    } catch (err) {
      next(err);
    }
  }

  commentArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { body, parentId } = req.validatedBody;
      
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
      let finalBody = body;
      let finalBody_pl = body;
      
      if (sourceLang === 'pl') {
        finalBody = await TranslateUtil.translateText(body, 'pl', 'en');
      } else {
        finalBody_pl = await TranslateUtil.translateText(body, 'en', 'pl');
      }
      
      const comment = await this.artworkService.addComment(id, userId, finalBody, finalBody_pl, parentId);
      return ResponseUtil.success(res, 'Comment added successfully', comment, 201);
    } catch (err) {
      next(err);
    }
  }

  reportArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { reason, details } = req.validatedBody;
      const report = await this.artworkService.reportArtwork(id, userId, reason, details);
      return ResponseUtil.success(res, 'Report submitted successfully', report, 201);
    } catch (err) {
      next(err);
    }
  }
}
