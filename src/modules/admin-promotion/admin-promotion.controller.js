import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { UrlUtil } from '../../utils/urlUtil.js';
import { AdminPromotionService } from './admin-promotion.service.js';

export class AdminPromotionController {
  constructor() {
    this.adminPromotionService = new AdminPromotionService();
  }

  /**
   * Helper to format a single promotion item with full media URLs and unified metadata.
   */
  formatPromotionItem = (req, item) => {
    if (!item) return null;

    const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
    const now = new Date();
    const endsAtDate = new Date(item.endsAt);
    const isExpired = endsAtDate < now || !item.isActive;
    const daysRemaining = Math.max(0, Math.ceil((endsAtDate - now) / (1000 * 60 * 60 * 24)));

    // User formatting
    const user = item.user ? {
      ...item.user,
      avatar: item.user.avatar ? UrlUtil.getAbsoluteUrl(req, item.user.avatar) : null
    } : null;

    let promotionType = 'UNKNOWN';
    let targetItem = null;

    if (item.submissionId && item.submission) {
      promotionType = 'ARTWORK';
      const sub = item.submission;

      let coverImage = null;
      if (sub.featuredImage) {
        coverImage = UrlUtil.getAbsoluteUrl(req, sub.featuredImage);
      } else if (sub.media && sub.media.length > 0) {
        const sorted = [...sub.media].sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));
        const first = sorted.find(m => m.kind === 'IMAGE') || sorted[0];
        coverImage = UrlUtil.getAbsoluteUrl(req, first.thumbnailUrl || first.url);
      }

      targetItem = {
        id: sub.id,
        type: 'ARTWORK',
        kind: sub.kind,
        title: sourceLang === 'pl' && sub.title_pl ? sub.title_pl : sub.title,
        story: sourceLang === 'pl' && sub.story_pl ? sub.story_pl : sub.story,
        category: sub.category ? (sourceLang === 'pl' && sub.category.name_pl ? sub.category.name_pl : sub.category.name) : null,
        coverImage,
        mediaCount: sub.media ? sub.media.length : 0,
        competitionState: sub.competitionState,
        status: sub.status,
        viewsCount: sub.viewsCount || 0,
        votesCount: sub.votesCount || 0,
        likesCount: sub.likesCount || 0,
        createdAt: sub.createdAt
      };
    } else if (item.premiumPhotoId && item.premiumPhoto) {
      promotionType = 'SELL_PHOTO';
      const photo = item.premiumPhoto;

      let coverImage = null;
      if (photo.media && photo.media.length > 0) {
        const sorted = [...photo.media].sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));
        const first = sorted.find(m => m.kind === 'IMAGE') || sorted[0];
        coverImage = UrlUtil.getAbsoluteUrl(req, first.thumbnailUrl || first.url);
      }

      targetItem = {
        id: photo.id,
        type: 'SELL_PHOTO',
        kind: photo.kind,
        title: sourceLang === 'pl' && photo.title_pl ? photo.title_pl : photo.title,
        story: sourceLang === 'pl' && photo.story_pl ? photo.story_pl : photo.story,
        price: photo.price ? parseFloat(photo.price) : 0,
        category: photo.category ? (sourceLang === 'pl' && photo.category.name_pl ? photo.category.name_pl : photo.category.name) : null,
        coverImage,
        mediaCount: photo.media ? photo.media.length : 0,
        totalSales: photo.totalSales || 0,
        viewsCount: photo.viewsCount || 0,
        likesCount: photo.likesCount || 0,
        createdAt: photo.createdAt
      };
    } else if (item.productId && item.product) {
      promotionType = 'PRODUCT';
      const prod = item.product;

      targetItem = {
        id: prod.id,
        type: 'PRODUCT',
        title: sourceLang === 'pl' && prod.title_pl ? prod.title_pl : prod.title,
        price: prod.price ? parseFloat(prod.price) : 0,
        category: prod.category,
        coverImage: prod.bannerImage ? UrlUtil.getAbsoluteUrl(req, prod.bannerImage) : null,
        createdAt: prod.createdAt
      };
    }

    return {
      id: item.id,
      promotionType,
      durationDays: item.durationDays,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      amountPaid: parseFloat(item.amountPaid),
      isActive: item.isActive,
      isExpired,
      daysRemaining,
      createdAt: item.createdAt,
      user,
      item: targetItem
    };
  };

  /**
   * GET /api/v1/admin/promotions
   * Fetch all promoted artworks and sell photos with filter & stats.
   */
  getAllPromotions = async (req, res) => {
    try {
      const { type, status, search } = req.query;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);

      const filters = { type, status, search };
      const { summary, total, data } = await this.adminPromotionService.getAllPromotions(filters, skip, take);

      const formattedData = data.map(item => this.formatPromotionItem(req, item));

      return ResponseUtil.success(res, 'Promoted items fetched successfully', {
        summary,
        data: formattedData,
        meta: PaginationUtil.getMetadata(total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  /**
   * GET /api/v1/admin/promotions/:id
   * Fetch detailed information of a single promotion.
   */
  getPromotionById = async (req, res) => {
    try {
      const { id } = req.params;
      const promotion = await this.adminPromotionService.getPromotionById(id);

      if (!promotion) {
        return ResponseUtil.error(res, 'Promotion not found', 404);
      }

      const formatted = this.formatPromotionItem(req, promotion);

      // Include all media files with absolute URLs
      if (promotion.submission && promotion.submission.media) {
        formatted.item.media = promotion.submission.media.map(m => ({
          ...m,
          url: UrlUtil.getAbsoluteUrl(req, m.url),
          thumbnailUrl: UrlUtil.getAbsoluteUrl(req, m.thumbnailUrl)
        }));
      } else if (promotion.premiumPhoto && promotion.premiumPhoto.media) {
        formatted.item.media = promotion.premiumPhoto.media.map(m => ({
          ...m,
          url: UrlUtil.getAbsoluteUrl(req, m.url),
          thumbnailUrl: UrlUtil.getAbsoluteUrl(req, m.thumbnailUrl)
        }));
      }

      return ResponseUtil.success(res, 'Promotion details fetched successfully', formatted);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  /**
   * PATCH /api/v1/admin/promotions/:id/status
   * Toggle or update active status of a promotion.
   */
  updatePromotionStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return ResponseUtil.error(res, 'isActive boolean field is required', 400);
      }

      const updated = await this.adminPromotionService.updatePromotionStatus(id, isActive);
      return ResponseUtil.success(res, `Promotion ${isActive ? 'activated' : 'deactivated'} successfully`, {
        id: updated.id,
        isActive: updated.isActive
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };
}
