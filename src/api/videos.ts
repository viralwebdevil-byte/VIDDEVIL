import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/index.ts';
import { videos, categories, tags, videoCategories, videoTags } from '../db/schema.ts';
import { eq, like, or, and, sql } from 'drizzle-orm';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp4', '.mkv', '.avi', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MKV, AVI, and MOV are allowed.'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});

// Middleware for admin check
const isAdmin = (req: any, res: any, next: any) => {
  // In a real app, verify JWT from cookie/header
  // For now, let's assume the frontend sends the token or we check the cookie
  next();
};

// Public: Get all videos (paginated)
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const offset = (page - 1) * limit;
  const q = req.query.q as string;

  try {
    let query = db.select().from(videos);
    
    if (q) {
      // @ts-ignore
      query = query.where(or(like(videos.title, `%${q}%`), like(videos.description, `%${q}%`)));
    }

    const results = await query.limit(limit).offset(offset);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching videos' });
  }
});

// Public: Get single video
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const video = await db.query.videos.findFirst({
      where: eq(videos.id, id),
    });
    if (!video) return res.status(404).json({ message: 'Video not found' });
    
    // Increment view count
    await db.update(videos).set({ viewCount: (video.viewCount || 0) + 1 }).where(eq(videos.id, id));
    
    res.json(video);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching video' });
  }
});

// Admin: Upload video
router.post('/', upload.single('video'), async (req, res) => {
  const { title, description, categoryIds, tagNames } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ message: 'No video file uploaded' });

  try {
    const [newVideo] = await db.insert(videos).values({
      title,
      description,
      filePath: `/uploads/${file.filename}`,
      duration: 0, // In a real app, use a library like fluent-ffmpeg to get duration
    }).returning();

    // Handle categories
    if (categoryIds) {
      const ids = JSON.parse(categoryIds);
      for (const catId of ids) {
        await db.insert(videoCategories).values({ videoId: newVideo.id, categoryId: catId });
      }
    }

    // Handle tags
    if (tagNames) {
      const names = JSON.parse(tagNames);
      for (const name of names) {
        let tag = await db.query.tags.findFirst({ where: eq(tags.name, name) });
        if (!tag) {
          [tag] = await db.insert(tags).values({ name }).returning();
        }
        await db.insert(videoTags).values({ videoId: newVideo.id, tagId: tag.id });
      }
    }

    res.status(201).json(newVideo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error uploading video' });
  }
});

// Admin: Delete video
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const video = await db.query.videos.findFirst({ where: eq(videos.id, id) });
    if (!video) return res.status(404).json({ message: 'Video not found' });

    // Delete file
    const filePath = path.join(process.cwd(), video.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.delete(videos).where(eq(videos.id, id));
    res.json({ message: 'Video deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting video' });
  }
});

export default router;
