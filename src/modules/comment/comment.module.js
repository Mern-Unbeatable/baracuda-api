import { Router } from 'express';
import { CommentController } from './comment.controller.js';
import { CommentService } from './comment.service.js';
import { CommentValidation } from './comment.validation.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

export class CommentModule {
  constructor() {
    this.router = Router();
    
    this.commentService = new CommentService();
    this.commentController = new CommentController(this.commentService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Apply auth and admin middleware to all routes in this module
    this.router.use(requireAuth, requireAdmin);

    this.router.get('/', this.commentController.getComments);
    this.router.patch('/bulk-status', CommentValidation.validate(CommentValidation.bulkStatusSchema), this.commentController.bulkUpdateStatus);
    this.router.get('/:publicCode', this.commentController.getCommentDetails);
  }
}
