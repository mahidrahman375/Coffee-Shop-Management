import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Coffee, CheckCircle } from 'lucide-react';
import ReceiptGenerator from './ReceiptGenerator.jsx';
import TopItems from './TopItems.jsx';
import { supabase } from './lib/supabase';
import { jsPDF } from 'jspdf';

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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null); // NEW STATE

  useEffect(() => {
    loadTables();
    loadMenuItems();
  }, []);

  const loadTables = async () => {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('table_number');
    
    if (!error) setTables(data || []);
  };

  const loadMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('name');
    
    if (!error) setMenuItems(data || []);
  };

  const selectTable = async (table) => {
    try {
      const { data: existingOrder, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_details(
            *,
            menu_items(*)
          )
        `)
        .eq('table_id', table.id)
        .eq('status', 'pending')
        .single();

      setSelectedTable(table);
      
      if (existingOrder && !error) {
        setActiveOrder(existingOrder);
        // Load existing items into cart
        const cartItems = existingOrder.order_details.map(detail => ({
          id: detail.menu_item_id,
          name: detail.menu_items?.name,
          price: detail.price,
          quantity: detail.quantity,
          order_detail_id: detail.id
        })).filter(item => item.id);
        
        setCart(cartItems);
      } else {
        // No existing order, clear cart
        setCart([]);
        setActiveOrder(null);
      }
      
      setView('menu');
      
    } catch (error) {
      console.error('Error loading table order:', error);
      setSelectedTable(table);
      setCart([]);
      setActiveOrder(null);
      setView('menu');
    }
  };

  const addToCart = (item) => {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      setCart(cart.map(i => 
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([...cart, { 
        ...item, 
        quantity: 1,
        order_detail_id: null
      }]);
    }
  };

  const updateQuantity = (itemId, change) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

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

      if (!activeOrder) {
        // Create new order WITH payment method
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            table_id: selectedTable.id,
            total_amount: calculateTotal(),
            status: 'pending',
            payment_status: 'pending',
            payment_method: selectedPaymentMethod, // Added payment method
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

        // Verify order was created
        const { data: verifyOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (!verifyOrder) {
          localStorage.removeItem(processingKey);
          setIsProcessing(false);
          throw new Error('Order creation failed');
        }

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
            total_amount: calculateTotal(),
            payment_method: selectedPaymentMethod, // Update payment method
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
      }

      // Handle order details
      for (const item of cart) {
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
              subtotal: item.price * item.quantity,
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
              subtotal: item.price * item.quantity,
              created_at: new Date().toISOString()
            });
        }
      }

      // Deduct ingredients for new orders only
      if (isNewOrder) {
        for (const item of cart) {
          const { data: itemIngredients } = await supabase
            .from('item_ingredients')
            .select('*, ingredients(*)')
            .eq('menu_item_id', item.id);

          if (itemIngredients) {
            for (const ii of itemIngredients) {
              const quantityToDeduct = ii.quantity_needed * item.quantity;
              const newStock = ii.ingredients.stock_quantity - quantityToDeduct;
              
              if (newStock < 0) {
                console.warn(`Insufficient stock for ingredient ${ii.ingredients.name}`);
                continue;
              }
              
              await supabase
                .from('ingredients')
                .update({ stock_quantity: newStock })
                .eq('id', ii.ingredient_id);
            }
          }
        }
      }

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

      setOrderSummary(finalOrder);
      
      // Generate receipt data
      // In placeOrder function in App.jsx:
      const receiptData = {
        orderId: finalOrder.id,
        tableNumber: selectedTable.table_number,
        items: finalOrder.order_details.map(detail => ({
          name: detail.menu_items?.name || 'Item',
          quantity: detail.quantity,
          price: detail.price,
          subtotal: detail.subtotal
        })),
        total: finalOrder.total_amount,
        paymentMethod: selectedPaymentMethod, // This is important!
        date: new Date(finalOrder.created_at).toLocaleString()
      };
      
      setGeneratedReceipt(receiptData);
      setView('order-success');
      
      // Clear cart but keep activeOrder for future updates
      setCart([]);
      
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

  const selectPaymentMethod = (method) => {
    setSelectedPaymentMethod(method);
    alert(`Payment method selected: ${method}. You can now place your order.`);
  };

  const startNewOrder = () => {
    setView('table-selection');
    setSelectedTable(null);
    setCart([]);
    setActiveOrder(null);
    setOrderSummary(null);
    setGeneratedReceipt(null);
    setSelectedPaymentMethod(null); // Reset payment method
    loadTables();
  };

  if (view === 'table-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Coffee className="w-16 h-16 mx-auto text-amber-600 mb-4" />
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome to Our Coffee Shop</h1>
            <p className="text-gray-600">Please select your table to begin ordering</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map(table => (
              <button
                key={table.id}
                onClick={() => table.status === 'free' && selectTable(table)}
                disabled={table.status !== 'free'}
                className={`p-8 rounded-xl text-center transition-all ${
                  table.status === 'free'
                    ? 'bg-white hover:bg-amber-50 border-2 border-amber-200 hover:border-amber-400 cursor-pointer'
                    : 'bg-gray-200 border-2 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="text-3xl font-bold mb-2">Table {table.table_number}</div>
                <div className={`text-sm font-medium ${
                  table.status === 'free' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {table.status === 'free' ? 'Available' : 'Occupied'}
                </div>
                <div className="text-xs text-gray-500 mt-1">{table.capacity} seats</div>
              </button>
            ))}
          </div>
          
          <div className="mt-12">
            <TopItems />
          </div>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Your Cart ({cart.length} items)
                  {activeOrder && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                      Updating Order #{activeOrder.id}
                    </span>
                  )}
                </h3>
                <div className="text-2xl font-bold text-amber-600">
                  Total: ৳{calculateTotal().toFixed(2)}
                </div>
              </div>

              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
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

              {/* Payment Method Selection BEFORE placing order */}
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
              {orderSummary?.order_details?.map((detail, idx) => (
                <div key={idx} className="flex justify-between text-gray-700">
                  <span>{detail.menu_items?.name || 'Item'} × {detail.quantity}</span>
                  <span className="font-medium">৳{detail.subtotal?.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-800 mt-4 pt-4 border-t">
              <span>Total:</span>
              <span className="text-amber-600">৳{orderSummary?.total_amount?.toFixed(2)}</span>
            </div>
          </div>

          {/* Clean Receipt Download Section */}
          {generatedReceipt && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-blue-800">Download Receipt</h3>
                  <p className="text-sm text-blue-600">Get a PDF copy of your order</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Order #{generatedReceipt.orderId} • {generatedReceipt.items?.length || 0} items
                  </p>
                </div>
                <ReceiptGenerator 
                  orderData={generatedReceipt} 
                  onDownload={() => {
                    alert('Receipt downloaded successfully!');
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                // Go back to menu to add more items
                setView('menu');
              }}
              className="flex-1 bg-amber-100 text-amber-700 py-3 rounded-lg font-bold hover:bg-amber-200 transition"
            >
              Add More Items
            </button>
            <button
              onClick={startNewOrder}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition"
            >
              {activeOrder ? 'Complete Order' : 'Finish & New Order'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}