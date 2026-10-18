import { Router } from 'express';
import { PostController } from './post.controller.js';
import { PostService } from './post.service.js';
import { PostValidation } from './post.validation.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';
import { upload } from '../../utils/upload.js';
import { moderateUploadedContent } from '../../middlewares/moderation.middleware.js';

export class PostModule {
  constructor() {
    this.router = Router();
    this.postService = new PostService();
    this.postController = new PostController(this.postService);
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post(
      '/',
      requireAuth,
      upload.single('media'),
      moderateUploadedContent,
      PostValidation.validate(PostValidation.createSchema),
      this.postController.createPost
    );

    this.router.get('/', optionalAuth, this.postController.getPosts);
    this.router.get('/:id', optionalAuth, this.postController.getPostById);

    this.router.put(
      '/:id',
      requireAuth,
      upload.single('media'),
      moderateUploadedContent,
      PostValidation.validate(PostValidation.updateSchema),
      this.postController.updatePost
    );

    this.router.delete('/:id', requireAuth, this.postController.deletePost);

    this.router.post(
      '/:id/report',
      requireAuth,
      PostValidation.validate(PostValidation.reportSchema),
      this.postController.reportPost
    );
  }
}
