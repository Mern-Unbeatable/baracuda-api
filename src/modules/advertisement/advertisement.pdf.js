import PDFDocument from 'pdfkit';
import moment from 'moment';
import path from 'path';

const dictionary = {
  INVOICE: { en: 'INVOICE', pl: 'FAKTURA' },
  Invoice_Number: { en: 'Invoice Number:', pl: 'Numer faktury:' },
  Invoice_Date: { en: 'Invoice Date:', pl: 'Data faktury:' },
  Due_Date: { en: 'Due Date:', pl: 'Termin płatności:' },
  Customer_Details: { en: 'Customer Details', pl: 'Dane klienta' },
  Order_Details: { en: 'Order Details', pl: 'Szczegóły zamówienia' },
  Business_Type: { en: 'Business Type:', pl: 'Rodzaj działalności:' },
  Offline: { en: 'Offline', pl: 'Stacjonarnie' },
  Online: { en: 'Online', pl: 'Online' },
  Business_Name: { en: 'Business Name:', pl: 'Nazwa firmy:' },
  Select_Page: { en: 'Select Page:', pl: 'Wybierz stronę:' },
  Ads_Start_Date: { en: 'Ads Start Date:', pl: 'Data rozpoczęcia reklam:' },
  Ads_End_Date: { en: 'Ads End Date:', pl: 'Data zakończenia reklam:' },
  Total_Days: { en: 'Total Days:', pl: 'Łącznie dni:' },
  Days: { en: 'Days', pl: 'Dni' },
  Pending: { en: 'Pending', pl: 'Oczekujące' },
  Subtotal: { en: 'Subtotal:', pl: 'Suma częściowa:' },
  Grand_Total: { en: 'Grand Total:', pl: 'Suma całkowita:' }
};

const removeDiacritics = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L');
};

const t = (key, lang) => {
  const text = dictionary[key]?.[lang] || dictionary[key]?.en || key;
  return lang === 'pl' ? removeDiacritics(text) : text;
};


export class InvoicePdfGenerator {
  static async generate(advertisement, lang = 'en') {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this.generateHeader(doc, advertisement, lang);
      this.generateCustomerInformation(doc, advertisement, lang);
      this.generateInvoiceTable(doc, advertisement, lang);
      this.generateFooter(doc, advertisement, lang);

      doc.end();
    });
  }

  static generateHeader(doc, ad, lang) {
    // Top Right Invoice Text
    doc
      .fillColor('#5156e1')
      .fontSize(24)
      .text(t('INVOICE', lang), 350, 50, { width: 200, align: 'right' })
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
      .text(t('Invoice_Number', lang), 350, detailsTop, { width: 200, align: 'right' })
      .fillColor('#000000')
      .text(`INV-${moment(ad.createdAt).format('YYYY-MM')}-${ad.id.substring(0, 4).toUpperCase()}`, 350, detailsTop + 15, { width: 200, align: 'right' })
      
      .fillColor('#777777')
      .text(t('Invoice_Date', lang), 350, detailsTop + 35, { width: 200, align: 'right' })
      .fillColor('#000000')
      .text(moment(ad.createdAt).format('DD/MM/YYYY'), 350, detailsTop + 50, { width: 200, align: 'right' })
      
      .fillColor('#777777')
      .text(t('Due_Date', lang), 350, detailsTop + 70, { width: 200, align: 'right' })
      .fillColor('#000000')
      .text(moment(ad.createdAt).add(ad.durationDays, 'days').format('DD/MM/YYYY'), 350, detailsTop + 85, { width: 200, align: 'right' });
      
    // Line separator
    doc.moveTo(50, 270).lineTo(550, 270).lineWidth(0.5).strokeColor('#eeeeee').stroke();
  }

  static generateCustomerInformation(doc, ad, lang) {
    const customerTop = 300;

    // Customer section
    doc
      .fontSize(12)
      .fillColor('#333333')
      .text(t('Customer_Details', lang), 50, customerTop);

    doc
      .fontSize(10)
      .fillColor('#000000')
      .text(lang === 'pl' ? removeDiacritics(ad.name) : ad.name, 50, customerTop + 25)
      .fillColor('#444444')
      .text(ad.email, 50, customerTop + 45)
      .text(ad.phone, 50, customerTop + 65);
  }

  static generateInvoiceTable(doc, ad, lang) {
    const tableTop = 300;
    
    doc
      .fontSize(12)
      .fillColor('#5156e1')
      .text(t('Order_Details', lang), 300, tableTop);
      
    const generateRow = (y, name, value) => {
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(name, 300, y)
        .fillColor('#000000')
        .text(value, 400, y, { width: 150, align: 'right' });
    };

    generateRow(tableTop + 25, t('Business_Type', lang), ad.businessType === 'LOCAL' ? t('Offline', lang) : t('Online', lang));
    generateRow(tableTop + 50, t('Business_Name', lang), lang === 'pl' ? removeDiacritics(ad.businessName) : ad.businessName);
    generateRow(tableTop + 75, t('Select_Page', lang), ad.selectPage);
    
    // Dates
    const startDateStr = ad.startsAt ? moment(ad.startsAt).format('DD/MM/YYYY') : t('Pending', lang);
    const endDateStr = ad.endsAt ? moment(ad.endsAt).format('DD/MM/YYYY') : t('Pending', lang);

    generateRow(tableTop + 100, t('Ads_Start_Date', lang), startDateStr);
    generateRow(tableTop + 125, t('Ads_End_Date', lang), endDateStr);
    generateRow(tableTop + 150, t('Total_Days', lang), `${ad.durationDays} ${t('Days', lang)}`);
  }

  static generateFooter(doc, ad, lang) {
    const summaryTop = 500;
    
    // Line separator
    doc.moveTo(300, summaryTop).lineTo(550, summaryTop).lineWidth(0.5).strokeColor('#eeeeee').stroke();
    
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(t('Subtotal', lang), 300, summaryTop + 15)
      .fillColor('#000000')
      .text(`$${Number(ad.amount).toFixed(2)}`, 400, summaryTop + 15, { width: 150, align: 'right' });

    // Line for grand total
    doc.moveTo(300, summaryTop + 35).lineTo(550, summaryTop + 35).lineWidth(0.5).strokeColor('#dddddd').stroke();

    doc
      .fontSize(12)
      .fillColor('#000000')
      .text(t('Grand_Total', lang), 300, summaryTop + 50)
      .fontSize(16)
      .fillColor('#f59e0b') // Golden/Yellow color as per mockup
      .text(`$${Number(ad.amount).toFixed(2)}`, 400, summaryTop + 48, { width: 150, align: 'right' });
  }
}
