import client from './client';

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  children?: CategoryNode[];
  document_count?: number;
}

export const getTree = (axis: string) => {
  return client.get(`/categories/tree/${axis}`).then(res => res.data);
};

export const getAllCategories = () => {
  return client.get('/categories').then(res => res.data);
};
