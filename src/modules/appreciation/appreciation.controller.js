import { ResponseUtil } from '../../utils/response.js';

export class AppreciationController {
  constructor(appreciationService) {
    this.appreciationService = appreciationService;
  }

  awardAppreciation = async (req, res, next) => {
    try {
      const senderId = req.user.id;
      const result = await this.appreciationService.awardAppreciation(senderId, req.body);
      return ResponseUtil.success(res, 'Appreciation awarded successfully', result, 201);
    } catch (error) {
      if (error.message.includes('already awarded') || error.message.includes('own profile') || error.message.includes('Invalid')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      next(error);
    }
  };

  getAppreciationStats = async (req, res, next) => {
    try {
      const targetUserId = req.params.userId;
      const viewerId = req.user?.id || null;
      const stats = await this.appreciationService.getAppreciationStats(targetUserId, viewerId);
      if (!stats) {
        return ResponseUtil.error(res, 'Photographer not found', 404);
      }
      return ResponseUtil.success(res, 'Appreciation stats retrieved successfully', stats);
    } catch (error) {
      next(error);
    }
  };
}
