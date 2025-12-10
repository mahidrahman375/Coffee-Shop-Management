import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Package, AlertTriangle, Plus, Minus, RefreshCw, TrendingUp } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function InventoryManager() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restockQuantities, setRestockQuantities] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setIngredients(data || []);
      
      // Initialize restock quantities
      const initialQuantities = {};
      data?.forEach(ingredient => {
        initialQuantities[ingredient.id] = 0;
      });
      setRestockQuantities(initialQuantities);
    } catch (error) {
      console.error('Error loading ingredients:', error);
      alert('Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  };

  const handleRestockChange = (ingredientId, value) => {
    setRestockQuantities({
      ...restockQuantities,
      [ingredientId]: Math.max(0, parseFloat(value) || 0)
    });
  };

  const incrementRestock = (ingredientId, amount) => {
    const current = restockQuantities[ingredientId] || 0;
    handleRestockChange(ingredientId, current + amount);
  };

  const updateIngredientStock = async (ingredientId, quantityToAdd) => {
    if (quantityToAdd <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    const ingredient = ingredients.find(i => i.id === ingredientId);
    if (!ingredient) return;

    try {
      const newStock = ingredient.stock_quantity + quantityToAdd;
      
      const { error } = await supabase
        .from('ingredients')
        .update({ stock_quantity: newStock })
        .eq('id', ingredientId);

      if (error) throw error;

      alert(`Added ${quantityToAdd} ${ingredient.unit} of ${ingredient.name}`);
      
      // Reset the restock quantity
      setRestockQuantities({
        ...restockQuantities,
        [ingredientId]: 0
      });
      
      // Reload ingredients
      loadIngredients();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock');
    }
  };

  const updateMinimumStock = async (ingredientId, newMinimum) => {
    try {
      const { error } = await supabase
        .from('ingredients')
        .update({ minimum_stock: parseFloat(newMinimum) })
        .eq('id', ingredientId);

      if (error) throw error;

      loadIngredients();
    } catch (error) {
      console.error('Error updating minimum stock:', error);
      alert('Failed to update minimum stock');
    }
  };

  const bulkRestock = async (quantity) => {
    if (!confirm(`Add ${quantity} to all low stock items?`)) return;

    try {
      const lowStockItems = ingredients.filter(i => i.stock_quantity <= i.minimum_stock);
      
      for (const ingredient of lowStockItems) {
        const newStock = ingredient.stock_quantity + quantity;
        await supabase
          .from('ingredients')
          .update({ stock_quantity: newStock })
          .eq('id', ingredient.id);
      }

      alert(`Added ${quantity} to ${lowStockItems.length} low stock items`);
      loadIngredients();
    } catch (error) {
      console.error('Error in bulk restock:', error);
      alert('Failed to bulk restock');
    }
  };

  const filteredIngredients = ingredients.filter(ingredient =>
    ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ingredient.unit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = filteredIngredients.filter(i => i.stock_quantity <= i.minimum_stock);
  const outOfStockItems = filteredIngredients.filter(i => i.stock_quantity <= 0);
  const healthyStockItems = filteredIngredients.filter(i => i.stock_quantity > i.minimum_stock);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-500" />
            Inventory Management
          </h2>
          <p className="text-gray-600 mt-1">Manage ingredient stock levels</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg w-full md:w-64"
          />
          
          <div className="flex gap-2">
            <button
              onClick={() => bulkRestock(10)}
              className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm"
            >
              +10 to Low Stock
            </button>
            
            <button
              onClick={loadIngredients}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {outOfStockItems.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-red-800">Out of Stock!</h3>
          </div>
          <p className="text-red-700 text-sm">
            {outOfStockItems.length} ingredient(s) are completely out of stock.
          </p>
        </div>
      )}

      {lowStockItems.length > 0 && outOfStockItems.length === 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-800">Low Stock Alert!</h3>
          </div>
          <p className="text-amber-700 text-sm">
            {lowStockItems.length} ingredient(s) are running low.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Ingredients</p>
          <p className="text-2xl font-bold text-gray-800">{ingredients.length}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Low Stock</p>
          <p className="text-2xl font-bold text-red-600">{lowStockItems.length}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Healthy Stock</p>
          <p className="text-2xl font-bold text-green-600">{healthyStockItems.length}</p>
        </div>
      </div>

      {/* Inventory List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading inventory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingredient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Restock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredIngredients.map(ingredient => {
                  const isLowStock = ingredient.stock_quantity <= ingredient.minimum_stock;
                  const isOutOfStock = ingredient.stock_quantity <= 0;
                  const restockQty = restockQuantities[ingredient.id] || 0;
                  
                  return (
                    <tr key={ingredient.id} className={
                      isOutOfStock ? 'bg-red-50' :
                      isLowStock ? 'bg-amber-50' :
                      'hover:bg-gray-50'
                    }>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{ingredient.name}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{ingredient.unit}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{ingredient.stock_quantity}</div>
                        {isOutOfStock && (
                          <div className="text-xs text-red-600 mt-1">Out of stock!</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          defaultValue={ingredient.minimum_stock}
                          onBlur={(e) => updateMinimumStock(ingredient.id, e.target.value)}
                          className="w-20 px-2 py-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {isOutOfStock ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => incrementRestock(ingredient.id, -1)}
                            className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300"
                            disabled={restockQty <= 0}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={restockQty}
                            onChange={(e) => handleRestockChange(ingredient.id, e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-center"
                            placeholder={`Add ${ingredient.unit}`}
                          />
                          
                          <button
                            onClick={() => incrementRestock(ingredient.id, 1)}
                            className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => updateIngredientStock(ingredient.id, restockQty)}
                          disabled={restockQty <= 0}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            restockQty > 0
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Add Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {filteredIngredients.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Showing {filteredIngredients.length} ingredients</span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold text-gray-800 mb-4">Quick Restock Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[5, 10, 25, 50].map(amount => (
            <button
              key={amount}
              onClick={() => bulkRestock(amount)}
              className="px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium"
            >
              +{amount} to Low Stock
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
