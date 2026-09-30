import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { UrlUtil } from '../../utils/urlUtil.js';
import { TranslateUtil } from '../../utils/translate.js';
import prisma from '../../config/prisma.js';

export class StoreController {
  constructor(storeService) {
    this.storeService = storeService;
  }

  formatProductUrls(req, product) {
    if (!product) return product;
    const formatted = { ...product };

    const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
    
    if (sourceLang === 'pl') {
      if (formatted.title_pl) formatted.title = formatted.title_pl;
      if (formatted.description_pl) formatted.description = formatted.description_pl;
    }

    if (formatted.user && formatted.user.avatar && !formatted.user.avatar.startsWith('http')) {
      formatted.user.avatar = UrlUtil.getAbsoluteUrl(req, formatted.user.avatar);
    }
    if (formatted.bannerImage && !formatted.bannerImage.startsWith('http')) {
      formatted.bannerImage = UrlUtil.getAbsoluteUrl(req, formatted.bannerImage);
    }
    if (formatted.images && Array.isArray(formatted.images)) {
      formatted.images = formatted.images.map(img => UrlUtil.getAbsoluteUrl(req, img));
    }
    
    if (formatted.price !== undefined && formatted.price !== null) {
      formatted.price = parseFloat(formatted.price);
    }

    return formatted;
  }

