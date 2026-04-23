import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const TMP = path.join(os.tmpdir(), 'ytmp3-api');
fs.mkdirSync(TMP, { recursive: true });

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd });
    let err = '';
    p.stderr.on('data', d => err += d.toString());
    p.on('close', code => code === 0 ? resolve() : reject(new Error(err || `exit ${code}`)));
  });
}

app.post('/api/mp3', async (req, res) => {
  try {
    const url = String(req.body?.url || '').trim();
    const pattern = String(req.body?.pattern || '');
    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const id = uuidv4();
    const outTmpl = path.join(TMP, `${id}.%(ext)s`);
    const mp3Path = path.join(TMP, `${id}.mp3`);

    const args = [
      url,
      '-x', '--audio-format','mp3','--audio-quality','0',
      '--no-playlist',
      '--add-metadata',
      '--embed-thumbnail',
      '--prefer-ffmpeg',
      '--parse-metadata','playlist_title:%(album)s',
      '-o', outTmpl,
      '--restrict-filenames'
    ];
    if (pattern) args.push('--metadata-from-title', pattern);

    await run('yt-dlp', args, TMP);
    if (!fs.existsSync(mp3Path)) throw new Error('Output not found');

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');

    const stream = fs.createReadStream(mp3Path);
    stream.pipe(res);
    stream.on('close', () => fs.unlink(mp3Path, ()=>{}));
  } catch (e) {
    res.status(500).json({ error: e.message || 'Download failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('YT MP3 API on :'+PORT));