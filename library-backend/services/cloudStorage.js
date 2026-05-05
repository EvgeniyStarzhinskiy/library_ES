// services/cloudStorage.js

const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function uploadToCloud(fileBuffer, originalName) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(originalName);
    const filePath = path.join(UPLOADS_DIR, uniqueName);
    await fs.promises.writeFile(filePath, fileBuffer);
    return `/uploads/${uniqueName}`;
}

async function downloadFromCloud(fileId) {
    const filePath = path.join(UPLOADS_DIR, fileId);
    return await fs.promises.readFile(filePath);
}

module.exports = { uploadToCloud, downloadFromCloud };