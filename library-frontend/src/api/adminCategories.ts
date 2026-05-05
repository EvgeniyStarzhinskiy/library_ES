import client from './client';

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number;
}

export const getAllCategories = (): Promise<Category[]> =>
  client.get('/admin/categories').then(r => r.data.data);

export const createCategory = (data: Partial<Category>): Promise<Category> =>
  client.post('/admin/categories', data).then(r => r.data);

export const updateCategory = (id: number, data: Partial<Category>): Promise<Category> =>
  client.put(`/admin/categories/${id}`, data).then(r => r.data);

export const deleteCategory = (id: number): Promise<void> =>
  client.delete(`/admin/categories/${id}`);
