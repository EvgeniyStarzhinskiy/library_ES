import React, { useMemo } from 'react';
import { Tree, Button, Space } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Category } from '../../api/adminCategories';

interface Props {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreateSub: (parentId: number) => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: number) => void;
}

export const CategoryTree: React.FC<Props> = ({
  categories, selectedId, onSelect, onCreateSub, onEdit, onDelete
}) => {
  const buildTree = (parentId: number | null): DataNode[] =>
    categories
      .filter(c => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({
        key: c.id,
        title: (
          <Space>
            <span>{c.name}</span>
            <Button size="small" onClick={() => onCreateSub(c.id)}>+</Button>
            <Button size="small" onClick={() => onEdit(c)}>✏️</Button>
            <Button size="small" danger onClick={() => onDelete(c.id)}>🗑</Button>
          </Space>
        ),
        children: buildTree(c.id)
      }));

  const treeData = useMemo(() => buildTree(null), [categories]);

  return (
    <Tree
      treeData={treeData}
      selectedKeys={selectedId ? [selectedId] : []}
      onSelect={keys => keys[0] && onSelect(Number(keys[0]))}
      defaultExpandAll
    />
  );
};
