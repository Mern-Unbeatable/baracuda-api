import { ResponseUtil } from '../../utils/response.js';

export class SlideshowController {
  constructor(slideshowService) {
    this.slideshowService = slideshowService;
  }

  /**
   * Get all images uploaded by logged-in user across competitions, gallery, and sell photos
   * Paginated with 15 items per page (supports Load More).
   */
  getMyUploadImages = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const result = await this.slideshowService.getMyUploadImages(userId, req.query, req);
      return ResponseUtil.success(res, 'Uploaded images fetched successfully', {
        images: result.images,
        meta: result.meta
      });
    } catch (error) {
      console.error('Error in getMyUploadImages:', error);
      next(error);
    }
  };

  /**
   * Create a new custom slideshow with selected ordered images
   */
  createSlideshow = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const result = await this.slideshowService.createSlideshow(userId, req.body, req);
      return ResponseUtil.success(res, 'Slideshow created successfully', result, 201);
    } catch (error) {
      console.error('Error in createSlideshow:', error);
      if (error.message.includes('required') || error.message.includes('select at least')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      next(error);
    }
  };

  /**
   * Get all slideshows created by the logged-in user (token-based)
   */
  getMySlideshows = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const result = await this.slideshowService.getMySlideshows(userId, req.query, req);
      return ResponseUtil.success(res, 'My slideshows fetched successfully', {
        slideshows: result.slideshows,
        meta: result.meta
      });
    } catch (error) {
      console.error('Error in getMySlideshows:', error);
      next(error);
    }
  };

  /**
   * Get slideshows of another photographer by their username
   */
  getUserSlideshows = async (req, res, next) => {
    try {
      const { username } = req.params;
      const result = await this.slideshowService.getUserSlideshows(username, req.query, req);

      if (!result) {
        return ResponseUtil.error(res, 'Photographer not found', 404);
      }

      return ResponseUtil.success(res, 'Photographer slideshows fetched successfully', {
        user: result.user,
        slideshows: result.slideshows,
        meta: result.meta
      });
    } catch (error) {
      console.error('Error in getUserSlideshows:', error);
      next(error);
    }
  };

  /**
   * Get single slideshow details for playback
   */
  getSlideshowById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await this.slideshowService.getSlideshowById(id, req);

      if (!result) {
        return ResponseUtil.error(res, 'Slideshow not found', 404);
      }

      return ResponseUtil.success(res, 'Slideshow details fetched successfully', result);
    } catch (error) {
      console.error('Error in getSlideshowById:', error);
      next(error);
    }
  };

  /**
   * Update a slideshow
   */
  updateSlideshow = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await this.slideshowService.updateSlideshow(id, userId, req.body, req);
      return ResponseUtil.success(res, 'Slideshow updated successfully', result);
    } catch (error) {
      console.error('Error in updateSlideshow:', error);
      if (error.message.includes('not found')) {
        return ResponseUtil.error(res, error.message, 404);
      }
      if (error.message.includes('Unauthorized')) {
        return ResponseUtil.error(res, error.message, 403);
      }
      next(error);
    }
  };

  /**
   * Delete a slideshow
   */
  deleteSlideshow = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      await this.slideshowService.deleteSlideshow(id, userId);
      return ResponseUtil.success(res, 'Slideshow deleted successfully', { id });
    } catch (error) {
      console.error('Error in deleteSlideshow:', error);
      if (error.message.includes('not found')) {
        return ResponseUtil.error(res, error.message, 404);
      }
      if (error.message.includes('Unauthorized')) {
        return ResponseUtil.error(res, error.message, 403);
      }
      next(error);
    }
  };

  /**
   * Stats
   */
  getSlideshowStats = async (req, res, next) => {
    try {
      const stats = await this.slideshowService.getSlideshowStats();
      return ResponseUtil.success(res, 'Slideshow stats retrieved successfully', stats);
    } catch (error) {
      console.error('Error in getSlideshowStats:', error);
      next(error);
    }
  };
}
