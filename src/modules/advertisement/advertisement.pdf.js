import PDFDocument from 'pdfkit';
import moment from 'moment';
import path from 'path';

export class InvoicePdfGenerator {
  static async generate(advertisement) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this.generateHeader(doc, advertisement);
      this.generateCustomerInformation(doc, advertisement);
      this.generateInvoiceTable(doc, advertisement);
      this.generateFooter(doc, advertisement);

      doc.end();
    });
  }

  static generateHeader(doc, ad) {
    // Top Right Invoice Text
    doc
      .fillColor('#5156e1')
      .fontSize(24)
      .text('INVOICE', 350, 50, { width: 200, align: 'right' })
      .fillColor('#000000');

    // Load actual logo from public directory
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    try {
      doc.image(logoPath, 50, 45, { fit: [300, 150] });
    } catch (error) {
      console.warn('Could not load logo for PDF:', error.message);
      doc.fontSize(20).text('My12Photos', 50, 50);
    }

    // Company Address (pushed down to avoid logo overlap)
    const addressTop = 200;
    doc
      .fontSize(10)
      .fillColor('#444444')
      .text('1234 Business Avenue, Suite 100,', 50, addressTop)
      .text('San Francisco, CA 94102', 50, addressTop + 15)
      .text('my12photos@gmail.com', 50, addressTop + 30)
      .text('+1 (555) 123-4567', 50, addressTop + 45);

    // Invoice Details
    const detailsTop = 90;
    doc
      .fontSize(10)
      .fillColor('#777777')
      .text('Invoice Number:', 350, detailsTop, { width: 200, align: 'right' })
      .fillColor('#000000')
      .text(`INV-${moment(ad.createdAt).format('YYYY-MM')}-${ad.id.substring(0, 4).toUpperCase()}`, 350, detailsTop + 15, { width: 200, align: 'right' })
      
      .fillColor('#777777')
      .text('Invoice Date:', 350, detailsTop + 35, { width: 200, align: 'right' })
      .fillColor('#000000')
      .text(moment(ad.createdAt).format('MMMM D, YYYY'), 350, detailsTop + 50, { width: 200, align: 'right' })
      
      .fillColor('#777777')
      .text('Due Date:', 350, detailsTop + 70, { width: 200, align: 'right' })
      .fillColor('#000000')
      .text(moment(ad.createdAt).add(ad.durationDays, 'days').format('MMMM D, YYYY'), 350, detailsTop + 85, { width: 200, align: 'right' });
      
    // Line separator
    doc.moveTo(50, 270).lineTo(550, 270).lineWidth(0.5).strokeColor('#eeeeee').stroke();
  }

  static generateCustomerInformation(doc, ad) {
    const customerTop = 300;

    // Customer section
    doc
      .fontSize(12)
      .fillColor('#333333')
      .text('Customer Details', 50, customerTop);

    doc
      .fontSize(10)
      .fillColor('#000000')
      .text(ad.name, 50, customerTop + 25)
      .fillColor('#444444')
      .text(ad.email, 50, customerTop + 45)
      .text(ad.phone, 50, customerTop + 65);
  }

  static generateInvoiceTable(doc, ad) {
    const tableTop = 300;
    
    doc
      .fontSize(12)
      .fillColor('#5156e1')
      .text('Order Details', 300, tableTop);
      
    const generateRow = (y, name, value) => {
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(name, 300, y)
        .fillColor('#000000')
        .text(value, 400, y, { width: 150, align: 'right' });
    };

    generateRow(tableTop + 25, 'Business Type:', ad.businessType === 'LOCAL' ? 'Offline' : 'Online');
    generateRow(tableTop + 50, 'Business Name:', ad.businessName);
    generateRow(tableTop + 75, 'Select Page:', ad.selectPage);
    
    // Dates
    const startDateStr = ad.startsAt ? moment(ad.startsAt).format('MM/DD/YYYY') : 'Pending';
    const endDateStr = ad.endsAt ? moment(ad.endsAt).format('MM/DD/YYYY') : 'Pending';

    generateRow(tableTop + 100, 'Ads Start Date:', startDateStr);
    generateRow(tableTop + 125, 'Ads End Date:', endDateStr);
    generateRow(tableTop + 150, 'Total Days:', `${ad.durationDays} Days`);
  }

  static generateFooter(doc, ad) {
    const summaryTop = 500;
    
    // Line separator
    doc.moveTo(300, summaryTop).lineTo(550, summaryTop).lineWidth(0.5).strokeColor('#eeeeee').stroke();
    
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('Subtotal:', 300, summaryTop + 15)
      .fillColor('#000000')
      .text(`$${Number(ad.amount).toFixed(2)}`, 400, summaryTop + 15, { width: 150, align: 'right' });

    // Line for grand total
    doc.moveTo(300, summaryTop + 35).lineTo(550, summaryTop + 35).lineWidth(0.5).strokeColor('#dddddd').stroke();

    doc
      .fontSize(12)
      .fillColor('#000000')
      .text('Grand Total:', 300, summaryTop + 50)
      .fontSize(16)
      .fillColor('#f59e0b') // Golden/Yellow color as per mockup
      .text(`$${Number(ad.amount).toFixed(2)}`, 400, summaryTop + 48, { width: 150, align: 'right' });
  }
}
