import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Setup
const supabaseUrl = 'https://vfsqbtxvosdbncolnbko.supabase.co';
const supabaseKey = 'sb_publishable_mMWZNi6FrjyRMwxrewiC4Q_5KCEEdqf'; // WARNING: Check if this key works.
const supabase = createClient(supabaseUrl, supabaseKey);

async function importSongs() {
  console.log('Starting song import...');

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
      const { data: existing, error: fetchError } = await supabase
        .from('songs')
        .select('*')
        .eq('url', file)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Row not found"
        console.error('Error checking song:', fetchError);
        continue;
      }

      if (!existing) {
        const title = path.basename(file, ext); // Use filename as title
        const artist = 'Unknown Artist';
        const cover = "https://images.unsplash.com/photo-1459749411177-d4a37196040e?auto=format&fit=crop&q=80&w=400&h=400";
        
        const { error: insertError } = await supabase
          .from('songs')
          .insert([{
            title,
            artist,
            cover,
            url: file
          }]);

        if (insertError) {
           console.error(`Failed to add ${file}:`, insertError.message);
        } else {
           console.log(`Added: ${file}`);
           addedCount++;
        }
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
