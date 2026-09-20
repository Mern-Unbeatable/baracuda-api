import { ResponseUtil } from '../../utils/response.js';

export class CommentController {
  constructor(commentService) {
    this.commentService = commentService;
  }

  /**
   * Get paginated comments list for Admin
   * @route GET /api/v1/admin/comments
   */
  getComments = async (req, res, next) => {
    try {
      const { status, page, limit } = req.query;
      
      const comments = await this.commentService.getComments(
        status,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: comments.data,
        meta: comments.meta,
        message: 'Comments fetched successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get single comment details
   * @route GET /api/v1/admin/comments/:publicCode
   */
  getCommentDetails = async (req, res, next) => {
    try {
      const { publicCode } = req.params;

      const details = await this.commentService.getCommentDetails(publicCode);

      res.status(200).json({
        success: true,
        data: details,
        message: 'Comment details fetched successfully'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return ResponseUtil.error(res, error.message, 404);
      }
      next(error);
    }
  };

  /**
   * Bulk update status for comments
   * @route PATCH /api/v1/admin/comments/bulk-status
   */
  bulkUpdateStatus = async (req, res, next) => {
    try {
      const { commentIds, status } = req.body; // commentIds are publicCodes

      const result = await this.commentService.bulkUpdateStatus(commentIds, status);

      res.status(200).json({
        success: true,
        data: result,
        message: `Successfully updated ${result.updatedCount} comments to ${status}`
      });
    } catch (error) {
      next(error);
    }
  };
}
