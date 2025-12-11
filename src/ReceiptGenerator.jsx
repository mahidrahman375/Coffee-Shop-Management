import React, { useState } from 'react';
import { Download } from 'lucide-react';

export default function ReceiptGenerator({ orderData, onDownload, onError }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReceipt = async () => {
    try {
      // Validate order data
      if (!orderData) {
        throw new Error('No order data available');
      }

      if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        console.warn('Receipt items:', orderData.items);
        throw new Error('No items in order');
      }

      // Validate numeric values
      const total = parseFloat(orderData.total);
      if (isNaN(total) || total <= 0) {
        throw new Error('Invalid total amount');
      }

      setIsGenerating(true);

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
      
      // Add items - with better error handling
      (orderData.items || []).forEach((item, index) => {
        if (index > 0) yPos += 10;
        
        doc.setFontSize(10);
        
        // Truncate long item names
        const itemName = item.name || 'Unknown Item';
        const displayName = itemName.length > 25 ? itemName.substring(0, 25) + '...' : itemName;
        doc.text(displayName, 20, yPos);
        
        doc.text(String(item.quantity || 1), 100, yPos);
        
        // Ensure price is a number
        const price = parseFloat(item.price) || 0;
        const subtotal = parseFloat(item.subtotal) || (price * (item.quantity || 1));
        
        doc.text(`BDT ${price.toFixed(2)}`, 130, yPos);
        doc.text(`BDT ${subtotal.toFixed(2)}`, 170, yPos);
        
        yPos += 10;
      });
      
      // Separator line before total
      doc.setDrawColor(139, 69, 19);
      doc.line(20, yPos + 5, 190, yPos + 5);
      
      // Total
      yPos += 15;
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`TOTAL: BDT ${total.toFixed(2)}`, 150, yPos);
      
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
      
      // Notify parent component about the error
      if (onError) {
        onError(error.message);
      } else {
        alert(`Error generating receipt: ${error.message}. Please try again.`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generateReceipt}
      disabled={isGenerating || !orderData}
      className={`flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition ${
        isGenerating ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <Download className="w-4 h-4" />
      {isGenerating ? 'Generating...' : 'Download Receipt (PDF)'}
    </button>
  );
}