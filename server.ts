import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import { initDb } from './src/db/index.ts';
import authRoutes from './src/api/auth.ts';
import videoRoutes from './src/api/videos.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB
  initDb();

  // Ensure uploads directory exists (skip or use /tmp in serverless)
  const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const uploadDir = isServerless ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads');
  
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (error) {
    console.warn('Could not create upload directory:', error);
  }

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/videos', videoRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Video Portal API is running' });
  });

  // Serve uploaded videos
  app.use('/uploads', express.static(uploadDir));

  // Serve static frontend files
  const publicDir = path.join(process.cwd(), 'public');
  const rootDir = process.cwd();
  app.use(express.static(publicDir));
  app.use(express.static(rootDir));

  // Fallback for HTML files (simple routing)
  app.get('/', (req, res) => res.sendFile(path.join(rootDir, 'index.html')));
  app.get('/admin.html', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
  app.get('/watch.html', (req, res) => res.sendFile(path.join(publicDir, 'watch.html')));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
