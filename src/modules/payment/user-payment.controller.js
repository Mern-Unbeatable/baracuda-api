import { UserPaymentService } from './user-payment.service.js';
import { ResponseUtil } from '../../utils/response.js';

const userPaymentService = new UserPaymentService();

class UserPaymentController {
  async getPrizeMoney(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await userPaymentService.getPrizeMoneyStatsAndList(req.user.id, page, limit);
      return ResponseUtil.success(res, 'Prize money details fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getDonations(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await userPaymentService.getDonationStatsAndList(req.user.id, page, limit);
      return ResponseUtil.success(res, 'Donations details fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getPhotoSales(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const result = await userPaymentService.getPhotoSalesStatsAndList(req, req.user.id, search, page, limit);
      return ResponseUtil.success(res, 'Photo sales details fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async exportPhotoSales(req, res, next) {
    try {
      const search = req.query.search || '';
      // Fetch all without limit for export
      const result = await userPaymentService.getPhotoSalesStatsAndList(req, req.user.id, search, 1, 1000000);
      
      const sales = result.list.data;

      // Construct CSV
      let csvContent = 'Date,Buyer,Email,Photo,Sale Price,Your Earnings\n';
      sales.forEach(sale => {
        // Escape quotes and fields containing commas
        const escapeField = (str) => `"${String(str).replace(/"/g, '""')}"`;
        
        const date = escapeField(new Date(sale.date).toLocaleString());
        const buyer = escapeField(sale.buyer);
        const email = escapeField(sale.email);
        const photo = escapeField(sale.photo);
        const price = escapeField(`$${sale.salePrice.toFixed(2)}`);
        const earnings = escapeField(`$${sale.yourEarnings.toFixed(2)}`);
        
        csvContent += `${date},${buyer},${email},${photo},${price},${earnings}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="photo_sales.csv"');
      return res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
  async getStoreSales(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const result = await userPaymentService.getStoreSalesStatsAndList(req, req.user.id, search, page, limit);
      return ResponseUtil.success(res, 'Store sales details fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async exportStoreSales(req, res, next) {
    try {
      const search = req.query.search || '';
      // Fetch all without limit for export
      const result = await userPaymentService.getStoreSalesStatsAndList(req, req.user.id, search, 1, 1000000);
      
      const sales = result.list.data;

      // Construct CSV
      let csvContent = 'Date,Buyer,Email,Product,Quantity,Sale Price,Your Earnings\n';
      sales.forEach(sale => {
        // Escape quotes and fields containing commas
        const escapeField = (str) => `"${String(str).replace(/"/g, '""')}"`;
        
        const date = escapeField(new Date(sale.date).toLocaleString());
        const buyer = escapeField(sale.buyer);
        const email = escapeField(sale.email);
        const product = escapeField(sale.photo); // using 'photo' field which mapped to product title
        const quantity = escapeField(sale.quantity);
        const price = escapeField(`$${sale.salePrice.toFixed(2)}`);
        const earnings = escapeField(`$${sale.yourEarnings.toFixed(2)}`);
        
        csvContent += `${date},${buyer},${email},${product},${quantity},${price},${earnings}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="store_sales.csv"');
      return res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
  async getPaymentHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await userPaymentService.getPaymentHistory(req.user.id, page, limit);
      return ResponseUtil.success(res, 'Payment history fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async requestPayout(req, res, next) {
    try {
      const { type, amount, accountNumber } = req.body;
      const result = await userPaymentService.requestPayout(req.user.id, type, amount, 'payPal', accountNumber);
      return ResponseUtil.success(res, 'Payout requested successfully', result);
    } catch (error) {
      // If error is about insufficient balance, return 400
      if (error.message.includes('exceeds available balance')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      next(error);
    }
  }
}

export default new UserPaymentController();
