import { albumTypeValidation } from './album-type.validation.js';
import { ResponseUtil } from '../../utils/response.js';
import { TranslateUtil } from '../../utils/translate.js';

export class AlbumTypeController {
  constructor(albumTypeService) {
    this.albumTypeService = albumTypeService;
  }

  /**
   * Create an Album Type
   * @route POST /api/v1/album-types
   */
    createAlbumType = async (req, res, next) => {
    try {
      const { error, value } = albumTypeValidation.create.validate(req.body);
      if (error) {
        return ResponseUtil.error(res, error.details[0].message, 400);
      }

      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';

      if (value.name) {
        if (sourceLang === 'pl') {
          value.name_pl = value.name;
          value.name = await TranslateUtil.translateText(value.name, 'pl', 'en');
        } else {
          value.name_pl = await TranslateUtil.translateText(value.name, 'en', 'pl');
        }
      }
      
      if (value.description) {
        if (sourceLang === 'pl') {
          value.description_pl = value.description;
          value.description = await TranslateUtil.translateText(value.description, 'pl', 'en');
        } else {
          value.description_pl = await TranslateUtil.translateText(value.description, 'en', 'pl');
        }
      }
      
      if (value.features) {
        if (sourceLang === 'pl') {
          value.features_pl = value.features;
          value.features = await TranslateUtil.translateText(value.features, 'pl', 'en');
        } else {
          value.features_pl = await TranslateUtil.translateText(value.features, 'en', 'pl');
        }
      }

      const created = await this.albumTypeService.createAlbumType(value);
      
      const formatted = {
        ...created,
        features: Array.isArray(created.features) ? created.features.join('\\n') : created.features,
        features_pl: Array.isArray(created.features_pl) ? created.features_pl.join('\\n') : created.features_pl
      };
      
      if (formatted.prizeMoney) {
        formatted.prizeMoney = parseFloat(formatted.prizeMoney);
      }

      res.status(201).json({
        success: true,
        data: formatted,
        message: 'Album Type created successfully'
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return ResponseUtil.error(res, error.message, 409);
      }
      next(error);
    }
  };

  /**
   * Get all Album Types
   * @route GET /api/v1/album-types
   */
  getAllAlbumTypes = async (req, res, next) => {
    try {
      const albumTypes = await this.albumTypeService.getAllAlbumTypes();
      
      // Fallback sort order definition if DB sortOrder is equal
      const order = { 'SINGLE': 1, 'SIX': 2, 'TWELVE': 3 };

      // We might want to flatten the JSON for the frontend if they expect strings, 
      // but since they might be fetching it directly, let's format it.
      const formatted = albumTypes.map(at => {
        let ret = {
          ...at,
          features: Array.isArray(at.features) ? at.features.join('\\n') : at.features,
          features_pl: Array.isArray(at.features_pl) ? at.features_pl.join('\\n') : at.features_pl
        };
        if (ret.prizeMoney) ret.prizeMoney = parseFloat(ret.prizeMoney);
        return ret;
      }).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return (order[a.kind] || 99) - (order[b.kind] || 99);
      });

      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update Album Type
   * @route PATCH /api/v1/album-types/:id
   */
  updateAlbumType = async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const { error, value } = albumTypeValidation.update.validate(req.body);
      if (error) {
        return ResponseUtil.error(res, error.details[0].message, 400);
      }
      
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';

      if (value.name) {
        if (sourceLang === 'pl') {
          value.name_pl = value.name;
          value.name = await TranslateUtil.translateText(value.name, 'pl', 'en');
        } else {
          value.name_pl = await TranslateUtil.translateText(value.name, 'en', 'pl');
        }
      }
      if (value.description) {
        if (sourceLang === 'pl') {
          value.description_pl = value.description;
          value.description = await TranslateUtil.translateText(value.description, 'pl', 'en');
        } else {
          value.description_pl = await TranslateUtil.translateText(value.description, 'en', 'pl');
        }
      }
      if (value.features) {
        if (sourceLang === 'pl') {
          value.features_pl = value.features;
          value.features = await TranslateUtil.translateText(value.features, 'pl', 'en');
        } else {
          value.features_pl = await TranslateUtil.translateText(value.features, 'en', 'pl');
        }
      }

      const updated = await this.albumTypeService.updateAlbumType(id, value);
      
      const formatted = {
        ...updated,
        features: Array.isArray(updated.features) ? updated.features.join('\\n') : updated.features,
        features_pl: Array.isArray(updated.features_pl) ? updated.features_pl.join('\\n') : updated.features_pl
      };
      
      if (formatted.prizeMoney) {
        formatted.prizeMoney = parseFloat(formatted.prizeMoney);
      }

      res.status(200).json({
        success: true,
        data: formatted,
        message: 'Album Type updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete Album Type
   * @route DELETE /api/v1/album-types/:id
   */
  deleteAlbumType = async (req, res, next) => {
    try {
      const { id } = req.params;
      
      await this.albumTypeService.deleteAlbumType(id);
      
      res.status(200).json({
        success: true,
        message: 'Album Type deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}
