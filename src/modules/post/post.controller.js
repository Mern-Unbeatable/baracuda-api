import { ResponseUtil } from '../../utils/response.js';
import prisma from '../../config/prisma.js';
import { TranslateUtil } from '../../utils/translate.js';

export class PostController {
  constructor(postService) {
    this.postService = postService;
  }

  formatPost(req, post) {
    if (!post) return post;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    if (post.mediaUrl && !post.mediaUrl.startsWith('http')) {
      post.mediaUrl = `${baseUrl}${post.mediaUrl.startsWith('/') ? '' : '/'}${post.mediaUrl}`;
    }
    if (post.user && post.user.avatar && !post.user.avatar.startsWith('http')) {
      post.user.avatar = `${baseUrl}${post.user.avatar.startsWith('/') ? '' : '/'}${post.user.avatar}`;
    }
    return post;
  }

  createPost = async (req, res) => {
    try {
      const { body, copyrightConfirmed } = req.body;
      const body_pl = body ? await TranslateUtil.translateText(body, 'pl', 'en') : null;
      const mediaFile = req.file;

      let post = await this.postService.createPost(req.user.id, body, body_pl, mediaFile, copyrightConfirmed);
      post = this.formatPost(req, post);
      return ResponseUtil.success(res, 'Post created successfully', post);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getPosts = async (req, res) => {
    try {
      const { page = 1, limit = 10, username } = req.query;
      
      // If username is provided, look up the user by username
      let targetUserId = req.user?.id;
      if (username) {
        const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
        if (!user) return ResponseUtil.error(res, 'User not found', 404);
        targetUserId = user.id;
      }
      
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      let result = await this.postService.getPosts(targetUserId, skip, limitNum);
      
      // Format all posts
      const formattedPosts = result.posts.map(post => this.formatPost(req, post));
      
      return ResponseUtil.success(res, 'Posts fetched successfully', {
        data: formattedPosts,
        meta: {
          total: result.total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(result.total / limitNum)
        }
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getPostById = async (req, res) => {
    try {
      let post = await this.postService.getPostById(req.params.id, req.user.id);
      if (!post) return ResponseUtil.error(res, 'Post not found', 404);
      post = this.formatPost(req, post);
      return ResponseUtil.success(res, 'Post fetched successfully', post);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  updatePost = async (req, res) => {
    try {
      if (req.body.body) {
        req.body.body_pl = await TranslateUtil.translateText(req.body.body, 'pl', 'en');
      }
      let post = await this.postService.updatePost(req.params.id, req.user.id, req.body, req.file);
      post = this.formatPost(req, post);
      return ResponseUtil.success(res, 'Post updated successfully', post);
    } catch (error) {
      return ResponseUtil.error(res, error.message, (error.message === 'Post not found') ? 404 : 500);
    }
  }

  deletePost = async (req, res) => {
    try {
      await this.postService.deletePost(req.params.id, req.user.id);
      return ResponseUtil.success(res, 'Post deleted successfully', null);
    } catch (error) {
      return ResponseUtil.error(res, error.message, (error.message === 'Post not found') ? 404 : 500);
    }
  }

  reportPost = async (req, res) => {
    try {
      const { reason, details } = req.body;
      const report = await this.postService.reportPost(req.params.id, req.user.id, reason, details);
      return ResponseUtil.success(res, 'Post reported successfully', report);
    } catch (error) {
      return ResponseUtil.error(res, error.message, (error.message === 'Post not found') ? 404 : 400);
    }
  }
}