  createProduct = async (req, res) => {
    try {
      const { title, description } = req.body;
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';

      let finalTitle = title;
      let finalTitlePl = null;
      let finalDesc = description;
      let finalDescPl = null;

      const promises = [];
      if (title) {
        if (sourceLang === 'pl') {
          finalTitlePl = title;
          promises.push(TranslateUtil.translateText(title, 'en', 'pl').then(t => finalTitle = t));
        } else {
          promises.push(TranslateUtil.translateText(title, 'pl', 'en').then(t => finalTitlePl = t));
        }
      }

      if (description) {
        if (sourceLang === 'pl') {
          finalDescPl = description;
          promises.push(TranslateUtil.translateText(description, 'en', 'pl').then(t => finalDesc = t));
        } else {
          promises.push(TranslateUtil.translateText(description, 'pl', 'en').then(t => finalDescPl = t));
        }
      }

      await Promise.all(promises);

      const data = {
        ...req.body,
        title: finalTitle,
        title_pl: finalTitlePl,
        description: finalDesc,
        description_pl: finalDescPl,
      };

      let product = await this.storeService.createProduct(req.user.id, data, req.files || {});
      product = this.formatProductUrls(req, product);

      return ResponseUtil.success(res, 'Product created successfully', product, 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getAllProducts = async (req, res) => {
    try {
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);
      const filters = {};
      if (req.query.category) {
        filters.category = req.query.category;
      }
      
      let targetUserId = req.user?.id;
      if (req.query.username) {
        const user = await prisma.user.findUnique({ where: { username: req.query.username }, select: { id: true } });
        if (!user) return ResponseUtil.error(res, 'User not found', 404);
        targetUserId = user.id;
      }

      if (!targetUserId) {
        return ResponseUtil.error(res, 'Authentication required to view your own store', 401);
      }
      
      filters.userId = targetUserId;

      const result = await this.storeService.getAllProducts(filters, skip, take);
      
      const formattedProducts = result.data.map(p => this.formatProductUrls(req, p));

      return ResponseUtil.success(res, 'Products fetched successfully', {
        data: formattedProducts,
        meta: PaginationUtil.getMetadata(result.total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getProductById = async (req, res) => {
    try {
      let product = await this.storeService.getProductById(req.params.id);
      if (!product) return ResponseUtil.error(res, 'Product not found', 404);
      
      product = this.formatProductUrls(req, product);
      return ResponseUtil.success(res, 'Product fetched successfully', product);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  updateProduct = async (req, res) => {
    try {
      const updateData = {};
      const { title, description, category, price, setEditionSize, isActive } = req.body;
      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';

      const promises = [];
      if (title !== undefined) {
        if (sourceLang === 'pl') {
          updateData.title_pl = title;
          promises.push(TranslateUtil.translateText(title, 'en', 'pl').then(t => updateData.title = t));
        } else {
          updateData.title = title;
          promises.push(TranslateUtil.translateText(title, 'pl', 'en').then(t => updateData.title_pl = t));
        }
      }

      if (description !== undefined) {
        if (sourceLang === 'pl') {
          updateData.description_pl = description;
          promises.push(TranslateUtil.translateText(description, 'en', 'pl').then(t => updateData.description = t));
        } else {
          updateData.description = description;
          promises.push(TranslateUtil.translateText(description, 'pl', 'en').then(t => updateData.description_pl = t));
        }
      }
      
      await Promise.all(promises);

      if (category !== undefined) updateData.category = category;
      if (price !== undefined) updateData.price = price;
      if (setEditionSize !== undefined) updateData.setEditionSize = setEditionSize;
      if (isActive !== undefined) updateData.isActive = isActive;

      let product = await this.storeService.updateProduct(req.params.id, req.user.id, updateData, req.files || {});
      product = this.formatProductUrls(req, product);

      return ResponseUtil.success(res, 'Product updated successfully', product);
    } catch (error) {
      return ResponseUtil.error(res, error.message, error.message === 'Unauthorized' ? 403 : 500);
    }
  };

  deleteProduct = async (req, res) => {
    try {
      await this.storeService.deleteProduct(req.params.id, req.user.id);
      return ResponseUtil.success(res, 'Product deleted successfully', null);
    } catch (error) {
      return ResponseUtil.error(res, error.message, error.message === 'Unauthorized' ? 403 : 500);
    }
  };

  promoteProduct = async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { durationDays } = req.body;
      
      const { default: paymentService } = await import('../payment/payment.service.js');
      const result = await paymentService.createProductPromotionPayment(id, Number(durationDays), userId);
      
      res.status(200).json({ success: true, data: result, message: 'Checkout URL generated successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  capturePromotion = async (req, res) => {
    try {
      const { paymentId } = req.body;
      
      const { default: paymentService } = await import('../payment/payment.service.js');
      const result = await paymentService.captureProductPromotionPayment(paymentId);
      
      res.status(200).json({ success: true, data: result, message: 'Promotion payment captured successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  getPublicStores = async (req, res) => {
    try {
      const { search, promoted, category, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const filters = { search, promoted, category };
      const { data, total } = await this.storeService.getPublicStores(filters, skip, take);

      const formattedData = data.map(store => {
        const formattedStore = { ...store };
        
        if (formattedStore.avatar && !formattedStore.avatar.startsWith('http')) {
          formattedStore.avatar = UrlUtil.getAbsoluteUrl(req, formattedStore.avatar);
        }
        
        if (formattedStore.products && Array.isArray(formattedStore.products)) {
          formattedStore.products = formattedStore.products.map(product => this.formatProductUrls(req, product));
        }
        
        return formattedStore;
      });

      return ResponseUtil.success(res, 'Public stores fetched successfully', {
        data: formattedData,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  buyProduct = async (req, res) => {
    try {
      const { email, fullName, mobile, city, state, zipCode, deliveryAddress, quantity, size } = req.body;
      if (!email || !fullName || !mobile || !city || !state || !zipCode || !deliveryAddress) {
        return ResponseUtil.error(res, 'All delivery details are required', 400);
      }
      
      const userId = req.user.id;
      const orderDetails = { email, fullName, mobile, city, state, zipCode, deliveryAddress, quantity, size };
      
      const { default: paymentService } = await import('../payment/payment.service.js');
      const result = await paymentService.createStoreProductPurchase(req.params.id, userId, orderDetails);
      
      return ResponseUtil.success(res, 'Product checkout created', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  capturePurchase = async (req, res) => {
    try {
      const { paymentId } = req.body;
      if (!paymentId) return ResponseUtil.error(res, 'paymentId is required', 400);

      const { default: paymentService } = await import('../payment/payment.service.js');
      const result = await paymentService.captureStoreProductPurchase(paymentId);
      return ResponseUtil.success(res, 'Product purchase successful', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };
}
