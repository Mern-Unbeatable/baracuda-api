import { Router } from 'express';
import { AlbumTypeController } from './album-type.controller.js';
import { AlbumTypeService } from './album-type.service.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

export class AlbumTypeModule {
  constructor() {
    this.router = Router();
    
    // Dependency Injection
    this.albumTypeService = new AlbumTypeService();
    this.albumTypeController = new AlbumTypeController(this.albumTypeService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/', this.albumTypeController.getAllAlbumTypes);
    this.router.post('/', requireAuth, requireAdmin, this.albumTypeController.createAlbumType);
    this.router.patch('/:id', requireAuth, requireAdmin, this.albumTypeController.updateAlbumType);
    this.router.delete('/:id', requireAuth, requireAdmin, this.albumTypeController.deleteAlbumType);
  }
}
