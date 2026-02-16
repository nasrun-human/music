import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Setup
const supabaseUrl = 'https://vfsqbtxvosdbncolnbko.supabase.co';
const supabaseKey = 'sb_publishable_mMWZNi6FrjyRMwxrewiC4Q_5KCEEdqf'; // WARNING: Check if this key works. If not, get the 'anon' public key starting with 'ey...'
const supabase = createClient(supabaseUrl, supabaseKey);

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



// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
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

    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword, avatar, role: 'user' }])
      .select();

    if (error) throw error;

    res.json({ message: 'User registered successfully', userId: data[0].id });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Username already exists or error creating user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) return res.status(400).json({ error: 'User not found' });

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
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, avatar')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Management (Admin only usually, but open for demo list)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, role, avatar');

    if (error) throw error;
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Songs Routes
app.get('/api/songs', async (req, res) => {
  try {
    const { data: songs, error } = await supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

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

    const { data, error } = await supabase
      .from('songs')
      .insert([{
        title: title || req.file.originalname.replace(/\.[^/.]+$/, ""),
        artist: artist || 'Unknown Artist',
        cover,
        url: filename
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({
      ...data,
      url: `/uploads/${data.url}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Messages Routes (History)
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    // Join not directly supported in simple select without definition, but we can fetch and map or use view
    // Supabase supports foreign key joins
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        users:sender_id (username, avatar)
      `)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform to match previous format if needed, or update frontend
    // Previous format: m.*, u.username, u.avatar
    const formattedMessages = messages.map(msg => ({
      ...msg,
      username: msg.users?.username,
      avatar: msg.users?.avatar
    }));

    res.json(formattedMessages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_chat', (userData) => {
    socket.userData = userData; // Store user info in socket
    // io.emit('system_message', { content: `${userData.username} joined the chat` });
  });

  socket.on('send_message', async (data) => {
    // data: { sender_id, content, username, avatar }
    try {
      // Save to DB
      const { error } = await supabase
        .from('messages')
        .insert([{ sender_id: data.sender_id, content: data.content }]);

      if (error) {
        console.error('Error saving message:', error);
      } else {
        // Broadcast to all
        io.emit('receive_message', data);
      }
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
