import { albumTypeValidation } from './album-type.validation.js';
import { ResponseUtil } from '../../utils/response.js';

export class AlbumTypeController {
  constructor(albumTypeService) {
    this.albumTypeService = albumTypeService;
  }

  /**
   * Get all Album Types
   * @route GET /api/v1/album-types
   */
  getAllAlbumTypes = async (req, res, next) => {
    try {
      const albumTypes = await this.albumTypeService.getAllAlbumTypes();
      
      // Sort order definition
      const order = { 'SINGLE': 1, 'SIX': 2, 'TWELVE': 3 };

      // We might want to flatten the JSON for the frontend if they expect strings, 
      // but since they might be fetching it directly, let's format it.
      const formatted = albumTypes.map(at => ({
        ...at,
        name: at.name?.en || at.name,
        description: at.description?.en || at.description,
        features: Array.isArray(at.features?.en) ? at.features.en.join('\\n') : at.features
      })).sort((a, b) => (order[a.kind] || 99) - (order[b.kind] || 99));

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

      const updated = await this.albumTypeService.updateAlbumType(id, value);
      
      const formatted = {
        ...updated,
        name: updated.name?.en || updated.name,
        description: updated.description?.en || updated.description,
        features: Array.isArray(updated.features?.en) ? updated.features.en.join('\\n') : updated.features
      };

      res.status(200).json({
        success: true,
        data: formatted,
        message: 'Album Type updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}
