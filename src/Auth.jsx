import React, { useState } from 'react';
import { LogIn, Lock, Coffee } from 'lucide-react';

export default function Auth({ setAdmin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === 'admin@coffeeshop.com' && password === 'admin123') {
      localStorage.setItem('adminLoggedIn', 'true');
      setAdmin(true);
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4 md:p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-amber-600 p-6 md:p-8 text-center">
          <Coffee className="w-12 h-12 md:w-16 md:h-16 mx-auto text-white mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold text-white">Coffee Shop Admin</h1>
          <p className="text-amber-100 mt-2">Secure Admin Portal</p>
        </div>
        
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-amber-600" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Admin Login</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="admin@coffeeshop.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-600 text-white py-3 rounded-lg font-bold hover:bg-amber-700 transition flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Login as Admin
            </button>

            <div className="text-center text-sm text-gray-600 pt-4 border-t">
              <p>Demo Credentials:</p>
              <p className="font-mono mt-1">Email: admin@coffeeshop.com</p>
              <p className="font-mono">Password: admin123</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
