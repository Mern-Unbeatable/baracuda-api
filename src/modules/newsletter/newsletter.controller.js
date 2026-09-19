import config from '../../config/env.js';

export class NewsletterController {
  constructor(newsletterService) {
    this.newsletterService = newsletterService;
  }

  subscribe = async (req, res, next) => {
    try {
      const { email } = req.validatedBody;
      const subscriber = await this.newsletterService.subscribe(email);
      
      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Successfully subscribed to the newsletter',
        data: subscriber
      });
    } catch (error) {
      next(error);
    }
  };

  getAllSubscribers = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const result = await this.newsletterService.getAllSubscribers(skip, limit);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Newsletter subscribers fetched successfully',
        data: result,
        meta: {
          currentPage: page,
          totalPages: Math.ceil(result.total / limit),
          totalRecords: result.total,
          hasNext: skip + limit < result.total,
          hasPrevious: page > 1
        }
      });
    } catch (error) {
      next(error);
    }
  };

  sendCampaign = async (req, res, next) => {
    try {
      const campaign = await this.newsletterService.sendCampaign(req.validatedBody, req.file);
      
      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Newsletter campaign has been queued for sending',
        data: campaign
      });
    } catch (error) {
      next(error);
    }
  };
}
