import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as qrcode from 'qrcode';

@Injectable()
export class InvoiceGeneratorService {
  async generate(order: any, store: any, paymentRef: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // Invoice Header
        doc.fontSize(22).text('INVOICE / TAX RECEIPT', { align: 'center' });
        doc.moveDown();

        // Store Details & GSTIN
        doc.fontSize(12).text(store.name, { underline: true });
        doc.fontSize(10).text(store.address || '123 Main St');
        doc.text(`${store.city || 'Bangalore'}, ${store.state || 'Karnataka'}, ${store.postalCode || '560001'}, ${store.country || 'India'}`);
        if (store.phoneNumber) {
          doc.text(`Phone: ${store.phoneNumber}`);
        }
        
        // GSTIN & Tax details
        const gstin = store.setting?.gstin || `29GGGGG1234F1Z${Math.floor(Math.random() * 9)}`;
        doc.text(`GSTIN: ${gstin}`);
        doc.moveDown();

        // Invoice metadata & Payment Reference
        doc.fontSize(11).text(`Invoice Number: REC-${order.id.substring(0, 8).toUpperCase()}`);
        doc.text(`Order ID: ${order.id}`);
        doc.text(`Checkout Date: ${order.createdAt.toLocaleDateString()}`);
        doc.text(`Payment Reference: ${paymentRef || 'N/A'}`);
        doc.moveDown();

        // Render Table Headers
        doc.fontSize(10);
        doc.text('---------------------------------------------------------------------------------------------------------', { align: 'left' });
        doc.font('Helvetica-Bold').text('Item Description                 Qty           Unit Price           Total Price');
        doc.font('Helvetica');
        doc.text('---------------------------------------------------------------------------------------------------------', { align: 'left' });

        const items = order.items as any[];
        let subtotal = 0;
        for (const item of items) {
          const itemTotal = item.price * item.quantity;
          subtotal += itemTotal;
          
          const desc = item.name.padEnd(30).substring(0, 30);
          const qty = item.quantity.toString().padEnd(12);
          const price = `${item.price.toFixed(2)}`.padEnd(20);
          const total = `${itemTotal.toFixed(2)}`;
          doc.text(`${desc}${qty}${price}${total}`);
        }

        doc.text('---------------------------------------------------------------------------------------------------------', { align: 'left' });
        doc.moveDown();

        // GST Calculation (Default 18% GST)
        const taxRate = store.taxRate || 18.0;
        const taxApplied = subtotal * (taxRate / 100);
        const finalTotal = subtotal + taxApplied;

        doc.fontSize(11);
        doc.text(`Subtotal: $${subtotal.toFixed(2)}`, { align: 'right' });
        doc.text(`CGST (${(taxRate / 2).toFixed(1)}%): $${(taxApplied / 2).toFixed(2)}`, { align: 'right' });
        doc.text(`SGST (${(taxRate / 2).toFixed(1)}%): $${(taxApplied / 2).toFixed(2)}`, { align: 'right' });
        doc.font('Helvetica-Bold').text(`Total Paid: $${finalTotal.toFixed(2)}`, { align: 'right' });
        doc.font('Helvetica');
        doc.moveDown();

        // Embed Secure QR Code Image for Exit Gate Validation
        if (order.qrToken) {
          const qrDataUrl = await qrcode.toDataURL(order.qrToken);
          const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
          const qrBuffer = Buffer.from(base64Data, 'base64');
          doc.image(qrBuffer, 50, doc.y + 10, { width: 100, height: 100 });
          doc.fontSize(8).text('Scan at exit gate to verify checkout', 50, doc.y + 115);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
