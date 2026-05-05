import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://jhonstar.ru/library_ES/api/v1';

const client = axios.create({
  baseURL: API_BASE,
});

client.interceptors.request.use(config => {
  const token = localStorage.getItem('library_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const setTokens = (token: string) => {
  localStorage.setItem('library_token', token);
};

export const clearTokens = () => {
  localStorage.removeItem('library_token');
};

export default client;