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

    const vatAmount = totalSales * 0.20;
    const platformCommission = totalSales * 0.10;
    const sellerEarnings = totalSales - vatAmount - platformCommission; // 70% net

    return {
      totalOrders,
      totalSales,
      vatAmount,
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
      const vatAmount = orderTotal * 0.20;
      const platformCommission = orderTotal * 0.10;
      const sellerEarnings = orderTotal - vatAmount - platformCommission; // 70% net
      return { ...order, vatAmount, platformCommission, sellerEarnings, orderTotal };
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
      Dispatched: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0
    };

    statusCounts.forEach(sc => {
      if (sc.status === 'PROCESSING') counts.Processing = sc._count._all;
      if (sc.status === 'SHIPPED') { counts.Shipped = sc._count._all; counts.Dispatched = (counts.Dispatched || 0) + sc._count._all; }
      if (sc.status === 'DISPATCHED') { counts.Dispatched = (counts.Dispatched || 0) + sc._count._all; counts.Shipped = (counts.Shipped || 0) + sc._count._all; }
      if (sc.status === 'DELIVERED') counts.Delivered = sc._count._all;
      if (sc.status === 'CANCELLED') counts.Cancelled = sc._count._all;
    });

    return { data: orders, total, counts };
  }

  async updateSellerOrderStatus(orderId, sellerId, statusData) {
    const rawStatus = typeof statusData === 'string' ? statusData : statusData?.status;
    const trackingNumber = statusData?.trackingNumber !== undefined ? statusData.trackingNumber : null;
    const courierName = statusData?.courierName !== undefined ? statusData.courierName : null;
    let trackingUrl = statusData?.trackingUrl !== undefined ? statusData.trackingUrl : null;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        items: { some: { product: { userId: sellerId } } }
      },
      include: {
        user: true,
        items: { include: { product: true } }
      }
    });

    if (!order) throw new Error('Order not found or unauthorized');

    const status = (rawStatus || order.status).toUpperCase();

    // Auto-resolve courier tracking URL if trackingNumber is present and no custom URL
    if (trackingNumber && !trackingUrl && courierName) {
      const c = courierName.toLowerCase().replace(/[^a-z]/g, '');
      if (c.includes('royalmail')) {
        trackingUrl = `https://www.royalmail.com/track-your-item#/tracking-details/${encodeURIComponent(trackingNumber)}`;
      } else if (c.includes('dhl')) {
        trackingUrl = `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackingNumber)}`;
      } else if (c.includes('inpost')) {
        trackingUrl = `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(trackingNumber)}`;
      } else if (c.includes('dpd')) {
        trackingUrl = `https://track.dpd.co.uk/parcels/${encodeURIComponent(trackingNumber)}`;
      } else if (c.includes('fedex')) {
        trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
      } else if (c.includes('ups')) {
        trackingUrl = `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
      } else {
        trackingUrl = `https://parcelsapp.com/en/tracking/${encodeURIComponent(trackingNumber)}`;
      }
    }

    const updatePayload = {
      status
    };
    if (trackingNumber !== null) updatePayload.trackingNumber = trackingNumber;
    if (courierName !== null) updatePayload.courierName = courierName;
    if (trackingUrl !== null) updatePayload.trackingUrl = trackingUrl;
    if ((status === 'DISPATCHED' || status === 'SHIPPED') && !order.dispatchedAt) {
      updatePayload.dispatchedAt = new Date();
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updatePayload,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        items: { include: { product: true } }
      }
    });

    // Send dispatch notification to buyer
    if (order.userId && (status.toUpperCase() === 'DISPATCHED' || status.toUpperCase() === 'SHIPPED')) {
      try {
        const firstProductTitle = order.items?.[0]?.product?.title || 'your item';
        await prisma.notification.create({
          data: {
            userId: order.userId,
            type: 'SALE',
            title: 'Item Dispatched!',
            title_pl: 'Przedmiot został wysłany!',
            body: `Your order for "${firstProductTitle}" has been dispatched via ${courierName || 'courier'}. Tracking: ${trackingNumber || 'Available in order details'}.`,
            body_pl: `Twoje zamówienie na "${firstProductTitle}" zostało wysłane za pośrednictwem ${courierName || 'kuriera'}.`,
            linkUrl: `/user/my-orders/${orderId}`
          }
        });
      } catch (err) {
        console.error('Failed to create dispatch notification:', err);
      }
    }

    return updated;
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
    const vatAmount = orderTotal * 0.20;
    const platformCommission = orderTotal * 0.10;
    const sellerEarnings = orderTotal - vatAmount - platformCommission; // 70% net

    return { ...order, vatAmount, platformCommission, sellerEarnings, orderTotal };
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
