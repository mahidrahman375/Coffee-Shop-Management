import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Package, Clock, Award, Users, Calendar, PieChart } from 'lucide-react';

export default function Dashboard({ orders }) {
  const [timeRange, setTimeRange] = useState('today');
  const [topItems, setTopItems] = useState([]);
  const [revenueData, setRevenueData] = useState({ daily: [], weekly: [] });
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    pendingOrders: 0,
    customersServed: 0,
    bestSellingItem: ''
  });

  useEffect(() => {
    calculateStats();
    calculateTopItems();
    calculateRevenueData();
  }, [orders, timeRange]);

  const calculateStats = () => {
    const now = new Date();
    let filteredOrders = [...orders];

    if (timeRange === 'today') {
      filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.toDateString() === now.toDateString();
      });
    } else if (timeRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(order => new Date(order.created_at) >= weekAgo);
    } else if (timeRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(order => new Date(order.created_at) >= monthAgo);
    }

    const completedOrders = filteredOrders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const totalOrders = completedOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const pendingOrders = filteredOrders.filter(o => o.status === 'pending').length;
    
    // Calculate unique tables served as customers
    const uniqueTables = [...new Set(completedOrders.map(order => order.table_id))];
    
    // Find best selling item
    const itemSales = {};
    completedOrders.forEach(order => {
      order.order_details?.forEach(detail => {
        const itemName = detail.menu_items?.name || 'Unknown';
        itemSales[itemName] = (itemSales[itemName] || 0) + detail.quantity;
      });
    });
    
    const bestSellingItem = Object.entries(itemSales)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

    setStats({
      totalRevenue,
      totalOrders,
      avgOrderValue,
      pendingOrders,
      customersServed: uniqueTables.length,
      bestSellingItem
    });
  };

  const calculateTopItems = () => {
    const itemSales = {};
    const itemRevenue = {};
    
    orders.forEach(order => {
      if (order.status === 'completed') {
        order.order_details?.forEach(detail => {
          const itemName = detail.menu_items?.name || 'Unknown Item';
          if (!itemSales[itemName]) {
            itemSales[itemName] = 0;
            itemRevenue[itemName] = 0;
          }
          itemSales[itemName] += detail.quantity;
          itemRevenue[itemName] += detail.subtotal;
        });
      }
    });

    const topItemsArray = Object.entries(itemRevenue)
      .map(([name, revenue]) => ({
        name,
        quantity: itemSales[name] || 0,
        revenue,
        profit: revenue * 0.6 // Assuming 60% profit margin
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    setTopItems(topItemsArray);
  };

  const calculateRevenueData = () => {
    // Daily revenue for last 7 days
    const daily = [];
    const weekly = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.toDateString() === date.toDateString() && 
               order.status === 'completed';
      });
      
      const dayRevenue = dayOrders.reduce((sum, order) => sum + order.total_amount, 0);
      daily.push({ day: dateStr, revenue: dayRevenue });
    }
    
    // Weekly revenue for last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= weekStart && orderDate <= weekEnd && 
               order.status === 'completed';
      });
      
      const weekRevenue = weekOrders.reduce((sum, order) => sum + order.total_amount, 0);
      weekly.push({ week: `Week ${4-i}`, revenue: weekRevenue });
    }
    
    setRevenueData({ daily, weekly });
  };

  const StatCard = ({ title, value, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-2">
            {typeof value === 'number' && value % 1 !== 0 ? `৳${value.toFixed(2)}` : value}
          </p>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-4 h-4 ${trend > 0 ? '' : 'rotate-180'}`} />
              <span>{trend > 0 ? '+' : ''}{trend}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-500" />
          Sales Analytics Dashboard
        </h2>
        <div className="flex gap-2">
          {['today', 'week', 'month', 'all'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg capitalize text-sm font-medium ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range === 'all' ? 'All Time' : `This ${range}`}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={stats.totalRevenue}
          icon={DollarSign}
          color="bg-green-500"
          trend={12.5}
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={Package}
          color="bg-blue-500"
          trend={8.3}
        />
        <StatCard
          title="Avg Order Value"
          value={stats.avgOrderValue}
          icon={TrendingUp}
          color="bg-purple-500"
          trend={5.2}
        />
        <StatCard
          title="Customers Served"
          value={stats.customersServed}
          icon={Users}
          color="bg-amber-500"
          trend={15.7}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-6">
            <Award className="w-6 h-6 text-amber-500" />
            <h3 className="text-xl font-bold text-gray-800">Top Selling Items</h3>
          </div>
          
          <div className="space-y-4">
            {topItems.length > 0 ? (
              topItems.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 flex items-center justify-center bg-amber-100 text-amber-800 rounded-full font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.quantity} sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">৳{item.revenue.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">
                      Profit: <span className="text-green-500">৳{item.profit.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No sales data available</p>
            )}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Best Selling:</span>
              <span className="font-bold text-gray-800">{stats.bestSellingItem}</span>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-6 h-6 text-blue-500" />
            <h3 className="text-xl font-bold text-gray-800">Revenue Analysis</h3>
          </div>
          
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3">Daily Revenue (Last 7 Days)</h4>
            <div className="space-y-2">
              {revenueData.daily.map((day, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 w-12">{day.day}</span>
                  <div className="flex-1 ml-4">
                    <div className="h-6 bg-blue-100 rounded overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded"
                        style={{ 
                          width: `${(day.revenue / Math.max(...revenueData.daily.map(d => d.revenue)) * 100) || 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-800 w-20 text-right">
                    ৳{day.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-200">
            <h4 className="font-medium text-gray-700 mb-3">Weekly Revenue (Last 4 Weeks)</h4>
            <div className="grid grid-cols-2 gap-4">
              {revenueData.weekly.map((week, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">{week.week}</p>
                  <p className="text-lg font-bold text-gray-800">৳{week.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-6 h-6 text-green-500" />
          <h3 className="text-xl font-bold text-gray-800">Real-time Stats</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700">Pending Orders</p>
            <p className="text-3xl font-bold text-green-800 mt-2">{stats.pendingOrders}</p>
          </div>
          
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">Today's Revenue</p>
            <p className="text-3xl font-bold text-blue-800 mt-2">
              ৳{orders
                .filter(o => {
                  const orderDate = new Date(o.created_at);
                  const today = new Date();
                  return orderDate.toDateString() === today.toDateString() && 
                         o.status === 'completed';
                })
                .reduce((sum, order) => sum + order.total_amount, 0)
                .toFixed(2)}
            </p>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-700">This Month</p>
            <p className="text-3xl font-bold text-purple-800 mt-2">
              ৳{orders
                .filter(o => {
                  const orderDate = new Date(o.created_at);
                  const now = new Date();
                  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  return orderDate >= monthAgo && o.status === 'completed';
                })
                .reduce((sum, order) => sum + order.total_amount, 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Order #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Table</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.slice(0, 10).map(order => (
                <tr key={order.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{order.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Table {order.tables?.table_number || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-amber-600">৳{order.total_amount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}