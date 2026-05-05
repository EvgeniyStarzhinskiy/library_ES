import client from './client';

export interface SearchItem {
  id: number;
  title?: string;
  name: string;
  type: 'title' | 'author' | 'tag';
  slug?: string;
}

export const searchDocs = async (query: string) => {
  const response = await client.get('/search', { params: { q: query } });
  return response.data;
};
