import PDFDocument from 'pdfkit';
import moment from 'moment';
import path from 'path';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

/**
 * Builds a simple buyer order invoice PDF buffer.
 */
export class OrderInvoicePdfGenerator {
  static async generate(order) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const orderCode = `ORD-${String(order.id || '').split('-')[0].toUpperCase()}`;
      const invoiceCode = `INV-${moment(order.createdAt).format('YYYYMM')}-${String(order.id || '').slice(0, 4).toUpperCase()}`;
      const items = Array.isArray(order.items) ? order.items : [];

      // Header — logo (left) + invoice meta (right), vertically centered
      const headerTop = 42;
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      // Square logo asset; 1.5x prior 100px render size
      const logoSize = 150;
      const metaBlockHeight = 74;
      const metaTop = headerTop + (logoSize - metaBlockHeight) / 2;

      try {
        doc.image(logoPath, 50, headerTop, {
          width: logoSize,
          height: logoSize,
        });
      } catch {
        doc
          .fontSize(28)
          .fillColor('#161c27')
          .text('My12Photos', 50, headerTop + 40);
      }

      doc
        .fillColor('#4048cd')
        .fontSize(22)
        .text('INVOICE', 350, metaTop, { width: 200, align: 'right' })
        .fillColor('#6b7280')
        .fontSize(10)
        .text(`Invoice: ${invoiceCode}`, 350, metaTop + 30, {
          width: 200,
          align: 'right',
        })
        .text(`Order: #${orderCode}`, 350, metaTop + 45, {
          width: 200,
          align: 'right',
        })
        .text(
          `Date: ${moment(order.createdAt).format('DD MMM YYYY')}`,
          350,
          metaTop + 60,
          { width: 200, align: 'right' },
        );

      const dividerY = headerTop + logoSize + 18;
      doc
        .moveTo(50, dividerY)
        .lineTo(545, dividerY)
        .lineWidth(1)
        .strokeColor('#e5e7eb')
        .stroke();

      // Buyer
      const buyerTop = dividerY + 20;
      doc
        .fillColor('#161c27')
        .fontSize(12)
        .text('Billed To', 50, buyerTop)
        .fontSize(10)
        .fillColor('#374151')
        .text(order.fullName || 'Customer', 50, buyerTop + 20)
        .text(order.email || '-', 50, buyerTop + 35);

      let shippingText = '';
      if (order.address) {
        try {
          const parsed =
            typeof order.address === 'string'
              ? JSON.parse(order.address)
              : order.address;
          shippingText = [
            parsed?.line1 || parsed?.address,
            parsed?.city,
            parsed?.postal,
            parsed?.country,
          ]
            .filter(Boolean)
            .join(', ');
        } catch {
          shippingText = String(order.address);
        }
      }
      if (shippingText) {
        doc.text(shippingText, 50, buyerTop + 50, { width: 240 });
      }

      // Payment meta
      doc
        .fillColor('#161c27')
        .fontSize(12)
        .text('Payment', 320, buyerTop)
        .fontSize(10)
        .fillColor('#374151')
        .text(`Status: ${order.status || 'PAID'}`, 320, buyerTop + 20)
        .text(`Method: ${order.paymentMethod || 'PayPal'}`, 320, buyerTop + 35);

      // Table header
      const tableTop = buyerTop + 100;
      doc
        .rect(50, tableTop, 495, 24)
        .fill('#f3f4f6');

      doc
        .fillColor('#374151')
        .fontSize(10)
        .text('Item', 58, tableTop + 7)
        .text('Qty', 330, tableTop + 7, { width: 40, align: 'right' })
        .text('Price', 380, tableTop + 7, { width: 70, align: 'right' })
        .text('Total', 460, tableTop + 7, { width: 75, align: 'right' });

      let y = tableTop + 36;
      let subtotal = 0;

      items.forEach((item) => {
        const title =
          item.product?.title?.en ||
          item.product?.title ||
          item.premiumPhoto?.title?.en ||
          item.premiumPhoto?.title ||
          'Product';
        const qty = Number(item.quantity || 1);
        const unit = Number(item.price || 0);
        const lineTotal = unit * qty;
        subtotal += lineTotal;

        doc
          .fillColor('#111827')
          .fontSize(10)
          .text(String(title).slice(0, 48), 58, y, { width: 260 })
          .text(String(qty), 330, y, { width: 40, align: 'right' })
          .text(money(unit), 380, y, { width: 70, align: 'right' })
          .text(money(lineTotal), 460, y, { width: 75, align: 'right' });

        y += 22;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      });

      if (!items.length) {
        doc
          .fillColor('#6b7280')
          .fontSize(10)
          .text('No line items found for this order.', 58, y);
        y += 24;
      }

      const total = Number(order.total || subtotal);
      y += 10;
      doc
        .moveTo(320, y)
        .lineTo(545, y)
        .strokeColor('#e5e7eb')
        .stroke();

      y += 14;
      doc
        .fillColor('#6b7280')
        .fontSize(10)
        .text('Subtotal', 330, y)
        .fillColor('#111827')
        .text(money(subtotal), 460, y, { width: 75, align: 'right' });

      y += 20;
      doc
        .fillColor('#111827')
        .fontSize(12)
        .text('Grand Total', 330, y)
        .fillColor('#4048cd')
        .fontSize(14)
        .text(money(total), 460, y, { width: 75, align: 'right' });

      doc
        .fillColor('#9ca3af')
        .fontSize(9)
        .text(
          'Thank you for shopping with My12Photos.',
          50,
          760,
          { align: 'center', width: 495 },
        );

      doc.end();
    });
  }
}
