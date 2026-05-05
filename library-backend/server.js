require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const categoryRoutes = require('./routes/categories');  // ← добавить

const adminRoutes = require('./routes/admin');
const { initDB } = require('./db/init');
const interactionRoutes = require('./routes/interactions');
const app = express();
const PORT = process.env.PORT || 3002;

// Инициализация базы данных
initDB();

// Middleware
app.use(cors());
app.use(express.json());

// Маршруты
app.use('/library_ES/api/v1/auth', authRoutes);
app.use('/library_ES/api/v1/documents', documentRoutes);
app.use('/library_ES/api/v1/categories', categoryRoutes);  // ← добавить

app.use('/library_ES/api/v1/admin', adminRoutes);
app.use('/library_ES/api/v1', interactionRoutes);

app.listen(PORT, () => {
  console.log(`Library backend running on port ${PORT}`);
});