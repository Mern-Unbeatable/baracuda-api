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
        
        // Parse title and story which are JSON
        let titleStr = formatted.title;
        if (typeof titleStr === 'object' && titleStr !== null) {
          titleStr = titleStr.en || titleStr[Object.keys(titleStr)[0]] || '';
        }
        
        let storyStr = formatted.story;
        if (typeof storyStr === 'object' && storyStr !== null) {
          storyStr = storyStr.en || storyStr[Object.keys(storyStr)[0]] || '';
        }

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
          story: storyStr,
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
