import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { OrderValidation } from './order.validation.js';

export class OrderModule {
  constructor() {
    this.router = Router();
    this.orderController = new OrderController();
    this.setupRoutes();
  }

  setupRoutes() {
    // Seller Routes
    this.router.get(
      '/seller/status-card',
      requireAuth,
      this.orderController.getSellerStatusCard
    );

    this.router.get(
      '/seller',
      requireAuth,
      this.orderController.getSellerOrders
    );

    this.router.get(
      '/seller/:id',
      requireAuth,
      this.orderController.getSellerOrderDetails
    );

    this.router.put(
      '/seller/:id/status',
      requireAuth,
      OrderValidation.validate(OrderValidation.updateStatusSchema),
      this.orderController.updateSellerOrderStatus
    );

    // Buyer Routes
    this.router.get(
      '/buyer/status-card',
      requireAuth,
      this.orderController.getBuyerStatusCard
    );

    this.router.get(
      '/buyer',
      requireAuth,
      this.orderController.getBuyerOrders
    );

    this.router.get(
      '/buyer/:id',
      requireAuth,
      this.orderController.getBuyerOrderDetails
    );
  }
}
