import prisma from '../../config/prisma.js';

export class OrderService {
  async getSellerStatusCard(sellerId) {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'COMPLETED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        items: {
          some: {
            product: { userId: sellerId }
          }
        }
      },
      include: {
        items: {
          where: { product: { userId: sellerId } }
        }
      }
    });

    const totalOrders = orders.length;
    let totalSales = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        totalSales += (Number(item.price) * item.quantity);
      });
    });

    const platformCommission = totalSales * 0.10;
    const sellerEarnings = totalSales * 0.90;

    return {
      totalOrders,
      totalSales,
      platformCommission,
      sellerEarnings
    };
  }

  async getSellerOrders(sellerId, filters, skip, take) {
    const { dateFilter, status } = filters;
    
    const where = {
      status: { not: 'PENDING' },
      items: {
        some: { product: { userId: sellerId } }
      }
    };

    if (status && status !== 'All') {
      where.status = status.toUpperCase();
    }

    if (dateFilter) {
      const now = new Date();
      if (dateFilter === 'Today') {
        now.setHours(0, 0, 0, 0);
        where.createdAt = { gte: now };
      } else if (dateFilter === 'This Week') {
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
        firstDay.setHours(0, 0, 0, 0);
        where.createdAt = { gte: firstDay };
      } else if (dateFilter === 'This Month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        where.createdAt = { gte: firstDay };
      }
    }

    let [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          items: {
            where: { product: { userId: sellerId } },
            include: { product: true }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    // Calculate commission for each order in the list
    orders = orders.map(order => {
      let orderTotal = 0;
      order.items.forEach(item => {
        orderTotal += (Number(item.price) * item.quantity);
      });
      const platformCommission = orderTotal * 0.10;
      const sellerEarnings = orderTotal * 0.90;
      return { ...order, platformCommission, sellerEarnings, orderTotal };
    });

    // Get status counts for the tabs
    const statusWhere = {
      status: { not: 'PENDING' },
      items: { some: { product: { userId: sellerId } } }
    };
    
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      where: statusWhere,
      _count: { _all: true }
    });

    const counts = {
      All: await prisma.order.count({ where: statusWhere }),
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0
    };

    statusCounts.forEach(sc => {
      if (sc.status === 'PROCESSING') counts.Processing = sc._count._all;
      if (sc.status === 'SHIPPED') counts.Shipped = sc._count._all;
      if (sc.status === 'DELIVERED') counts.Delivered = sc._count._all;
      if (sc.status === 'CANCELLED') counts.Cancelled = sc._count._all;
    });

    return { data: orders, total, counts };
  }

  async updateSellerOrderStatus(orderId, sellerId, status) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        items: { some: { product: { userId: sellerId } } }
      }
    });

    if (!order) throw new Error('Order not found or unauthorized');

    return prisma.order.update({
      where: { id: orderId },
      data: { status: status.toUpperCase() },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        items: { include: { product: true } }
      }
    });
  }

  async getSellerOrderDetails(orderId, sellerId) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        items: { some: { product: { userId: sellerId } } }
      },
      include: {
        user: { select: { id: true, name: true, avatar: true, email: true } },
        items: {
          where: { product: { userId: sellerId } },
          include: { product: true }
        }
      }
    });

    if (!order) throw new Error('Order not found or unauthorized');

    let orderTotal = 0;
    order.items.forEach(item => {
      orderTotal += (Number(item.price) * item.quantity);
    });
    const platformCommission = orderTotal * 0.10;
    const sellerEarnings = orderTotal * 0.90;

    return { ...order, platformCommission, sellerEarnings, orderTotal };
  }

  async getBuyerStatusCard(buyerId) {
    const orders = await prisma.order.findMany({
      where: {
        userId: buyerId,
        status: { not: 'PENDING' },
        items: { some: { productId: { not: null } } }
      }
    });

    const counts = {
      Total: orders.length,
      Processing: orders.filter(o => o.status === 'PROCESSING').length,
      Shipped: orders.filter(o => o.status === 'SHIPPED').length,
      Delivered: orders.filter(o => o.status === 'DELIVERED').length
    };

    return counts;
  }

  async getBuyerOrders(buyerId, skip, take) {
    const where = {
      userId: buyerId,
      status: { not: 'PENDING' },
      items: { some: { productId: { not: null } } }
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            where: { productId: { not: null } },
            include: { product: { include: { user: { select: { id: true, name: true, avatar: true } } } } }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    return { data: orders, total };
  }

  async getBuyerOrderDetails(orderId, buyerId) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: buyerId,
        items: { some: { productId: { not: null } } }
      },
      include: {
        items: {
          where: { productId: { not: null } },
          include: { product: { include: { user: { select: { id: true, name: true, avatar: true } } } } }
        }
      }
    });

    if (!order) throw new Error('Order not found or unauthorized');
    return order;
  }
}
