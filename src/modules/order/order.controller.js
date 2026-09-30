import { OrderService } from './order.service.js';
import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { UrlUtil } from '../../utils/urlUtil.js';

export class OrderController {
  constructor() {
    this.orderService = new OrderService();
  }

  formatOrderUrls(req, order) {
    if (!order) return order;
    const formatted = { ...order };

    if (formatted.user && formatted.user.avatar && !formatted.user.avatar.startsWith('http')) {
      formatted.user.avatar = UrlUtil.getAbsoluteUrl(req, formatted.user.avatar);
    }

    if (formatted.total) {
      formatted.total = Number(formatted.total);
    }

    if (formatted.items && Array.isArray(formatted.items)) {
      formatted.items = formatted.items.map(item => {
        const fItem = { ...item };
        if (fItem.price) {
          fItem.price = Number(fItem.price);
        }
        if (fItem.product) {
          if (fItem.product.price) {
            fItem.product.price = Number(fItem.product.price);
          }
          if (fItem.product.bannerImage && !fItem.product.bannerImage.startsWith('http')) {
            fItem.product.bannerImage = UrlUtil.getAbsoluteUrl(req, fItem.product.bannerImage);
          }
          if (fItem.product.images && Array.isArray(fItem.product.images)) {
            fItem.product.images = fItem.product.images.map(img => 
              img.startsWith('http') ? img : UrlUtil.getAbsoluteUrl(req, img)
            );
          }
          if (fItem.product.user && fItem.product.user.avatar && !fItem.product.user.avatar.startsWith('http')) {
            fItem.product.user.avatar = UrlUtil.getAbsoluteUrl(req, fItem.product.user.avatar);
          }
          
          const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
          if (sourceLang === 'pl') {
            if (fItem.product.title_pl) fItem.product.title = fItem.product.title_pl;
            if (fItem.product.description_pl) fItem.product.description = fItem.product.description_pl;
          }
        }

        return fItem;
      });
    }

    return formatted;
  }

