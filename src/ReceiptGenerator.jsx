// src/ReceiptGenerator.jsx
import React, { useState } from 'react';
import { Download } from 'lucide-react';

export default function ReceiptGenerator({ orderData, onDownload, onError }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReceipt = () => {
    try {
      setIsGenerating(true);

      // Validate data
      if (!orderData || !orderData.items || !Array.isArray(orderData.items)) {
        throw new Error('Invalid order data');
      }

      // Create receipt content
      let receiptContent = `
========================================
           COFFEE SHOP           
              RECEIPT             
========================================
Order #: ${orderData.orderId || 'N/A'}
Table: ${orderData.tableNumber || 'N/A'}
Date: ${orderData.date || new Date().toLocaleString()}
${orderData.paymentMethod ? `Payment: ${orderData.paymentMethod.replace('_', ' ').toUpperCase()}` : ''}
========================================
Item                       Qty  Price   Total
----------------------------------------
`;

      // Add items
      orderData.items.forEach(item => {
        const name = item.name || 'Item';
        const qty = item.quantity || 1;
        const price = parseFloat(item.price) || 0;
        const subtotal = price * qty;
        
        const truncatedName = name.length > 22 ? name.substring(0, 22) + '...' : name;
        const line = `${truncatedName.padEnd(25)}${qty.toString().padStart(3)}  ${price.toFixed(2).padStart(6)}  ${subtotal.toFixed(2).padStart(7)}`;
        receiptContent += line + '\n';
      });

      // Add total
      const total = parseFloat(orderData.total) || 0;
      receiptContent += `========================================\n`;
      receiptContent += `TOTAL: ${' '.repeat(25)}BDT ${total.toFixed(2)}\n`;
      receiptContent += `========================================\n`;
      receiptContent += `      Thank you for your visit!\n`;
      receiptContent += `        Please come again!\n`;
      receiptContent += `========================================\n`;

      // Create and download text file
      const blob = new Blob([receiptContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-order-${orderData.orderId || Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (onDownload) {
        onDownload();
      }

    } catch (error) {
      console.error('Error generating receipt:', error);
      if (onError) {
        onError(`Error: ${error.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generateReceipt}
      disabled={isGenerating}
      className={`flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition ${
        isGenerating ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <Download className="w-4 h-4" />
      {isGenerating ? 'Generating...' : 'Download Receipt'}
    </button>
  );
}