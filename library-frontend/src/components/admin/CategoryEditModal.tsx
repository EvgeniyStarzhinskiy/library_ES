import React, { useState, useEffect } from 'react';
import { Modal, Input } from 'antd';

interface Props {
  open: boolean;
  category: { id?: number; name?: string; parent_id?: number | null } | null;
  parentId: number | null;
  onClose: () => void;
  onSubmit: (name: string, parentId: number | null) => void;
}

export const CategoryEditModal: React.FC<Props> = ({ open, category, parentId, onClose, onSubmit }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(category?.name || '');
  }, [category]);

  const handleOk = () => {
    if (!name.trim()) return;
    onSubmit(name, parentId);
  };

  return (
    <Modal
      title={category ? 'Редактировать категорию' : 'Создать категорию'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
    >
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Название категории" />
    </Modal>
  );
};
