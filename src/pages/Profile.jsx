import React from 'react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
        <img src={user.avatar} alt={user.username} className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-purple-500" />
        <h1 className="text-3xl font-bold mb-2">{user.username}</h1>
        <p className="text-gray-400 mb-6 capitalize">{user.role}</p>
        
        <div className="bg-gray-700 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-gray-400 mb-1">User ID</p>
          <p className="font-mono text-sm">{user.id}</p>
        </div>

        <button 
          onClick={logout}
          className="w-full bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded-lg font-bold transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;
