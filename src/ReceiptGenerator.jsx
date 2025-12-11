import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function ReceiptGenerator({ orderData, onDownload, onError }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReceipt = () => {
    try {
      setIsGenerating(true);

      // Validate data
      if (!orderData || !orderData.items || !Array.isArray(orderData.items)) {
        throw new Error('Invalid order data');
      }

      const total = parseFloat(orderData.total) || 0;
      if (isNaN(total) || total <= 0) {
        throw new Error('Invalid total amount');
      }

      // Create PDF
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
      
      if (orderData.paymentMethod) {
        doc.text(`Payment: ${orderData.paymentMethod.replace('_', ' ').toUpperCase()}`, 20, 75);
      }
      
      // Separator line
      doc.setDrawColor(139, 69, 19);
      doc.line(20, 85, 190, 85);
      
      // Items header
      doc.setFontSize(11);
      doc.text('Item', 20, 95);
      doc.text('Qty', 120, 95);
      doc.text('Price', 140, 95);
      doc.text('Total', 170, 95);
      
      let yPos = 105;
      
      // Add items
      orderData.items.forEach((item, index) => {
        if (index > 0) yPos += 10;
        
        doc.setFontSize(10);
        
        const name = item.name || 'Item';
        const displayName = name.length > 25 ? name.substring(0, 25) + '...' : name;
        doc.text(displayName, 20, yPos);
        
        doc.text(String(item.quantity || 1), 120, yPos);
        
        const price = parseFloat(item.price) || 0;
        const subtotal = parseFloat(item.subtotal) || (price * (item.quantity || 1));
        
        doc.text(`৳${price.toFixed(2)}`, 140, yPos);
        doc.text(`৳${subtotal.toFixed(2)}`, 170, yPos);
        
        yPos += 10;
      });
      
      // Total
      yPos += 10;
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`TOTAL: ৳${total.toFixed(2)}`, 150, yPos);
      
      // Footer
      yPos += 20;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Thank you for your visit!', 105, yPos, { align: 'center' });
      doc.text('Please come again!', 105, yPos + 8, { align: 'center' });
      
      // Save PDF
      doc.save(`receipt-order-${orderData.orderId || Date.now()}.pdf`);
      
      if (onDownload) {
        onDownload();
      }

    } catch (error) {
      console.error('Error generating receipt:', error);
      if (onError) {
        onError(`Error generating PDF: ${error.message}. Please try again.`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generateReceipt}
      disabled={isGenerating}
      className={`flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-bold ${
        isGenerating ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <Download className="w-5 h-5" />
      {isGenerating ? 'Generating...' : 'Download Receipt (PDF)'}
    </button>
  );
}