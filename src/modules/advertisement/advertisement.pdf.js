import PDFDocument from 'pdfkit';
import moment from 'moment';

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
      .text('INVOICE', 400, 50, { align: 'right' })
      .fillColor('#000000');

    // Logo placeholder (the user said they will change it manually)
    doc
      .fontSize(20)
      .fillColor('#e63946')
      .text('12', 50, 50, { continued: true })
      .fillColor('#000000')
      .text(' My12Photos')
      .fontSize(10)
      .text('ALWAYS TO BELOW. AS ABOVE TO ABOVE.', 50, 75);

    // Company Address
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('1234 Business Avenue, Suite 100,', 50, 100)
      .text('San Francisco, CA 94102', 50, 115)
      .text('my12photos@gmail.com', 50, 130)
      .text('+1 (555) 123-4567', 50, 145);

    // Invoice Details
    doc
      .fontSize(10)
      .fillColor('#aaaaaa')
      .text('Invoice Number:', 400, 90, { align: 'right' })
      .fillColor('#000000')
      .text(`INV-${moment(ad.createdAt).format('YYYY-MM')}-${ad.id.substring(0, 4).toUpperCase()}`, 400, 105, { align: 'right' })
      
      .fillColor('#aaaaaa')
      .text('Invoice Date:', 400, 125, { align: 'right' })
      .fillColor('#000000')
      .text(moment(ad.createdAt).format('MMMM D, YYYY'), 400, 140, { align: 'right' })
      
      .fillColor('#aaaaaa')
      .text('Due Date:', 400, 160, { align: 'right' })
      .fillColor('#000000')
      .text(moment(ad.createdAt).add(ad.durationDays, 'days').format('MMMM D, YYYY'), 400, 175, { align: 'right' });
      
    // Line separator
    doc.moveTo(50, 205).lineTo(550, 205).lineWidth(0.5).strokeColor('#eeeeee').stroke();
  }

  static generateCustomerInformation(doc, ad) {
    const customerTop = 230;

    // Customer section
    doc
      .fontSize(14)
      .fillColor('#333333')
      .text('Customer Details', 50, customerTop);

    doc
      .fontSize(10)
      .fillColor('#000000')
      .text(ad.name, 50, customerTop + 25)
      .fillColor('#666666')
      .text(ad.email, 50, customerTop + 45)
      .text(ad.phone, 50, customerTop + 65);
  }

  static generateInvoiceTable(doc, ad) {
    const tableTop = 230;
    
    doc
      .fontSize(14)
      .fillColor('#5156e1')
      .text('Order Details', 350, tableTop);
      
    const generateRow = (y, name, value) => {
      doc
        .fontSize(10)
        .fillColor('#888888')
        .text(name, 350, y)
        .fillColor('#000000')
        .text(value, 400, y, { align: 'right' });
    };

    generateRow(tableTop + 30, 'Business Type:', ad.businessType === 'LOCAL' ? 'Offline' : 'Online');
    generateRow(tableTop + 55, 'Business Name:', ad.businessName);
    generateRow(tableTop + 80, 'Select Page:', ad.selectPage);
    
    // Dates
    const startDateStr = ad.startsAt ? moment(ad.startsAt).format('M/D/YYYY') : 'Pending';
    const endDateStr = ad.endsAt ? moment(ad.endsAt).format('M/D/YYYY') : 'Pending';

    generateRow(tableTop + 105, 'Ads Start Date:', startDateStr);
    generateRow(tableTop + 130, 'Ads End Date:', endDateStr);
    generateRow(tableTop + 155, 'Total Days:', `${ad.durationDays} Days`);
  }

  static generateFooter(doc, ad) {
    const summaryTop = 450;
    
    // Line separator
    doc.moveTo(350, summaryTop).lineTo(550, summaryTop).lineWidth(0.5).strokeColor('#eeeeee').stroke();
    
    doc
      .fontSize(10)
      .fillColor('#888888')
      .text('Subtotal:', 350, summaryTop + 15)
      .fillColor('#000000')
      .text(`$${Number(ad.amount).toFixed(2)}`, 400, summaryTop + 15, { align: 'right' });

    // Double line for grand total
    doc.moveTo(350, summaryTop + 40).lineTo(550, summaryTop + 40).lineWidth(0.5).strokeColor('#dddddd').stroke();

    doc
      .fontSize(12)
      .fillColor('#000000')
      .text('Grand Total:', 350, summaryTop + 55)
      .fontSize(16)
      .fillColor('#f59e0b') // Golden/Yellow color as per mockup
      .text(`$${Number(ad.amount).toFixed(2)}`, 400, summaryTop + 53, { align: 'right' });
      
    // Page bottom background / branding if needed
    // Assuming simple footer for now
  }
}
