import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Coffee, CheckCircle, ChevronUp, ChevronDown } from 'lucide-react';
import ReceiptGenerator from './ReceiptGenerator.jsx';
import TopItems from './TopItems.jsx';
import { supabase } from './lib/supabase';

export default function App() {
  const [view, setView] = useState('table-selection');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderSummary, setOrderSummary] = useState(null);
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [isCartExpanded, setIsCartExpanded] = useState(false); // NEW: Track cart expansion

  useEffect(() => {
    loadTables();
    loadMenuItems();
  }, []);

  // ... (keep all your existing functions like loadTables, loadMenuItems, selectTable, etc.)

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const placeOrder = async () => {
    if (cart.length === 0 || isProcessing) return;

    // Check if payment method is selected
    if (!selectedPaymentMethod) {
      alert('Please select a payment method before placing the order.');
      return;
    }

    setIsProcessing(true);

    try {
      let orderId = activeOrder?.id;
      let isNewOrder = false;

      // Check if order is already being processed for this table
      const processingKey = `processing-table-${selectedTable.id}`;
      if (localStorage.getItem(processingKey)) {
        alert('Order is already being processed for this table. Please wait.');
        setIsProcessing(false);
        return;
      }
      localStorage.setItem(processingKey, 'true');

      // Calculate total BEFORE creating/updating order
      const calculatedTotal = calculateTotal();

      if (!activeOrder) {
        // Create new order WITH payment method
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            table_id: selectedTable.id,
            total_amount: calculatedTotal, // Use calculated total
            status: 'pending',
            payment_status: 'pending',
            payment_method: selectedPaymentMethod,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (orderError) {
          localStorage.removeItem(processingKey);
          setIsProcessing(false);
          throw orderError;
        }
        
        orderId = newOrder.id;
        isNewOrder = true;

        // Update table status
        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', selectedTable.id);
          
        setActiveOrder(newOrder);
      } else {
        // Update existing order with payment method
        await supabase
          .from('orders')
          .update({ 
            total_amount: calculatedTotal, // Use calculated total
            payment_method: selectedPaymentMethod,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
      }

      // Handle order details - FIXED to ensure subtotal is calculated
      for (const item of cart) {
        const subtotal = item.price * item.quantity; // Calculate subtotal
        
        // Check if item already exists in this order
        const existingDetail = activeOrder?.order_details?.find(
          detail => detail.menu_item_id === item.id
        );
        
        if (existingDetail && item.order_detail_id) {
          // Update existing item
          await supabase
            .from('order_details')
            .update({
              quantity: item.quantity,
              price: item.price,
              subtotal: subtotal, // Add subtotal
              updated_at: new Date().toISOString()
            })
            .eq('id', item.order_detail_id);
        } else {
          // Add new item
          await supabase
            .from('order_details')
            .insert({
              order_id: orderId,
              menu_item_id: item.id,
              quantity: item.quantity,
              price: item.price,
              subtotal: subtotal, // Add subtotal
              created_at: new Date().toISOString()
            });
        }
      }

      // ... (rest of the ingredient deduction code remains the same)

      // Fetch complete order with details
      const { data: finalOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_details(
            *,
            menu_items(*)
          )
        `)
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Ensure subtotals are calculated for display
      const orderWithCalculatedTotals = {
        ...finalOrder,
        order_details: finalOrder.order_details.map(detail => ({
          ...detail,
          subtotal: detail.subtotal || (detail.price * detail.quantity) // Calculate if missing
        }))
      };

      setOrderSummary(orderWithCalculatedTotals);
      
      // Generate receipt data
      const receiptData = {
        orderId: finalOrder.id,
        tableNumber: selectedTable.table_number,
        items: orderWithCalculatedTotals.order_details.map(detail => ({
          name: detail.menu_items?.name || 'Item',
          quantity: detail.quantity,
          price: detail.price,
          subtotal: detail.subtotal
        })),
        total: orderWithCalculatedTotals.total_amount,
        paymentMethod: selectedPaymentMethod,
        date: new Date(orderWithCalculatedTotals.created_at).toLocaleString()
      };
      
      setGeneratedReceipt(receiptData);
      setView('order-success');
      
      // Clear cart but keep activeOrder for future updates
      setCart([]);
      setSelectedPaymentMethod(null); // Reset payment method for next time
      
      // Clean up processing flag
      localStorage.removeItem(processingKey);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
      localStorage.removeItem(`processing-table-${selectedTable.id}`);
      setIsProcessing(false);
    }
  };

  // ... (rest of your functions remain the same)

  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Table {selectedTable.table_number}</h1>
                <p className="text-sm text-gray-600">Browse our menu and add items to your cart</p>
                {activeOrder && (
                  <p className="text-xs text-amber-600 mt-1">
                    ✓ Order #{activeOrder.id} in progress - Adding items to existing order
                  </p>
                )}
              </div>
              <button
                onClick={() => setView('table-selection')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Change Table
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{item.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-amber-600">৳{item.price}</span>
                    <button
                      onClick={() => addToCart(item)}
                      className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-amber-200 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-4">
              {/* Cart Header with Expand/Collapse */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsCartExpanded(!isCartExpanded)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {isCartExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  </button>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Your Cart ({cart.length} items)
                    {activeOrder && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                        Updating Order #{activeOrder.id}
                      </span>
                    )}
                  </h3>
                </div>
                <div className="text-2xl font-bold text-amber-600">
                  Total: ৳{calculateTotal().toFixed(2)}
                </div>
              </div>

              {/* Collapsible Cart Items */}
              {isCartExpanded && (
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-sm text-gray-600">৳{item.price} each</div>
                        {item.order_detail_id && (
                          <div className="text-xs text-green-600">✓ Already in order</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="w-20 text-right font-bold text-gray-800">
                          ৳{(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment Method Selection */}
              <div className="mb-4">
                <h4 className="font-bold text-gray-700 mb-2">Select Payment Method:</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'card', 'mobile_banking'].map(method => (
                    <button
                      key={method}
                      onClick={() => selectPaymentMethod(method)}
                      className={`p-3 rounded-lg border-2 transition ${
                        selectedPaymentMethod === method
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 hover:border-amber-500 hover:bg-amber-50'
                      }`}
                    >
                      <div className="font-medium capitalize">{method.replace('_', ' ')}</div>
                      {selectedPaymentMethod === method && (
                        <div className="text-xs mt-1">✓ Selected</div>
                      )}
                    </button>
                  ))}
                </div>
                {!selectedPaymentMethod && cart.length > 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ Please select a payment method to place your order
                  </p>
                )}
              </div>

              {/* Order Button */}
              <button
                onClick={placeOrder}
                disabled={isProcessing || !selectedPaymentMethod}
                className={`w-full py-4 rounded-lg font-bold text-lg transition ${
                  selectedPaymentMethod
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing ? 'Processing...' : 
                 activeOrder ? `Update Order - ৳${calculateTotal().toFixed(2)}` : 
                 selectedPaymentMethod ? `Place Order - ৳${calculateTotal().toFixed(2)}` :
                 'Select Payment Method First'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'order-success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Order {activeOrder ? 'Updated' : 'Placed'} Successfully!</h1>
            <p className="text-gray-600">Table {selectedTable.table_number} • Order #{orderSummary?.id}</p>
            <p className="text-sm text-amber-600 mt-2">
              Payment Method: <span className="font-bold capitalize">{orderSummary?.payment_method?.replace('_', ' ') || selectedPaymentMethod?.replace('_', ' ')}</span>
            </p>
            {activeOrder && (
              <p className="text-sm text-amber-600 mt-2">
                ✓ Your order has been updated with additional items
              </p>
            )}
          </div>

          <div className="border-t border-b border-gray-200 py-4 mb-6">
            <h3 className="font-bold text-gray-800 mb-3">Order Summary:</h3>
            <div className="space-y-2">
              {orderSummary?.order_details?.map((detail, idx) => {
                // Calculate subtotal if not present
                const subtotal = detail.subtotal || (detail.price * detail.quantity);
                return (
                  <div key={idx} className="flex justify-between text-gray-700">
                    <div>
                      <span>{detail.menu_items?.name || 'Item'} × {detail.quantity}</span>
                    </div>
                    <span className="font-medium">৳{subtotal.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-800 mt-4 pt-4 border-t">
              <span>Total:</span>
              <span className="text-amber-600">৳{orderSummary?.total_amount?.toFixed(2)}</span>
            </div>
          </div>

          {/* ... (rest of order-success view remains the same) */}
        </div>
      </div>
    );
  }

  return null;
}