import { Router } from 'express';
import { ArtworkController } from './artwork.controller.js';
import { ArtworkService } from './artwork.service.js';
import { ArtworkValidation } from './artwork.validation.js';
import { upload } from '../../utils/upload.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';

/**
 * Artwork Module
 * Acts as the entry point for the artwork feature domain.
 * Wires dependencies and exposes the configured router.
 */
export class ArtworkModule {
  constructor() {
    this.router = Router();
    
    // Dependency Injection
    this.artworkService = new ArtworkService();
    this.artworkController = new ArtworkController(this.artworkService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Multer fields setup for multiple images and a single video
    const artworkUploadFields = upload.fields([
      { name: 'images', maxCount: 12 },
      { name: 'video', maxCount: 1 }
    ]);

    // Endpoints
    this.router.get('/', requireAuth, this.artworkController.getAllArtworks);
    this.router.get('/:id', requireAuth, this.artworkController.getArtworkDetails);
    
    this.router.post('/', requireAuth, artworkUploadFields, ArtworkValidation.validate(ArtworkValidation.createSchema), this.artworkController.createArtwork);
    
    this.router.put('/:id', requireAuth, ArtworkValidation.validate(ArtworkValidation.updateSchema), this.artworkController.updateArtwork);
    this.router.delete('/:id', requireAuth, this.artworkController.deleteArtwork);

    this.router.post('/:id/promote', requireAuth, ArtworkValidation.validate(ArtworkValidation.promoteSchema), this.artworkController.promoteArtwork);
    this.router.post('/:id/switch-to-competition', requireAuth, ArtworkValidation.validate(ArtworkValidation.switchCompetitionSchema), this.artworkController.switchToCompetition);
    this.router.post('/:id/resubmit', requireAuth, ArtworkValidation.validate(ArtworkValidation.resubmitSchema), this.artworkController.resubmitArtwork);

    // Public Routes
    this.router.get('/public/all', optionalAuth, this.artworkController.getPublicArtworks);
    this.router.get('/public/:id', optionalAuth, this.artworkController.getPublicArtworkDetails);
    this.router.get('/public/:id/download', optionalAuth, this.artworkController.downloadArtwork);

    // Interaction Routes
    this.router.post('/:id/vote', requireAuth, this.artworkController.voteArtwork);
    this.router.post('/:id/like', requireAuth, this.artworkController.likeArtwork);
    this.router.post('/:id/save', requireAuth, this.artworkController.saveArtwork);
    this.router.post('/:id/comment', requireAuth, ArtworkValidation.validate(ArtworkValidation.commentSchema), this.artworkController.commentArtwork);
    this.router.post('/:id/report', requireAuth, ArtworkValidation.validate(ArtworkValidation.reportSchema), this.artworkController.reportArtwork);
  }
}
