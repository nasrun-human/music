import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music, User, LogOut, Settings } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Hide navbar on login/register pages if desired, but keeping it is fine
  
  return (
    <nav className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-white flex items-center gap-2">
          <Music className="w-8 h-8 text-purple-500" />
          MusicPlayer
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" className={`text-gray-300 hover:text-white flex items-center gap-1 ${location.pathname === '/admin' ? 'text-purple-400' : ''}`}>
                  <Settings className="w-4 h-4" /> <span className="hidden md:inline">Admin</span>
                </Link>
              )}
              <Link to="/profile" className="flex items-center gap-2 text-gray-300 hover:text-white">
                <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full border border-purple-500" />
                <span className="hidden md:inline">{user.username}</span>
              </Link>
            </>
          ) : (
            <div className="flex gap-4">
              <Link to="/login" className="text-gray-300 hover:text-white">Login</Link>
              <Link to="/register" className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-colors">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
