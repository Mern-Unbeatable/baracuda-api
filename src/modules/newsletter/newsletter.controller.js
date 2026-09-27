import config from '../../config/env.js';
import { TranslateUtil } from '../../utils/translate.js';

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
      let { subject, title, content, ctaText } = req.validatedBody;
      
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
      
      let subject_pl = subject;
      let title_pl = title;
      let content_pl = content;
      let ctaText_pl = ctaText || null;

      if (sourceLang === 'pl') {
        subject_pl = subject;
        subject = subject ? await TranslateUtil.translateText(subject, 'pl', 'en') : subject;
        
        title_pl = title;
        title = title ? await TranslateUtil.translateText(title, 'pl', 'en') : title;
        
        content_pl = content;
        content = content ? await TranslateUtil.translateText(content, 'pl', 'en') : content;
        
        if (ctaText) {
          ctaText_pl = ctaText;
          ctaText = await TranslateUtil.translateText(ctaText, 'pl', 'en');
        }
      } else {
        subject_pl = subject ? await TranslateUtil.translateText(subject, 'en', 'pl') : null;
        title_pl = title ? await TranslateUtil.translateText(title, 'en', 'pl') : null;
        content_pl = content ? await TranslateUtil.translateText(content, 'en', 'pl') : null;
        ctaText_pl = ctaText ? await TranslateUtil.translateText(ctaText, 'en', 'pl') : null;
      }
      
      const payload = {
        ...req.validatedBody,
        subject,
        title,
        content,
        ctaText,
        subject_pl,
        title_pl,
        content_pl,
        ctaText_pl
      };

      const campaign = await this.newsletterService.sendCampaign(payload, req.file);
      
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
