require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const YANDEX_REST_API = 'https://cloud-api.yandex.net/v1/disk';
const TOKEN = process.env.YANDEX_DISK_TOKEN;

const client = axios.create({
  baseURL: YANDEX_REST_API,
  headers: {
    'Authorization': `OAuth ${TOKEN}`,
    'Accept': 'application/json'
  }
});

const BASE_PATH = '/Library';

// Загрузить файл в облако
async function uploadToCloud(localFilePath, remoteFolder, remoteFileName) {
  try {
    const remotePath = `${BASE_PATH}/${remoteFolder}/${remoteFileName}`;
    
    const uploadUrlRes = await client.get('/resources/upload', {
      params: { path: remotePath, overwrite: true }
    });
    
    const uploadUrl = uploadUrlRes.data.href;
    const fileBuffer = fs.readFileSync(localFilePath);
    await axios.put(uploadUrl, fileBuffer);
    
    console.log(`Файл загружен: ${remotePath}`);
    return remotePath;
  } catch (err) {
    console.error('Ошибка загрузки:', err.response?.data || err.message);
    throw err;
  }
}

// Скачать файл из облака
async function downloadFromCloud(remoteFolder, remoteFileName, writeStream) {
  try {
    const remotePath = `${BASE_PATH}/${remoteFolder}/${remoteFileName}`;
    
    const downloadUrlRes = await client.get('/resources/download', {
      params: { path: remotePath }
    });
    
    const downloadUrl = downloadUrlRes.data.href;
    const response = await axios.get(downloadUrl, { responseType: 'stream' });
    
    response.data.pipe(writeStream);
    
    return new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  } catch (err) {
    console.error('Ошибка скачивания:', err.response?.data || err.message);
    throw err;
  }
}

// Получить список файлов в папке
async function listCloudFolder(folderPath) {
  try {
    const remotePath = `${BASE_PATH}/${folderPath}`;
    const response = await client.get('/resources', {
      params: { path: remotePath, limit: 100 }
    });
    
    return response.data._embedded?.items || [];
  } catch (err) {
    console.error('Ошибка чтения папки:', err.response?.data || err.message);
    return [];
  }
}

// Создать папку на Диске
async function createFolder(folderPath) {
  const remotePath = `${BASE_PATH}/${folderPath}`;
  try {
    await client.put('/resources', null, {
      params: { path: remotePath }
    });
    console.log(`Папка создана: ${remotePath}`);
  } catch (err) {
    if (err.response?.status === 409) {
      console.log(`Папка уже существует: ${remotePath}`);
    } else {
      console.error('Ошибка создания папки:', err.response?.data || err.message);
    }
  }
}

module.exports = {
  uploadToCloud,
  downloadFromCloud,
  listCloudFolder,
  createFolder
};