  getSellerStatusCard = async (req, res) => {
    try {
      const sellerId = req.user.id;
      const result = await this.orderService.getSellerStatusCard(sellerId);
      return ResponseUtil.success(res, 'Seller status card fetched successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getSellerOrders = async (req, res) => {
    try {
      const sellerId = req.user.id;
      const { date, status, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const filters = { dateFilter: date, status };
      const { data, total, counts } = await this.orderService.getSellerOrders(sellerId, filters, skip, take);

      const formattedData = data.map(order => this.formatOrderUrls(req, order));

      const uiData = formattedData.map(order => {
        const firstItem = order.items && order.items[0] ? order.items[0] : null;
        return {
          id: order.id,
          orderIdDisplay: `#ORD-${order.id.split('-')[0].toUpperCase()}`,
          customer: order.user ? {
            name: order.user.name,
            avatar: order.user.avatar
          } : { name: order.fullName || 'Guest', avatar: null },
          product: firstItem && firstItem.product ? {
            image: firstItem.product.images && firstItem.product.images.length > 0 ? firstItem.product.images[0] : null,
            title: firstItem.product.title,
            quantity: firstItem.quantity
          } : null,
          date: order.createdAt,
          total: order.orderTotal,
          adminCommission: order.platformCommission,
          sellerEarnings: order.sellerEarnings,
          status: order.status
        };
      });

      return ResponseUtil.success(res, 'Seller orders fetched successfully', {
        data: uiData,
        counts,
        meta: PaginationUtil.getMetadata(total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  updateSellerOrderStatus = async (req, res) => {
    try {
      const sellerId = req.user.id;
      const { id } = req.params;
      const { status } = req.body;

      let result = await this.orderService.updateSellerOrderStatus(id, sellerId, status);
      result = this.formatOrderUrls(req, result);

      return ResponseUtil.success(res, 'Order status updated successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getSellerOrderDetails = async (req, res) => {
    try {
      const sellerId = req.user.id;
      const { id } = req.params;

      let result = await this.orderService.getSellerOrderDetails(id, sellerId);
      result = this.formatOrderUrls(req, result);

      let parsedAddress = null;
      try {
        if (result.address) parsedAddress = JSON.parse(result.address);
      } catch (e) {}

      const uiData = {
        id: result.id,
        orderIdDisplay: `#ORD-${result.id.split('-')[0].toUpperCase()}`,
        date: result.createdAt,
        status: result.status,
        paymentStatus: result.status === 'PENDING' ? 'Pending' : 'Paid',
        customer: {
          name: result.user ? result.user.name : result.fullName,
          email: result.user ? result.user.email : result.email,
          avatar: result.user ? result.user.avatar : null,
          phone: parsedAddress ? parsedAddress.mobile : null,
          address: parsedAddress || null
        },
        items: result.items.map(item => ({
          id: item.id,
          price: Number(item.price),
          quantity: item.quantity,
          size: item.size,
          product: item.product ? {
            id: item.product.id,
            image: item.product.images && item.product.images.length > 0 ? item.product.images[0] : null,
            title: item.product.title,
            category: item.product.category
          } : null
        })),
        paymentBreakdown: {
          orderTotal: Number(result.orderTotal || result.total),
          platformCommission: Number(result.platformCommission || 0),
          sellerEarnings: Number(result.sellerEarnings || result.total)
        }
      };

      return ResponseUtil.success(res, 'Order details fetched successfully', uiData);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getBuyerStatusCard = async (req, res) => {
    try {
      const buyerId = req.user.id;
      const result = await this.orderService.getBuyerStatusCard(buyerId);
      return ResponseUtil.success(res, 'Buyer status card fetched successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getBuyerOrders = async (req, res) => {
    try {
      const buyerId = req.user.id;
      const { page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const { data, total } = await this.orderService.getBuyerOrders(buyerId, skip, take);

      const formattedData = data.map(order => this.formatOrderUrls(req, order));

      const uiData = formattedData.map(order => {
        const firstItem = order.items && order.items[0] ? order.items[0] : null;
        let estimatedDelivery = null;
        if (order.createdAt) {
          const orderDate = new Date(order.createdAt);
          const startDel = new Date(orderDate);
          startDel.setDate(startDel.getDate() + 5);
          const endDel = new Date(orderDate);
          endDel.setDate(endDel.getDate() + 7);
          estimatedDelivery = `Est. ${startDel.toLocaleString('default', { month: 'short' })} ${startDel.getDate()}-${endDel.getDate()}`;
        }
        
        return {
          id: order.id,
          orderIdDisplay: `#ORD-${order.id.split('-')[0].toUpperCase()}`,
          date: order.createdAt,
          status: order.status,
          product: firstItem && firstItem.product ? {
            image: firstItem.product.images && firstItem.product.images.length > 0 ? firstItem.product.images[0] : null,
            title: firstItem.product.title,
            sellerName: firstItem.product.user ? firstItem.product.user.name : 'Unknown',
            quantity: firstItem.quantity,
            itemPrice: firstItem.price
          } : null,
          total: Number(order.total),
          paymentStatus: order.status === 'PENDING' ? 'Pending' : 'Paid',
          paymentMethod: order.paymentMethod || 'PayPal',
          delivery: estimatedDelivery
        };
      });

      return ResponseUtil.success(res, 'Buyer orders fetched successfully', {
        data: uiData,
        meta: PaginationUtil.getMetadata(total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getBuyerOrderDetails = async (req, res) => {
    try {
      const buyerId = req.user.id;
      const { id } = req.params;

      let result = await this.orderService.getBuyerOrderDetails(id, buyerId);
      result = this.formatOrderUrls(req, result);

      let parsedAddress = null;
      try {
        if (result.address) parsedAddress = JSON.parse(result.address);
      } catch (e) {}

      let estimatedDelivery = null;
      if (result.createdAt) {
        const orderDate = new Date(result.createdAt);
        const startDel = new Date(orderDate);
        startDel.setDate(startDel.getDate() + 5);
        const endDel = new Date(orderDate);
        endDel.setDate(endDel.getDate() + 7);
        estimatedDelivery = `Est. ${startDel.toLocaleString('default', { month: 'short' })} ${startDel.getDate()}-${endDel.getDate()}`;
      }

      const uiData = {
        id: result.id,
        orderIdDisplay: `#ORD-${result.id.split('-')[0].toUpperCase()}`,
        date: result.createdAt,
        status: result.status,
        paymentStatus: result.status === 'PENDING' ? 'Pending' : 'Paid',
        shippingInformation: {
          address: parsedAddress || null,
          estimatedDelivery
        },
        items: result.items.map(item => ({
          id: item.id,
          price: Number(item.price),
          quantity: item.quantity,
          size: item.size,
          product: item.product ? {
            id: item.product.id,
            image: item.product.images && item.product.images.length > 0 ? item.product.images[0] : null,
            title: item.product.title,
            seller: item.product.user ? {
              id: item.product.user.id,
              name: item.product.user.name,
              avatar: item.product.user.avatar
            } : null
          } : null
        })),
        paymentSummary: {
          subtotal: Number(result.total),
          shipping: 0,
          discount: 0,
          totalPaid: Number(result.total),
          paymentMethod: result.paymentMethod || 'PayPal'
        }
      };

      return ResponseUtil.success(res, 'Buyer order details fetched successfully', uiData);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };
}
