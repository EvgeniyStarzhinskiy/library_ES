const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
  try {
    const { email, password, display_name } = req.body;
    const db = getDB();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: true, message: 'Email уже занят' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)').run(email, password_hash, display_name);

    res.json({ message: 'Регистрация успешна. Проверьте почту для подтверждения.' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Ошибка сервера' });
  }
});

// Логин
router.post('/login', (req, res) => {
  try {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Request body:', req.body);
    
    const { email, password } = req.body;
    const db = getDB();

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    console.log('User found:', user ? 'yes' : 'no');
    
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: true, message: 'Неверный email или пароль' });
    }

    console.log('Password hash exists:', !!user.password_hash);
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    console.log('Password valid:', validPassword);
    
    if (!validPassword) {
      console.log('Invalid password');
      return res.status(401).json({ error: true, message: 'Неверный email или пароль' });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Login successful');
    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        oauth_provider: user.oauth_provider,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error('=== LOGIN ERROR ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: true, message: 'Ошибка сервера: ' + err.message });
  }
});

// Обновление токена
router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(401).json({ error: true, message: 'Refresh token не предоставлен' });
  }

  jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: true, message: 'Refresh token истек' });
    }

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: true, message: 'Пользователь не найден' });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ access_token: accessToken });
  });
});

// Профиль
router.get('/me', authenticateToken, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, email, display_name, role, oauth_provider, avatar_url, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});
// Обновление профиля
router.patch('/me', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const { display_name, avatar_url } = req.body;
    const userId = req.user.id;

    db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?')
      .run(display_name, avatar_url, userId);

    const updated = db.prepare('SELECT id, email, display_name, role, oauth_provider, avatar_url, created_at FROM users WHERE id = ?').get(userId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;