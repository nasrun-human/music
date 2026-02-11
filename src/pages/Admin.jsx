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

  const handleUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const res = await fetch(`${API_URL}/songs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      if (res.ok) {
        alert('Song uploaded successfully!');
        const newSong = await res.json();
        setSongs([newSong, ...songs]);
        e.target.reset();
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      alert('Error uploading song');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8 text-purple-500">Admin Dashboard</h1>

      {/* Upload Section */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8">
        <h2 className="text-xl font-bold mb-4">Upload New Song</h2>
        <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input name="title" required className="w-full bg-gray-700 p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Song Title" />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm text-gray-400 mb-1">Artist</label>
            <input name="artist" required className="w-full bg-gray-700 p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Artist Name" />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm text-gray-400 mb-1">MP3 File</label>
            <input type="file" name="audio" accept="audio/*" required className="w-full bg-gray-700 p-2 rounded text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700" />
          </div>
          <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-bold transition-colors h-[42px]">
            Upload
          </button>
        </form>
      </div>

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
