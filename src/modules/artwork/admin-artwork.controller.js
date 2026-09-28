import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { UrlUtil } from '../../utils/urlUtil.js';
import { AdminArtworkService } from './admin-artwork.service.js';

export class AdminArtworkController {
  constructor() {
    this.adminArtworkService = new AdminArtworkService();
  }

  formatMediaUrls = (req, item) => {
    if (!item) return item;
    const formatted = { ...item };
    
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

  getAllArtworks = async (req, res) => {
    try {
      const { kind, competitionState } = req.query;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);

      const filters = { kind, competitionState };
      const { total, data } = await this.adminArtworkService.getAllArtworks(skip, take, filters);

      const formattedData = data.map(item => {
        const formatted = this.formatMediaUrls(req, item);
        
        let titleStr = formatted.title;
        let storyStr = formatted.story;

        // Extract cover image and additional photos count
        let coverImage = null;
        let additionalPhotos = 0;
        
        if (formatted.media && formatted.media.length > 0) {
          // Sort by slotIndex to get the first one
          const sortedMedia = [...formatted.media].sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));
          const firstImage = sortedMedia.find(m => m.kind === 'IMAGE') || sortedMedia[0];
          
          if (firstImage) {
            coverImage = firstImage.thumbnailUrl || firstImage.url;
          }
          
          // Only count images for the "+X photos" badge, exclude videos usually, or count all remaining
          const imageCount = formatted.media.filter(m => m.kind === 'IMAGE').length;
          additionalPhotos = imageCount > 1 ? imageCount - 1 : 0;
        }

        return {
          id: formatted.id,
          kind: formatted.kind,
          title: titleStr,
          title_pl: formatted.title_pl,
          story: storyStr,
          story_pl: formatted.story_pl,
          createdAt: formatted.createdAt,
          viewsCount: formatted.viewsCount,
          votesCount: formatted.competitionState === 'IN_COMPETITION' ? formatted.votesCount : undefined,
          likesCount: formatted.competitionState === 'PROFILE_ONLY' ? formatted.likesCount : undefined,
          competitionState: formatted.competitionState,
          coverImage: coverImage,
          additionalPhotos: additionalPhotos
        };
      });

      return ResponseUtil.success(res, 'Artworks fetched successfully', {
        data: formattedData,
        meta: PaginationUtil.getMetadata(total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getArtworkDetails = async (req, res) => {
    try {
      const { id } = req.params;
      const details = await this.adminArtworkService.getArtworkDetails(id);
      
      if (!details) {
        return ResponseUtil.error(res, 'Artwork not found', 404);
      }

      // Format urls
      let formatted = this.formatMediaUrls(req, details);
      
      if (formatted.comments) {
        formatted.comments = formatted.comments.map(c => {
          if (c.user && c.user.avatar && !c.user.avatar.startsWith('http')) {
            c.user.avatar = UrlUtil.getAbsoluteUrl(req, c.user.avatar);
          }
          return c;
        });
      }

      if (formatted.globalRankings) {
        formatted.globalRankings = formatted.globalRankings.map(r => {
          if (r.avatar && !r.avatar.startsWith('http')) {
            r.avatar = UrlUtil.getAbsoluteUrl(req, r.avatar);
          }
          return r;
        });
      }

      return ResponseUtil.success(res, 'Artwork details fetched successfully', formatted);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  deleteArtwork = async (req, res) => {
    try {
      const { id } = req.params;
      await this.adminArtworkService.deleteArtwork(id);
      return ResponseUtil.success(res, 'Artwork deleted successfully');
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}
