import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// In production, we don't need CORS for the same domain, or we set it to the domain
// For development, we allow localhost:5173
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction ? [] : ["http://localhost:5173"];

const io = new Server(server, {
  cors: {
    origin: isProduction ? "*" : "http://localhost:5173", // Allow all in prod for simplicity or specific domain
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-it-in-production';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Middleware
app.use(cors({
  origin: "*" // Allow all origins for now to fix connection issues
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from the React app build directory
if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Database setup
let db;
(async () => {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Songs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      cover TEXT,
      url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Messages Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES users(id)
    )
  `);

  // Seed initial admin user
  const adminExists = await db.get('SELECT * FROM users WHERE username = ?', 'admin');
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.run(
      'INSERT INTO users (username, password, role, avatar) VALUES (?, ?, ?, ?)',
      'admin', hashedPassword, 'admin', 'https://ui-avatars.com/api/?name=Admin'
    );
    console.log('Created admin user: admin / admin123');
  }

  // Seed data if empty
  const count = await db.get('SELECT COUNT(*) as count FROM songs');
  if (count.count === 0) {
    const seedSongs = [
      {
        title: "Melody of Nature",
        artist: "Nature Sounds",
        cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=400&h=400",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
      },
      {
        title: "Urban Rhythm",
        artist: "City Vibes",
        cover: "https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&q=80&w=400&h=400",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
      },
      {
        title: "Deep Focus",
        artist: "Concentration",
        cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&q=80&w=400&h=400",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
      }
    ];

    for (const song of seedSongs) {
      await db.run(
        'INSERT INTO songs (title, artist, cover, url) VALUES (?, ?, ?, ?)',
        song.title, song.artist, song.cover, song.url
      );
    }
    console.log('Seeded initial songs');
  }
})();

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let ext = path.extname(file.originalname);
    if ((!ext || ext === '') && (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/'))) {
      // Basic extension mapping
      switch (file.mimetype) {
        case 'audio/mpeg': ext = '.mp3'; break;
        case 'audio/wav': ext = '.wav'; break;
        case 'audio/ogg': ext = '.ogg'; break;
        case 'video/mp4': ext = '.mp4'; break;
        default: ext = '.mp3'; // Default to mp3 if unknown
      }
    }
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB limit
  }
});

// --- Routes ---

// Auth Routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = `https://ui-avatars.com/api/?name=${username}`;
    const result = await db.run(
      'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
      username, hashedPassword, avatar
    );
    res.json({ message: 'User registered successfully', userId: result.lastID });
  } catch (error) {
    res.status(400).json({ error: 'Username already exists or error creating user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', username);
    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, role, avatar FROM users WHERE id = ?', req.user.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Management (Admin only usually, but open for demo list)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, role, avatar FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Songs Routes
app.get('/api/songs', async (req, res) => {
  try {
    const songs = await db.all('SELECT * FROM songs ORDER BY created_at DESC');
    const songsWithFullUrl = songs.map(song => ({
      ...song,
      url: song.url.startsWith('http') ? song.url : `/uploads/${song.url}`
    }));
    res.json(songsWithFullUrl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/songs', authenticateToken, (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading.
      return res.status(500).json({ error: `Unknown upload error: ${err.message}` });
    }
    // Everything went fine.
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const { title, artist } = req.body;
    const filename = req.file.filename;
    const cover = "https://images.unsplash.com/photo-1459749411177-d4a37196040e?auto=format&fit=crop&q=80&w=400&h=400";

    const result = await db.run(
      'INSERT INTO songs (title, artist, cover, url) VALUES (?, ?, ?, ?)',
      title || req.file.originalname.replace(/\.[^/.]+$/, ""),
      artist || 'Unknown Artist',
      cover,
      filename
    );

    const newSong = await db.get('SELECT * FROM songs WHERE id = ?', result.lastID);

    res.json({
      ...newSong,
      url: `/uploads/${newSong.url}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Messages Routes (History)
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await db.all(`
      SELECT m.*, u.username, u.avatar 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      ORDER BY m.created_at ASC LIMIT 50
    `);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_chat', (userData) => {
    socket.userData = userData; // Store user info in socket
    io.emit('system_message', { content: `${userData.username} joined the chat` });
  });

  socket.on('send_message', async (data) => {
    // data: { sender_id, content, username, avatar }
    try {
      // Save to DB
      await db.run(
        'INSERT INTO messages (sender_id, content) VALUES (?, ?)',
        data.sender_id, data.content
      );
      // Broadcast to all
      io.emit('receive_message', data);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
if (isProduction) {
  // Use regex or different syntax for catchall in Express 5+ / path-to-regexp
  app.get(/(.*)/, (req, res) => {
    // Check if request is for API
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return res.status(404).json({ error: 'Not Found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
