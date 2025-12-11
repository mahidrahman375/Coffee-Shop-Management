import React from 'react';
import { Download } from 'lucide-react';

export default function ReceiptGenerator({ orderData, onDownload }) {
  const generateReceipt = async () => {
    try {
      // Dynamic imports
      const { jsPDF } = await import('jspdf');
      
      // Create PDF document
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(139, 69, 19); // Brown color
      doc.text('Coffee Shop', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('RECEIPT', 105, 30, { align: 'center' });
      
      // Order info
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Order #: ${orderData.orderId || 'N/A'}`, 20, 45);
      doc.text(`Table: ${orderData.tableNumber || 'N/A'}`, 20, 55);
      doc.text(`Date: ${orderData.date || new Date().toLocaleString()}`, 20, 65);
      
      // Add payment method if available
      if (orderData.paymentMethod) {
        doc.text(`Payment: ${orderData.paymentMethod.replace('_', ' ').toUpperCase()}`, 20, 75);
      }
      
      // Separator line
      doc.setDrawColor(139, 69, 19);
      doc.line(20, orderData.paymentMethod ? 82 : 72, 190, orderData.paymentMethod ? 82 : 72);
      
      // Items header
      doc.setFontSize(11);
      const startY = orderData.paymentMethod ? 92 : 82;
      doc.text('Item', 20, startY);
      doc.text('Qty', 100, startY);
      doc.text('Price', 130, startY);
      doc.text('Total', 170, startY);
      
      let yPos = startY + 10;
      
      // Add items
      orderData.items.forEach((item, index) => {
        if (index > 0) yPos += 10;
        
        doc.setFontSize(10);
        
        // Truncate long item names
        const itemName = item.name || 'Unknown Item';
        const displayName = itemName.length > 25 ? itemName.substring(0, 25) + '...' : itemName;
        doc.text(displayName, 20, yPos);
        
        doc.text(String(item.quantity || 1), 100, yPos);
        
        // Use "BDT" instead of symbol that might not render
        doc.text(`BDT ${(item.price || 0).toFixed(2)}`, 130, yPos);
        doc.text(`BDT ${(item.subtotal || 0).toFixed(2)}`, 170, yPos);
        
        yPos += 10;
      });
      
      // Separator line before total
      doc.setDrawColor(139, 69, 19);
      doc.line(20, yPos + 5, 190, yPos + 5);
      
      // Total
      yPos += 15;
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`TOTAL: BDT ${(orderData.total || 0).toFixed(2)}`, 150, yPos);
      
      // Footer
      yPos += 20;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Thank you for your visit!', 105, yPos, { align: 'center' });
      doc.text('Please come again!', 105, yPos + 8, { align: 'center' });
      
      // Save the PDF
      const fileName = `receipt-order-${orderData.orderId || Date.now()}.pdf`;
      doc.save(fileName);
      
      if (onDownload) {
        onDownload();
      }
      
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('Error generating receipt. Please try again.');
    }
  };

  return (
    <button
      onClick={generateReceipt}
      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
    >
      <Download className="w-4 h-4" />
      Download Receipt (PDF)
    </button>
  );
}