import client from './client';

export const getDocument = (id: string) => client.get(`/documents/${id}`);
export const downloadDocument = (id: number) => client.get(`/documents/${id}/download`, { responseType: 'blob' });
export const getRecentDocuments = () => client.get('/documents?recent=10');
