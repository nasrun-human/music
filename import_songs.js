import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importSongs() {
  console.log('Starting song import...');

  // Database setup
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    console.log('Uploads directory does not exist.');
    return;
  }

  const files = fs.readdirSync(uploadDir);
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a'];

  let addedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (audioExtensions.includes(ext)) {
      // Check if song already exists
      const existing = await db.get('SELECT * FROM songs WHERE url = ?', file);
      
      if (!existing) {
        const title = path.basename(file, ext); // Use filename as title
        const artist = 'Unknown Artist';
        const cover = "https://images.unsplash.com/photo-1459749411177-d4a37196040e?auto=format&fit=crop&q=80&w=400&h=400";
        
        await db.run(
          'INSERT INTO songs (title, artist, cover, url) VALUES (?, ?, ?, ?)',
          title,
          artist,
          cover,
          file
        );
        console.log(`Added: ${file}`);
        addedCount++;
      } else {
        skippedCount++;
      }
    }
  }

  console.log('-------------------');
  console.log(`Import completed!`);
  console.log(`Added: ${addedCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

importSongs().catch(err => {
  console.error('Error importing songs:', err);
});
