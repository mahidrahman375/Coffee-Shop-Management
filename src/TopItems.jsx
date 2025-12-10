import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, Coffee } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function TopItems() {
  const [topItems, setTopItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopItems();
  }, []);

  const loadTopItems = async () => {
    try {
      // Get orders from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_details(*, menu_items(*))')
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      // Calculate item popularity
      const itemCount = {};
      
      orders.forEach(order => {
        order.order_details.forEach(detail => {
          const itemId = detail.menu_item_id;
          if (!itemCount[itemId]) {
            itemCount[itemId] = {
              ...detail.menu_items,
              count: 0
            };
          }
          itemCount[itemId].count += detail.quantity;
        });
      });

      // Sort and get top 3
      const sortedItems = Object.values(itemCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      setTopItems(sortedItems);
    } catch (error) {
      console.error('Error loading top items:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading popular items...</p>
      </div>
    );
  }

  if (topItems.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">No popular items data available</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg p-6 border border-amber-200">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-8 h-8 text-amber-600" />
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Most Popular This Week</h3>
          <p className="text-amber-700">Customer favorites you might love</p>
        </div>
      </div>

      <div className="space-y-4">
        {topItems.map((item, index) => (
          <div key={item.id} className="flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm">
            <div className="w-10 h-10 flex items-center justify-center bg-amber-100 text-amber-800 rounded-full font-bold text-lg">
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-gray-800">{item.name}</h4>
                  <p className="text-sm text-gray-600">{item.description?.substring(0, 50)}...</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-600 text-lg">৳{item.price}</div>
                  <div className="text-sm text-gray-500">
                    <Coffee className="inline-block w-3 h-3 mr-1" />
                    {item.count} ordered this week
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-amber-200 text-center">
        <p className="text-sm text-gray-600">
          Based on customer orders from the past 7 days
        </p>
      </div>
    </div>
  );
}