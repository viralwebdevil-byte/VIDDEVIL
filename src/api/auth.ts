import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      console.log(`Login failed: User ${username} not found`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      console.log(`Login failed: Incorrect password for ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ user: { id: user.id, username: user.username, role: user.role }, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

export default router;
