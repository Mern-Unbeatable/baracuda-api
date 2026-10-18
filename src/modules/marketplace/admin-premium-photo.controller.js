import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { UrlUtil } from '../../utils/urlUtil.js';
import { AdminPremiumPhotoService } from './admin-premium-photo.service.js';

export class AdminPremiumPhotoController {
  constructor() {
    this.adminPremiumPhotoService = new AdminPremiumPhotoService();
  }

  formatMediaUrls = (req, item) => {
    if (!item) return item;
    const formatted = { ...item };
    if (formatted.price) {
      formatted.price = parseFloat(formatted.price);
    }
    
    if (formatted.user && formatted.user.avatar && !formatted.user.avatar.startsWith('http')) {
      formatted.user.avatar = UrlUtil.getAbsoluteUrl(req, formatted.user.avatar);
    }

    if (formatted.media && Array.isArray(formatted.media)) {
      formatted.media = formatted.media.map(m => ({
        ...m,
        url: UrlUtil.getAbsoluteUrl(req, m.url),
        thumbnailUrl: UrlUtil.getAbsoluteUrl(req, m.thumbnailUrl)
      }));
    }

    return formatted;
  }

  getAllPremiumPhotos = async (req, res) => {
    try {
      const { kind, isPromoted } = req.query;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);

      const filters = { kind, isPromoted };
      const { total, data } = await this.adminPremiumPhotoService.getAllPremiumPhotos(skip, take, filters);

      const formattedData = data.map(item => {
        const formatted = this.formatMediaUrls(req, item);
        


        let coverImage = null;
        let additionalPhotos = 0;
        
        if (formatted.media && formatted.media.length > 0) {
          const sortedMedia = [...formatted.media].sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));
          const firstImage = sortedMedia.find(m => m.kind === 'IMAGE') || sortedMedia[0];
          
          if (firstImage) {
            coverImage = firstImage.thumbnailUrl || firstImage.url;
          }
          
          const imageCount = formatted.media.filter(m => m.kind === 'IMAGE').length;
          additionalPhotos = imageCount > 1 ? imageCount - 1 : 0;
        }

        const latestPromotion = formatted.promotions && formatted.promotions.length > 0 ? formatted.promotions[0] : null;
        const isItemPromoted = Boolean(latestPromotion && latestPromotion.isActive && new Date(latestPromotion.endsAt) >= new Date());

        return {
          id: formatted.id,
          kind: formatted.kind,
          title: formatted.title,
          title_pl: formatted.title_pl,
          story: formatted.story,
          story_pl: formatted.story_pl,
          createdAt: formatted.createdAt,
          viewsCount: formatted.viewsCount,
          likesCount: formatted.likesCount,
          totalSales: formatted.totalSales,
          price: formatted.price,
          coverImage: coverImage,
          additionalPhotos: additionalPhotos,
          isPromoted: isItemPromoted,
          promotion: latestPromotion ? {
            id: latestPromotion.id,
            durationDays: latestPromotion.durationDays,
            startsAt: latestPromotion.startsAt,
            endsAt: latestPromotion.endsAt,
            amountPaid: parseFloat(latestPromotion.amountPaid),
            isActive: latestPromotion.isActive
          } : null
        };
      });

      return ResponseUtil.success(res, 'Premium photos fetched successfully', {
        data: formattedData,
        meta: PaginationUtil.getMetadata(total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getPremiumPhotoDetails = async (req, res) => {
    try {
      const { id } = req.params;
      const details = await this.adminPremiumPhotoService.getPremiumPhotoDetails(id);
      
      if (!details) {
        return ResponseUtil.error(res, 'Premium photo not found', 404);
      }

      const formatted = this.formatMediaUrls(req, details);
      
      // Parse JSON fields


      let categoryName = 'Uncategorized';
      if (formatted.category && formatted.category.name) {
        categoryName = typeof formatted.category.name === 'object' 
          ? (formatted.category.name.en || formatted.category.name[Object.keys(formatted.category.name)[0]])
          : formatted.category.name;
      }

      const firstImage = (formatted.media || []).find(m => m.kind === 'IMAGE') || (formatted.media || [])[0] || {};
      
      // Calculate file size in KB/MB
      let fileSize = 'Unknown';
      if (firstImage.bytes) {
        if (firstImage.bytes > 1024 * 1024) {
          fileSize = (firstImage.bytes / (1024 * 1024)).toFixed(2) + ' MB';
        } else {
          fileSize = Math.round(firstImage.bytes / 1024) + ' KB';
        }
      }

      // resolution
      let resolution = formatted.resolution || 'Unknown';
      if (!formatted.resolution && firstImage.width && firstImage.height) {
        resolution = `${firstImage.width}x${firstImage.height}`;
      }

      const responseData = {
        id: formatted.id,
        kind: formatted.kind,
        title: formatted.title,
        title_pl: formatted.title_pl,
        story: formatted.story,
        story_pl: formatted.story_pl,
        price: formatted.price,
        likesCount: formatted.likesCount,
        viewsCount: formatted.viewsCount,
        totalSales: formatted.totalSales,
        media: formatted.media,
        user: formatted.user,
        imageDetails: {
          credit: formatted.user?.name || 'Unknown',
          creativeId: formatted.id,
          resolution: resolution,
          format: formatted.format || firstImage.format || 'JPEG',
          quality: formatted.quality || '4K',
          fileSize: fileSize,
          uploadDate: formatted.createdAt,
          categories: categoryName
        }
      };

      return ResponseUtil.success(res, 'Premium photo details fetched successfully', responseData);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  deletePremiumPhoto = async (req, res) => {
    try {
      const { id } = req.params;
      await this.adminPremiumPhotoService.deletePremiumPhoto(id);
      return ResponseUtil.success(res, 'Premium photo deleted successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}
