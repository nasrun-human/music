import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// API base URL
const API_URL = '/api';

const Admin = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [songs, setSongs] = useState([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetch(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => setUsers(data));

      fetch(`${API_URL}/songs`)
        .then(res => res.json())
        .then(data => setSongs(data));
    }
  }, [user]);

  if (user?.role !== 'admin') {
    return <div className="text-white text-center mt-10">Access Denied</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8 text-purple-500">Admin Dashboard</h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-bold mb-4 flex justify-between">
            Users
            <span className="bg-purple-600 px-2 py-1 rounded text-sm">{users.length}</span>
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded">
                <img src={u.avatar} alt={u.username} className="w-10 h-10 rounded-full" />
                <div>
                  <p className="font-bold">{u.username}</p>
                  <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-bold mb-4 flex justify-between">
            Songs
            <span className="bg-purple-600 px-2 py-1 rounded text-sm">{songs.length}</span>
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {songs.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded">
                <img src={s.cover} alt={s.title} className="w-10 h-10 rounded object-cover" />
                <div>
                  <p className="font-bold truncate">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
