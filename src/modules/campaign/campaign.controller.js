import { CampaignService } from './campaign.service.js';

export class CampaignController {
  static async generateLink(req, res, next) {
    try {
      const result = await CampaignService.generateLink();
      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Promo link generated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req, res, next) {
    try {
      const result = await CampaignService.getStats();
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Campaign stats fetched successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLinks(req, res, next) {
    try {
      const result = await CampaignService.getLinks(req.query);
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Promo links fetched successfully',
        data: result.data,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLinkDetails(req, res, next) {
    try {
      const result = await CampaignService.getLinkDetails(req.params.id);
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Promo link details fetched successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async changeRewardStatus(req, res, next) {
    try {
      const { status } = req.body;
      const result = await CampaignService.changeRewardStatus(req.params.id, status);
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Reward status updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitCampaign(req, res, next) {
    try {
      const { token } = req.params;
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
      const result = await CampaignService.submitCampaign(token, req.body, req.files, sourceLang);
      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Campaign submitted successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
