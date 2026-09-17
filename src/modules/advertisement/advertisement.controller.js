import { ResponseUtil } from '../../utils/response.js';

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
}
