import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { UrlUtil } from '../../utils/urlUtil.js';

export class BusinessController {
  constructor(businessService) {
    this.businessService = businessService;
  }

  formatMediaUrls(req, album) {
    if (!album) return album;
    const formatted = { ...album };

    if (formatted.user && formatted.user.avatar && !formatted.user.avatar.startsWith('http')) {
      formatted.user.avatar = UrlUtil.getAbsoluteUrl(req, formatted.user.avatar);
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

  createBusinessAlbum = async (req, res) => {
    try {
      const userId = req.user.id;
      
      const {
        kind,
        theme,
        zodiacSign,
        categoryId,
        subcategoryId,
        title,
        story,
        isAiGenerated,
        copyrightConfirmed,
        zodiacSigns
      } = req.validatedBody || req.body;

      const imageFiles = req.files && req.files['images'] ? req.files['images'] : [];
      const videoFiles = req.files && req.files['video'] ? req.files['video'] : [];
      const mediaFiles = [...imageFiles, ...videoFiles];

      const data = {
        kind,
        theme,
        zodiacSign,
        zodiacSigns,
        categoryId,
        subcategoryId,
        title,
        story,
        isAiGenerated,
        copyrightConfirmed
      };

      const album = await this.businessService.createBusinessAlbum(userId, data, mediaFiles);
      
      return ResponseUtil.success(res, 'Business Album uploaded successfully', album, 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getAllBusinessAlbums = async (req, res) => {
    try {
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);
      const result = await this.businessService.getAllBusinessAlbums(skip, take);

      return ResponseUtil.success(res, 'Business albums fetched', {
        data: result.data,
        meta: PaginationUtil.getMetadata(result.total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getBusinessAlbumDetails = async (req, res) => {
    try {
      const album = await this.businessService.getBusinessAlbumDetails(req.params.id);
      if (!album) {
        return ResponseUtil.error(res, 'Business Album not found', 404);
      }
      
      const formattedAlbum = this.formatMediaUrls(req, album);
      return ResponseUtil.success(res, 'Business Album fetched', formattedAlbum);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}
