import { Router } from 'express';
import { SlideshowController } from './slideshow.controller.js';
import { slideshowService } from './slideshow.service.js';
import { requireAuth, optionalAuth } from '../../middlewares/auth.middleware.js';

export class SlideshowModule {
  constructor() {
    this.router = Router();
    this.slideshowController = new SlideshowController(slideshowService);
    this.initializeRoutes();
  }

  initializeRoutes() {
    // 1. Get logged-in user's uploaded images across Competitions, Gallery & Sell Photos (15 per page, load more)
    this.router.get('/my-images', requireAuth, this.slideshowController.getMyUploadImages);

    // 2. Get all slideshows created by the logged-in user (authenticated via token)
    this.router.get('/me', requireAuth, this.slideshowController.getMySlideshows);

    // 3. Create a new slideshow with selected ordered images
    this.router.post('/', requireAuth, this.slideshowController.createSlideshow);

    // 4. Overall stats
    this.router.get('/stats', optionalAuth, this.slideshowController.getSlideshowStats);

    // 5. Get slideshows of another photographer by username (public profile view)
    this.router.get('/user/:username', optionalAuth, this.slideshowController.getUserSlideshows);

    // 6. Get single slideshow details with all ordered photos (for playback)
    this.router.get('/:id', optionalAuth, this.slideshowController.getSlideshowById);

    // 7. Update slideshow (title, description, coverImage, reorder/replace items)
    this.router.put('/:id', requireAuth, this.slideshowController.updateSlideshow);

    // 8. Delete slideshow
    this.router.delete('/:id', requireAuth, this.slideshowController.deleteSlideshow);
  }
}
