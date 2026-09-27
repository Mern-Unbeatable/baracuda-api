import { ResponseUtil } from '../../utils/response.js';
import { TranslateUtil } from '../../utils/translate.js';
import { UrlUtil } from '../../utils/urlUtil.js';

export class AdvertisementController {
  constructor(advertisementService) {
    this.advertisementService = advertisementService;
  }

  createAdvertisement = async (req, res) => {
    try {
      // Optional authentication: req.user might be undefined if guest
      const userId = req.user ? req.user.id : null;

      // Make sure durationDays is parsed as integer
      if (req.body.durationDays) {
        req.body.durationDays = parseInt(req.body.durationDays, 10);
      }

      if (req.body.description) {
        req.body.description_pl = await TranslateUtil.translateText(req.body.description, 'pl', 'en');
      }
      if (req.body.location) {
        req.body.location_pl = await TranslateUtil.translateText(req.body.location, 'pl', 'en');
      }

      const result = await this.advertisementService.createAdvertisement(req.body, req.file, userId);
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      if (result.advertisement.businessImage && !result.advertisement.businessImage.startsWith('http')) {
        result.advertisement.businessImage = `${baseUrl}${result.advertisement.businessImage}`;
      }

      return ResponseUtil.success(res, 'Advertisement submitted, please complete payment', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  capturePayment = async (req, res) => {
    try {
      const { paymentId } = req.body;
      if (!paymentId) {
        return ResponseUtil.error(res, 'Payment ID is required', 400);
      }

      const advertisement = await this.advertisementService.capturePayment(paymentId);
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      if (advertisement.businessImage && !advertisement.businessImage.startsWith('http')) {
        advertisement.businessImage = `${baseUrl}${advertisement.businessImage}`;
      }

      return ResponseUtil.success(res, 'Payment captured successfully, advertisement is IN_REVIEW', advertisement);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  downloadInvoice = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return ResponseUtil.error(res, 'Advertisement ID is required', 400);
      }

      const lang = req.headers['accept-language']?.includes('pl') ? 'pl' : 'en';
      const pdfBuffer = await this.advertisementService.generateInvoicePdf(id, lang);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // --- PUBLIC APIs ---

  getPublicAds = async (req, res) => {
    try {
      const pageName = req.query.page;
      const result = await this.advertisementService.getPublicAds(req, pageName);
      return ResponseUtil.success(res, 'Public advertisements retrieved successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // --- ADMIN APIs ---

  getAllAdvertisements = async (req, res) => {
    try {
      const result = await this.advertisementService.getAllAdvertisements(req.query);
      if (result.data) {
        result.data = result.data.map(ad => {
          if (ad.businessImage) ad.businessImage = UrlUtil.getAbsoluteUrl(req, ad.businessImage);
          return ad;
        });
      }
      return ResponseUtil.success(res, 'Advertisements retrieved successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getAdvertisementById = async (req, res) => {
    try {
      const { id } = req.params;
      const result = await this.advertisementService.getAdvertisementById(id);
      if (result && result.businessImage) {
        result.businessImage = UrlUtil.getAbsoluteUrl(req, result.businessImage);
      }
      return ResponseUtil.success(res, 'Advertisement retrieved successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  updateAdvertisementStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return ResponseUtil.error(res, 'Status is required', 400);
      }
      const result = await this.advertisementService.updateStatus(id, status);
      if (result && result.businessImage) {
        result.businessImage = UrlUtil.getAbsoluteUrl(req, result.businessImage);
      }
      return ResponseUtil.success(res, 'Advertisement status updated successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}
