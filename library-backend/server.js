require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const categoryRoutes = require('./routes/categories');
const adminRoutes = require('./routes/admin');
const adminCategoriesRoutes = require('./routes/admin/categories');
const { initDB } = require('./db/init');
const interactionRoutes = require('./routes/interactions');
const app = express();
const PORT = process.env.PORT || 3002;

initDB();

app.use(cors());
app.use(express.json());

app.use('/library_ES/api/v1/auth', authRoutes);
app.use('/library_ES/api/v1/documents', documentRoutes);
app.use('/library_ES/api/v1/categories', categoryRoutes);
app.use('/library_ES/api/v1/admin', adminRoutes);
app.use('/library_ES/api/v1/admin/categories', adminCategoriesRoutes);
app.use('/library_ES/api/v1', interactionRoutes);

app.listen(PORT, () => {
  console.log(`Library backend running on port ${PORT}`);
});