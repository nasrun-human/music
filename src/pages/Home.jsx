import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, List, Upload, Plus, Shuffle, Repeat, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// API base URL
// Use relative path in production (or when served by backend), otherwise localhost:3000
const API_URL = '/api';

const Home = () => {
  const [songs, setSongs] = useState([]);
  const [filteredSongs, setFilteredSongs] = useState([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0); // 0: off, 1: all, 2: one

  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Use filteredSongs if search is active, otherwise use all songs for playlist display
  // But for playback logic (next/prev), we usually stick to the current list or the full list
  // Let's use the full list for playback but just filter the sidebar view for now
  // OR better: if searching, playing next should play from filtered list?
  // Standard behavior: Sidebar shows filtered, but Next/Prev follows the context.
  // To keep it simple: Next/Prev follows the visible list if playing from it.

  // Let's define the "active playlist" as the source of truth
  const displaySongs = searchQuery ? filteredSongs : songs;
  const currentSong = songs[currentSongIndex];

  // Fetch songs from API
  useEffect(() => {
    fetchSongs();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = songs.filter(song =>
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSongs(filtered);
    } else {
      setFilteredSongs(songs);
    }
  }, [searchQuery, songs]);

  const fetchSongs = async () => {
    try {
      const response = await fetch(`${API_URL}/songs`);
      if (!response.ok) throw new Error('Failed to fetch songs');
      const data = await response.json();
      setSongs(data);
      setFilteredSongs(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching songs:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentSong && isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Error playing audio:", error);
          setIsPlaying(false);
        });
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying, currentSongIndex, currentSong]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const getNextIndex = () => {
    if (repeatMode === 2) { // Repeat One
      return currentSongIndex;
    }

    if (isShuffle) {
      let nextIndex = Math.floor(Math.random() * songs.length);
      while (nextIndex === currentSongIndex && songs.length > 1) {
        nextIndex = Math.floor(Math.random() * songs.length);
      }
      return nextIndex;
    }

    // Normal or Repeat All
    const nextIndex = (currentSongIndex + 1) % songs.length;

    // If Repeat Off and we reached the end, stop
    if (repeatMode === 0 && currentSongIndex === songs.length - 1) {
      return -1;
    }

    return nextIndex;
  };

  const nextSong = () => {
    const index = getNextIndex();
    if (index !== -1) {
      setCurrentSongIndex(index);
      setProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const prevSong = () => {
    // If more than 3 seconds in, restart song
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (isShuffle) {
      // Ideally we should have a history stack, but random is fine for simple shuffle
      let prevIndex = Math.floor(Math.random() * songs.length);
      setCurrentSongIndex(prevIndex);
    } else {
      setCurrentSongIndex((prev) => (prev - 1 + songs.length) % songs.length);
    }
    setProgress(0);
    setIsPlaying(true);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      setProgress(current);
      if (duration) setDuration(duration);
    }
  };

  const onLoadedMetadata = (e) => {
    setDuration(e.target.duration);
  };

  const handleProgressChange = (e) => {
    const newTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setProgress(newTime);
  };

  const handleFileChange = async (e) => {
    if (!user) {
      alert("Please login to upload songs");
      navigate('/login');
      return;
    }

    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ""));
      formData.append('artist', user.username || 'Unknown Artist');

      try {
        const response = await fetch(`${API_URL}/songs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = 'Upload failed';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            console.error('Error parsing error response:', e);
            // Fallback to status text if JSON parse fails
            errorMessage = `Upload failed (${response.status} ${response.statusText})`;
          }
          throw new Error(errorMessage);
        }

        const newSong = await response.json();
        setSongs(prev => [newSong, ...prev]);

      } catch (error) {
        console.error('Error uploading file:', error);
        alert(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-0 md:p-4 w-full max-w-7xl mx-auto h-[calc(100vh-64px)] md:h-auto">
      <div className="bg-gray-900 md:bg-gray-800 md:rounded-2xl shadow-none md:shadow-2xl w-full flex overflow-hidden relative h-full md:h-[600px]">

        {/* Sidebar / Song List */}
        <div className={`absolute inset-y-0 left-0 z-20 w-full md:w-80 bg-gray-900 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col border-r border-gray-700`}>
          <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 sticky top-0 z-10">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Music className="w-6 h-6 text-purple-500" />
              Playlist
            </h2>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800">
              ✕
            </button>
          </div>

          <div className="p-4 border-b border-gray-700 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="audio/*,video/mp4,video/x-m4v"
              multiple
            />
            <button
              onClick={() => user ? fileInputRef.current.click() : navigate('/login')}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Upload Songs
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading songs...</div>
            ) : displaySongs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No songs found</p>
                {searchQuery && <p className="text-sm mt-2">Try a different search term</p>}
              </div>
            ) : (
              displaySongs.map((song) => {
                // Find original index for click handler
                const originalIndex = songs.findIndex(s => s.id === song.id);
                return (
                  <div
                    key={song.id}
                    onClick={() => {
                      setCurrentSongIndex(originalIndex);
                      setIsPlaying(true);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`p-4 cursor-pointer hover:bg-gray-800 transition-colors flex items-center gap-3 border-b border-gray-800/50 ${currentSongIndex === originalIndex ? 'bg-gray-800 border-l-4 border-l-purple-500' : ''}`}
                  >
                    <img src={song.cover} alt={song.title} className="w-10 h-10 rounded object-cover" />
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium truncate text-sm ${currentSongIndex === originalIndex ? 'text-purple-400' : 'text-gray-200'}`}>{song.title}</h3>
                      <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                    </div>
                    {currentSongIndex === originalIndex && isPlaying && (
                      <div className="flex gap-1 items-end h-3">
                        <span className="w-0.5 h-2 bg-purple-500 animate-pulse"></span>
                        <span className="w-0.5 h-3 bg-purple-500 animate-pulse delay-75"></span>
                        <span className="w-0.5 h-2 bg-purple-500 animate-pulse delay-150"></span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main Player Area */}
        <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center relative bg-gradient-to-br from-gray-900 via-gray-800 to-black min-w-0 h-full">

          {/* Mobile Header / Menu Button */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center md:hidden z-10">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <List className="w-6 h-6" />
            </button>
            <span className="text-sm font-medium text-gray-400">Now Playing</span>
            <div className="w-10"></div> {/* Spacer for center alignment */}
          </div>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 p-2 hidden md:block text-gray-400 hover:text-white transition-colors"
          >
            <List className="w-6 h-6" />
          </button>

          {currentSong ? (
            <div className="flex flex-col items-center w-full max-w-lg animate-in fade-in duration-500">
              {/* Album Art */}
              <div className="w-48 h-48 md:w-72 md:h-72 mb-8 relative group shrink-0">
                <div className={`absolute inset-0 bg-purple-500 rounded-2xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 ${isPlaying ? 'animate-pulse' : ''}`}></div>
                <img
                  src={currentSong.cover}
                  alt={currentSong.title}
                  className={`relative w-full h-full object-cover rounded-2xl shadow-2xl transition-transform duration-700 ease-out ${isPlaying ? 'scale-105' : 'scale-100'}`}
                />
              </div>

              {/* Song Info */}
              <div className="text-center mb-8 w-full">
                <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white truncate px-4 drop-shadow-lg">{currentSong.title}</h1>
                <p className="text-gray-400 text-lg truncate px-4">{currentSong.artist}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full mb-8 px-4">
                <div className="flex justify-between text-xs text-gray-400 mb-2 font-medium">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="relative w-full h-2 bg-gray-700 rounded-full cursor-pointer group">
                  <div
                    className="absolute top-0 left-0 h-full bg-purple-600 rounded-full group-hover:bg-purple-500 transition-colors"
                    style={{ width: `${(progress / duration) * 100}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={progress}
                    onChange={handleProgressChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between w-full max-w-xs md:max-w-sm px-4">
                <button
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`p-2 rounded-full transition-all ${isShuffle ? 'text-purple-500 bg-purple-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  title="Shuffle"
                >
                  <Shuffle className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <button onClick={prevSong} className="p-2 text-white hover:text-purple-400 transition-colors transform hover:-translate-x-1">
                  <SkipBack className="w-8 h-8 md:w-9 md:h-9" />
                </button>

                <button
                  onClick={togglePlay}
                  className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center text-white shadow-xl shadow-purple-600/30 hover:scale-110 hover:shadow-purple-600/50 transition-all duration-300"
                >
                  {isPlaying ? <Pause className="w-8 h-8 md:w-10 md:h-10 fill-current" /> : <Play className="w-8 h-8 md:w-10 md:h-10 ml-1 fill-current" />}
                </button>

                <button onClick={nextSong} className="p-2 text-white hover:text-purple-400 transition-colors transform hover:translate-x-1">
                  <SkipForward className="w-8 h-8 md:w-9 md:h-9" />
                </button>

                <button
                  onClick={() => setRepeatMode((prev) => (prev + 1) % 3)}
                  className={`p-2 rounded-full transition-all relative ${repeatMode > 0 ? 'text-purple-500 bg-purple-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  title="Repeat"
                >
                  <Repeat className="w-5 h-5 md:w-6 md:h-6" />
                  {repeatMode === 2 && (
                    <span className="absolute top-1 right-1 text-[8px] font-bold bg-purple-500 text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>
                  )}
                </button>
              </div>

              <audio
                ref={audioRef}
                src={currentSong.url}
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={onLoadedMetadata}
                onEnded={nextSong}
                onError={(e) => console.error("Audio playback error:", e)}
              />
            </div>
          ) : (
            <div className="text-center text-gray-500 flex flex-col items-center animate-pulse">
              <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                <Music className="w-10 h-10 opacity-50" />
              </div>
              <p className="text-lg font-medium mb-2">No Song Selected</p>
              <p className="text-sm opacity-60">Choose a song from the playlist to start listening</p>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="mt-6 px-6 py-2 bg-purple-600/20 text-purple-400 rounded-full hover:bg-purple-600/30 transition-colors md:hidden"
              >
                Open Playlist
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
