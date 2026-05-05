import React, { useState, useEffect } from 'react';
import { CategoryTree } from '../../components/admin/CategoryTree';
import { CategoryEditModal } from '../../components/admin/CategoryEditModal';
import type { Category } from '../../api/adminCategories';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '../../api/adminCategories';

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const loadCategories = async () => {
    const data = await getAllCategories();
    setCategories(data);
  };

  useEffect(() => { loadCategories(); }, []);

  const handleCreate = (parentId: number | null = null) => {
    setEditingCategory(null);
    setModalOpen(true);
    setSelectedId(parentId);
  };

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить категорию и все вложенные?')) return;
    await deleteCategory(id);
    loadCategories();
  };

  const handleSubmit = async (name: string, parentId: number | null) => {
    if (editingCategory) {
      await updateCategory(editingCategory.id, { name, parent_id: parentId });
    } else {
      await createCategory({ name, parent_id: parentId || null });
    }
    setModalOpen(false);
    loadCategories();
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Управление категориями</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, marginTop: 24 }}>
        <div>
          <button onClick={() => handleCreate(null)}>➕ Создать корневую</button>
          <CategoryTree
            categories={categories}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreateSub={handleCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
        <div>
          {selectedId ? (
            <p>Выбрана категория: {categories.find(c => c.id === selectedId)?.name}</p>
          ) : (
            <p>Выберите категорию в дереве</p>
          )}
        </div>
      </div>
      <CategoryEditModal
        open={modalOpen}
        category={editingCategory}
        parentId={selectedId}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
