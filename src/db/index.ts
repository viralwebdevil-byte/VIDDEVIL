import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.ts';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

// For Vercel/Serverless: Use /tmp for the database as the rest of the filesystem is read-only
const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
const dbPath = isServerless ? path.join('/tmp', 'sqlite.db') : path.join(process.cwd(), 'sqlite.db');

let sqlite: any;
try {
  sqlite = new Database(dbPath);
  console.log(`Database initialized at: ${dbPath}`);
} catch (error) {
  console.error('Failed to initialize database:', error);
  // Fallback to in-memory if file fails (useful for some environments, though data won't persist)
  sqlite = new Database(':memory:');
  console.log('Falling back to in-memory database');
}

export const db = drizzle(sqlite, { schema });

// Initialize database (simple way for this environment)
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      duration INTEGER,
      view_count INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS video_categories (
      video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (video_id, category_id)
    );
    CREATE TABLE IF NOT EXISTS video_tags (
      video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (video_id, tag_id)
    );
  `);

  // Seed admin if not exists
  const adminExists = sqlite.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin', 10);
    sqlite.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
    console.log('Admin user seeded: admin / admin');
  }
}
