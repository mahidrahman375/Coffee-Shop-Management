import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Coffee, CheckCircle, ChevronUp, ChevronDown, AlertCircle, X } from 'lucide-react';
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
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const cartRef = useRef(null);

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    // Check for duplicate items in cart and merge them
    const mergedCart = cart.reduce((acc, item) => {
      const existingItem = acc.find(i => i.id === item.id);
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        acc.push({ ...item });
      }
      return acc;
    }, []);
    
    // Only update if there's a change
    if (JSON.stringify(mergedCart) !== JSON.stringify(cart)) {
      setCart(mergedCart);
    }
  }, [cart]);

  const initializeApp = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        loadTables(),
        loadMenuItems()
      ]);
    } catch (err) {
      console.error('Error initializing app:', err);
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    try {
      const { data, error: supabaseError } = await supabase
        .from('tables')
        .select('*')
        .order('table_number');
      
      if (supabaseError) {
        console.error('Error loading tables:', supabaseError);
        throw supabaseError;
      }
      
      setTables(data || []);
    } catch (err) {
      console.error('Error in loadTables:', err);
      throw err;
    }
  };

  const loadMenuItems = async () => {
    try {
      const { data, error: supabaseError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('name');
      
      if (supabaseError) {
        console.error('Error loading menu items:', supabaseError);
        throw supabaseError;
      }
      
      setMenuItems(data || []);
    } catch (err) {
      console.error('Error in loadMenuItems:', err);
      throw err;
    }
  };

  const selectTable = async (table) => {
    try {
      setError(null);
      
      const { data: existingOrder, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_details(
            *,
            menu_items(*)
          )
        `)
        .eq('table_id', table.id)
        .eq('status', 'pending');
      
      setSelectedTable(table);
      
      if (orderError) {
        console.error('Error loading table order:', orderError);
        setError(`Error loading order: ${orderError.message}`);
      }
      
      if (existingOrder && existingOrder.length > 0) {
        const order = existingOrder[0];
        setActiveOrder(order);
        
        // Merge duplicate items from existing order
        const existingItems = (order.order_details || []);
        const mergedItems = existingItems.reduce((acc, detail) => {
          const existing = acc.find(item => item.menu_item_id === detail.menu_item_id);
          if (existing) {
            existing.quantity += detail.quantity;
          } else {
            acc.push({
              menu_item_id: detail.menu_item_id,
              quantity: detail.quantity,
              price: detail.price,
              order_detail_id: detail.id
            });
          }
          return acc;
        }, []);
        
        // Fetch menu item names for each
        const cartItems = await Promise.all(mergedItems.map(async (item) => {
          const { data: menuItem } = await supabase
            .from('menu_items')
            .select('name')
            .eq('id', item.menu_item_id)
            .single();
          
          return {
            id: item.menu_item_id,
            name: menuItem?.name || `Item ${item.menu_item_id}`,
            price: item.price || 0,
            quantity: item.quantity || 1,
            order_detail_id: item.order_detail_id
          };
        }));
        
        setCart(cartItems.filter(item => item.id));
      } else {
        setCart([]);
        setActiveOrder(null);
      }
      
      setView('menu');
      
    } catch (error) {
      console.error('Error in selectTable:', error);
      setError('Error loading table information. Please try again.');
      setSelectedTable(table);
      setCart([]);
      setActiveOrder(null);
      setView('menu');
    }
  };

  const addToCart = (item) => {
    try {
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
    } catch (err) {
      console.error('Error adding to cart:', err);
      setError('Failed to add item to cart');
    }
  };

  const updateQuantity = (itemId, change) => {
    try {
      setCart(cart.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + change;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0));
    } catch (err) {
      console.error('Error updating quantity:', err);
      setError('Failed to update quantity');
    }
  };

  const removeFromCart = (itemId) => {
    try {
      setCart(cart.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Error removing from cart:', err);
      setError('Failed to remove item');
    }
  };

  const calculateTotal = () => {
    try {
      return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    } catch (err) {
      console.error('Error calculating total:', err);
      return 0;
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0 || isProcessing) return;

    if (!selectedPaymentMethod) {
      setError('Please select a payment method before placing the order.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let orderId = activeOrder?.id;
      let isNewOrder = false;

      const processingKey = `processing-table-${selectedTable.id}`;
      if (localStorage.getItem(processingKey)) {
        setError('Order is already being processed for this table. Please wait.');
        setIsProcessing(false);
        return;
      }
      localStorage.setItem(processingKey, 'true');

      const calculatedTotal = calculateTotal();

      if (!activeOrder) {
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            table_id: selectedTable.id,
            total_amount: calculatedTotal,
            status: 'pending',
            payment_method: selectedPaymentMethod,
            payment_status: 'pending',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (orderError) {
          console.error('Order creation error:', orderError);
          localStorage.removeItem(processingKey);
          setIsProcessing(false);
          throw new Error(`Order creation failed: ${orderError.message}`);
        }
        
        orderId = newOrder.id;
        isNewOrder = true;

        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', selectedTable.id);
          
        setActiveOrder(newOrder);
      }

      // Get existing order details to calculate new total
      const { data: existingDetails } = await supabase
        .from('order_details')
        .select('*')
        .eq('order_id', orderId);

      // For existing order: only add NEW items (items without order_detail_id)
      // Update existing items (items with order_detail_id)
      const itemsToInsert = cart.filter(item => !item.order_detail_id);
      const itemsToUpdate = cart.filter(item => item.order_detail_id);

      // Insert new items
      if (itemsToInsert.length > 0) {
        const insertPromises = itemsToInsert.map(async (item) => {
          const subtotal = item.price * item.quantity;
          
          const { error: insertDetailError } = await supabase
            .from('order_details')
            .insert({
              order_id: orderId,
              menu_item_id: item.id,
              quantity: item.quantity,
              price: item.price,
              subtotal: subtotal,
              created_at: new Date().toISOString()
            });

          if (insertDetailError) {
            console.error('Insert detail error:', insertDetailError);
            throw new Error(`Failed to add item: ${insertDetailError.message}`);
          }
        });

        await Promise.all(insertPromises);
      }

      // Update existing items
      if (itemsToUpdate.length > 0) {
        const updatePromises = itemsToUpdate.map(async (item) => {
          const subtotal = item.price * item.quantity;
          
          const { error: updateDetailError } = await supabase
            .from('order_details')
            .update({
              quantity: item.quantity,
              subtotal: subtotal
            })
            .eq('id', item.order_detail_id);

          if (updateDetailError) {
            console.error('Update detail error:', updateDetailError);
            throw new Error(`Failed to update item: ${updateDetailError.message}`);
          }
        });

        await Promise.all(updatePromises);
      }

      // Calculate new total from ALL order details (existing + new)
      const { data: allDetails } = await supabase
        .from('order_details')
        .select('subtotal')
        .eq('order_id', orderId);

      const newTotal = allDetails?.reduce((sum, detail) => sum + (detail.subtotal || 0), 0) || calculatedTotal;

      // Update order with new total and payment method
      await supabase
        .from('orders')
        .update({ 
          total_amount: newTotal,
          payment_method: selectedPaymentMethod
        })
        .eq('id', orderId);

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

      if (fetchError) {
        console.error('Fetch order error:', fetchError);
        throw new Error(`Failed to fetch order: ${fetchError.message}`);
      }

      // Merge duplicate items in order summary
      const orderDetails = finalOrder.order_details || [];
      const mergedDetails = orderDetails.reduce((acc, detail) => {
        const existing = acc.find(d => d.menu_item_id === detail.menu_item_id);
        if (existing) {
          existing.quantity += detail.quantity;
          existing.subtotal += detail.subtotal;
        } else {
          acc.push({ ...detail });
        }
        return acc;
      }, []);

      const orderWithCalculatedTotals = {
        ...finalOrder,
        order_details: mergedDetails.map(detail => ({
          ...detail,
          subtotal: detail.subtotal || (detail.price * detail.quantity)
        }))
      };

      setOrderSummary(orderWithCalculatedTotals);
      
      const receiptData = {
        orderId: finalOrder.id,
        tableNumber: selectedTable.table_number,
        items: mergedDetails.map(detail => ({
          name: detail.menu_items?.name || 'Item',
          quantity: detail.quantity,
          price: detail.price,
          subtotal: detail.subtotal || (detail.price * detail.quantity)
        })),
        total: newTotal,
        paymentMethod: selectedPaymentMethod,
        date: new Date(finalOrder.created_at).toLocaleString()
      };
      
      setGeneratedReceipt(receiptData);
      setView('order-success');
      
      // DO NOT clear cart here - keep items for "Add More Items"
      setSelectedPaymentMethod(null);
      
      localStorage.removeItem(processingKey);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('Error placing order:', error);
      setError(`Failed to place order: ${error.message}`);
      localStorage.removeItem(`processing-table-${selectedTable.id}`);
      setIsProcessing(false);
    }
  };

  const selectPaymentMethod = (method) => {
    setSelectedPaymentMethod(method);
    setError(null);
  };

  const startNewOrder = () => {
    setView('table-selection');
    setSelectedTable(null);
    setCart([]); // Clear cart only when starting new order
    setActiveOrder(null);
    setOrderSummary(null);
    setGeneratedReceipt(null);
    setSelectedPaymentMethod(null);
    setError(null);
    setIsCartExpanded(false);
    loadTables();
  };

  const loadOrderIntoCart = async (orderId) => {
    try {
      const { data: order, error } = await supabase
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
      
      if (error) throw error;
      
      if (order) {
        setActiveOrder(order);
        
        // Merge duplicate items
        const existingItems = (order.order_details || []);
        const mergedItems = existingItems.reduce((acc, detail) => {
          const existing = acc.find(item => item.menu_item_id === detail.menu_item_id);
          if (existing) {
            existing.quantity += detail.quantity;
          } else {
            acc.push({
              menu_item_id: detail.menu_item_id,
              quantity: detail.quantity,
              price: detail.price,
              order_detail_id: detail.id
            });
          }
          return acc;
        }, []);
        
        // Get menu item names
        const cartItems = await Promise.all(mergedItems.map(async (item) => {
          const { data: menuItem } = await supabase
            .from('menu_items')
            .select('name')
            .eq('id', item.menu_item_id)
            .single();
          
          return {
            id: item.menu_item_id,
            name: menuItem?.name || `Item ${item.menu_item_id}`,
            price: item.price || 0,
            quantity: item.quantity || 1,
            order_detail_id: item.order_detail_id
          };
        }));
        
        setCart(cartItems.filter(item => item.id));
      }
    } catch (err) {
      console.error('Error loading order into cart:', err);
      throw err;
    }
  };

  const ErrorAlert = () => {
    if (!error) return null;
    
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm font-medium flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Loading State
  if (loading && view === 'table-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Coffee className="w-16 h-16 mx-auto text-amber-600 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-800">Loading...</h2>
          <p className="text-gray-600 mt-2">Please wait while we load the menu</p>
        </div>
      </div>
    );
  }

  if (view === 'table-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6">
        <ErrorAlert />
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <ErrorAlert />
        
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-20">
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
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
              >
                Change Table
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Menu Items - Left Side */}
          <div className={`flex-1 overflow-y-auto ${cart.length > 0 ? 'pr-96' : ''}`}>
            <div className="max-w-7xl mx-auto px-4 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuItems.map(item => (
                  <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{item.name}</h3>
                      <p className="text-gray-600 text-sm mb-4">{item.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-amber-600">BDT {item.price}</span>
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
          </div>

          {/* Fixed Right Sidebar Cart */}
          {cart.length > 0 && (
            <div 
              ref={cartRef}
              className="fixed right-0 top-[73px] bottom-0 w-96 bg-white border-l-2 border-amber-200 shadow-xl overflow-hidden"
            >
              <div className="h-full flex flex-col">
                {/* Cart Header */}
                <div className="px-4 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Your Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
                  </h3>
                  {activeOrder && (
                    <p className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded mt-2 inline-block">
                      Updating Order #{activeOrder.id}
                    </p>
                  )}
                </div>

                {/* Cart Items - Scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-sm text-gray-600">BDT {item.price} each</div>
                            {item.order_detail_id && (
                              <div className="text-xs text-green-600 mt-1">✓ Already in order</div>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-100"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-10 text-center font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-100"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="font-bold text-amber-600">
                            BDT {(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cart Footer - Total, Payment, Order Button */}
                <div className="border-t border-gray-200 p-4 space-y-4">
                  {/* Total */}
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span className="text-gray-800">Total:</span>
                    <span className="text-amber-600">BDT {calculateTotal().toFixed(2)}</span>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <h4 className="font-bold text-gray-700 mb-2 text-sm">Select Payment Method:</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {['cash', 'card', 'mobile_banking'].map(method => (
                        <button
                          key={method}
                          onClick={() => selectPaymentMethod(method)}
                          className={`p-2 rounded-lg border-2 transition text-xs ${
                            selectedPaymentMethod === method
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-300 hover:border-amber-500 hover:bg-amber-50'
                          }`}
                        >
                          <div className="font-medium capitalize">{method.replace('_', ' ')}</div>
                          {selectedPaymentMethod === method && (
                            <div className="text-xs mt-1">✓</div>
                          )}
                        </button>
                      ))}
                    </div>
                    {!selectedPaymentMethod && (
                      <p className="text-xs text-red-600 mt-2">
                        ⚠️ Please select a payment method
                      </p>
                    )}
                  </div>

                  {/* Order Button */}
                  <button
                    onClick={placeOrder}
                    disabled={isProcessing || !selectedPaymentMethod}
                    className={`w-full py-3 rounded-lg font-bold text-lg transition ${
                      selectedPaymentMethod
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isProcessing ? 'Processing...' : 
                     activeOrder ? `Update Order - BDT ${calculateTotal().toFixed(2)}` : 
                     selectedPaymentMethod ? `Place Order - BDT ${calculateTotal().toFixed(2)}` :
                     'Select Payment First'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'order-success') {
    // Merge duplicate items in order summary
    const mergedOrderDetails = orderSummary?.order_details?.reduce((acc, detail) => {
      const existing = acc.find(d => d.menu_items?.name === detail.menu_items?.name);
      if (existing) {
        existing.quantity += detail.quantity;
        existing.subtotal += detail.subtotal || (detail.price * detail.quantity);
      } else {
        acc.push({ ...detail });
      }
      return acc;
    }, []) || [];

    // Calculate the actual total from merged items
    const actualTotal = mergedOrderDetails.reduce((sum, detail) => 
      sum + (detail.subtotal || (detail.price * detail.quantity)), 0);
    
    // Use either orderSummary.total_amount or calculated total
    const displayTotal = orderSummary?.total_amount || actualTotal;

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-6">
        <ErrorAlert />
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
            <div className="space-y-3">
              {mergedOrderDetails.map((detail, idx) => {
                const subtotal = detail.subtotal || (detail.price * detail.quantity);
                return (
                  <div key={idx} className="flex justify-between items-center text-gray-700">
                    <div className="flex-1">
                      <div className="font-medium">{detail.menu_items?.name || 'Item'} × {detail.quantity}</div>
                    </div>
                    <div className="font-bold text-amber-600">BDT {subtotal.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-800 mt-4 pt-4 border-t">
              <span>Total:</span>
              <span className="text-amber-600">
                {displayTotal && !isNaN(displayTotal) ? `BDT ${displayTotal.toFixed(2)}` : 'BDT 0.00'}
              </span>
            </div>
          </div>

          {generatedReceipt && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-blue-800">Download Receipt</h3>
                  <p className="text-sm text-blue-600">Get a PDF copy of your order</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Order #{generatedReceipt.orderId} • {mergedOrderDetails.length} items
                  </p>
                </div>
                <ReceiptGenerator 
                  orderData={{
                    ...generatedReceipt,
                    items: mergedOrderDetails.map(detail => ({
                      name: detail.menu_items?.name || 'Item',
                      quantity: detail.quantity,
                      price: detail.price,
                      subtotal: detail.subtotal || (detail.price * detail.quantity)
                    })),
                    total: displayTotal && !isNaN(displayTotal) ? displayTotal : actualTotal
                  }} 
                  onDownload={() => {
                    alert('Receipt downloaded successfully!');
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={async () => {
                try {
                  // Load the complete order from database to refresh cart with ALL items
                  if (orderSummary?.id) {
                    await loadOrderIntoCart(orderSummary.id);
                  }
                  setView('menu');
                } catch (err) {
                  console.error('Error loading order for editing:', err);
                  setError('Failed to load order. Please try again.');
                  setView('menu');
                }
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