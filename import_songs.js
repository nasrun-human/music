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
      const filePath = path.join(uploadDir, file);

      // Check if song already exists in Database (by title/filename)
      const title = path.basename(file, ext);

      const { data: existing, error: fetchError } = await supabase
        .from('songs')
        .select('*')
        .eq('title', title) // Use title instead of url as we will use cloud URL
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking song:', fetchError);
        continue;
      }

      if (!existing) {
        console.log(`Uploading ${file} to Supabase Storage...`);

        // Read file
        const fileBuffer = fs.readFileSync(filePath);
        let contentType = 'audio/mpeg';
        if (ext === '.wav') contentType = 'audio/wav';
        if (ext === '.ogg') contentType = 'audio/ogg';
        if (ext === '.m4a') contentType = 'audio/mp4';

        // Upload to Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('songs')
          .upload(file, fileBuffer, {
            contentType: contentType,
            upsert: false
          });

        if (uploadError) {
          // If file already exists in storage but not in DB, we can still get public URL
          if (uploadError.message.includes('The resource already exists')) {
            console.log('File already in storage, getting URL...');
          } else {
            console.error(`Failed to upload ${file}:`, uploadError.message);
            continue;
          }
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('songs')
          .getPublicUrl(file);

        const artist = 'Unknown Artist';
        const cover = "https://images.unsplash.com/photo-1459749411177-d4a37196040e?auto=format&fit=crop&q=80&w=400&h=400";

        const { error: insertError } = await supabase
          .from('songs')
          .insert([{
            title,
            artist,
            cover,
            url: publicUrl
          }]);

        if (insertError) {
          console.error(`Failed to add metadata for ${file}:`, insertError.message);
        } else {
          console.log(`Added: ${title}`);
          addedCount++;
        }
      } else {
        console.log(`Skipped (Exists in DB): ${file}`);
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
