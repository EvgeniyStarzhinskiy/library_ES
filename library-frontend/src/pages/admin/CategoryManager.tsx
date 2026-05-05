import { useState, useEffect } from 'react';
import { Card, Tree, Button, Modal, Form, Input, Select, Upload, Space, Breadcrumb, Popconfirm, message, Typography, Table, Tabs, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined, FolderOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

const { Title } = Typography;
const { Option } = Select;

interface Category {
  id: number;
  name: string;
  slug: string;
  type: string;
  parent_id?: number;
  background_image?: string;
  description?: string;
  sort_order: number;
  document_count: number;
}

interface Path {
  ancestor_id: number;
  descendant_id: number;
  depth: number;
  ancestor_name: string;
  descendant_name: string;
}

const CategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [treeData, setTreeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [form] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // Загрузка категорий и связей
  const loadData = async () => {
    setLoading(true);
    try {
      const [catRes, pathRes] = await Promise.all([
        apiClient.get('/admin/categories'),
        apiClient.get('/admin/category-paths')
      ]);
      const cats = catRes.data.data || [];
      const pathsData = pathRes.data.data || [];
      setCategories(cats);
      setPaths(pathsData);
      buildTree(cats, pathsData);
    } catch (err) {
      message.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // Построение дерева для Tree-компонента Ant Design
  const buildTree = (cats: Category[], paths: Path[]) => {
    // Корневые узлы: те, у которых type='root' (или можно определить как узлы, у которых нет входящих связей с depth>0)
    // Используем type='root' как маркер корневых разделов
    const roots = cats.filter(c => c.type === 'root');
    
    const makeNode = (cat: Category): any => {
      // Находим прямых потомков (depth=1) среди paths
      const childrenPaths = paths.filter(p => p.ancestor_id === cat.id && p.depth === 1);
      const children = childrenPaths.map(p => cats.find(c => c.id === p.descendant_id)).filter(Boolean) as Category[];
      
      return {
        title: (
          <Space size="small">
            <span>{cat.name}</span>
            {cat.document_count > 0 && <Tag color="blue">{cat.document_count} док.</Tag>}
            <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEditForm(cat); }} />
            <Popconfirm title="Удалить категорию и все связи?" onConfirm={() => deleteCategory(cat.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
            </Popconfirm>
          </Space>
        ),
        key: cat.id,
        children: children.length > 0 ? children.map(makeNode) : [],
        isLeaf: children.length === 0
      };
    };

    setTreeData(roots.map(makeNode));
  };

  const openEditForm = (cat?: Category) => {
    if (cat) {
      setIsNew(false);
      setEditingCategory(cat);
      form.setFieldsValue({
        ...cat,
        parent_id: undefined // сбрасываем, т.к. parent_id не хранится явно
      });
    } else {
      setIsNew(true);
      setEditingCategory(null);
      form.resetFields();
    }
    setEditModalOpen(true);
  };

  const deleteCategory = async (id: number) => {
    try {
      await apiClient.delete(`/admin/categories/${id}`);
      message.success('Категория удалена');
      loadData();
    } catch (err) {
      message.error('Ошибка удаления');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (isNew) {
        await apiClient.post('/admin/categories', values);
      } else {
        await apiClient.patch(`/admin/categories/${editingCategory?.id}`, values);
      }
      message.success(isNew ? 'Категория создана' : 'Категория обновлена');
      setEditModalOpen(false);
      loadData();
    } catch (err) {
      message.error('Ошибка сохранения');
    }
  };

  // Управление связями
  const deletePath = async (ancestorId: number, descendantId: number) => {
    try {
      await apiClient.delete(`/admin/category-paths/${ancestorId}/${descendantId}`);
      message.success('Связь удалена');
      loadData();
    } catch (err) {
      message.error('Ошибка удаления связи');
    }
  };

  const handleAddLink = async (values: { ancestor_id: number; descendant_id: number }) => {
    try {
      await apiClient.post('/admin/category-paths', values);
      message.success('Связь добавлена');
      setLinkModalOpen(false);
      linkForm.resetFields();
      loadData();
    } catch (err) {
      message.error('Ошибка добавления связи');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    { title: 'Предок', dataIndex: 'ancestor_name', key: 'ancestor' },
    { title: 'Потомок', dataIndex: 'descendant_name', key: 'descendant' },
    { title: 'Глубина', dataIndex: 'depth', key: 'depth' },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: Path) => (
        <Popconfirm title="Удалить связь?" onConfirm={() => deletePath(record.ancestor_id, record.descendant_id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  const tabItems = [
    {
      key: 'tree',
      label: 'Дерево категорий',
      children: (
        <Card>
          {treeData.length > 0 ? (
            <Tree
              treeData={treeData}
              showIcon
              icon={<FolderOutlined />}
              blockNode
              defaultExpandAll
            />
          ) : (
            <p>Нет корневых категорий. Создайте первую категорию с типом "root".</p>
          )}
        </Card>
      )
    },
    {
      key: 'links',
      label: 'Связи категорий',
      children: (
        <>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<LinkOutlined />} onClick={() => setLinkModalOpen(true)}>
              Добавить связь
            </Button>
          </Space>
          <Table dataSource={paths} columns={columns} rowKey={(r) => `${r.ancestor_id}-${r.descendant_id}`} size="small" />
        </>
      )
    }
  ];

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }} items={[
        { title: <Link to="/admin"><HomeOutlined /> Админка</Link> },
        { title: 'Управление категориями' }
      ]} />
      
      <Space style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Категории</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditForm()}>
          Добавить категорию
        </Button>
        <Button onClick={loadData}>Обновить</Button>
      </Space>

      <Tabs items={tabItems} />

      {/* Модальное окно создания/редактирования категории */}
      <Modal
        title={isNew ? 'Новая категория' : 'Редактировать категорию'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug (URL-идентификатор)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
            <Select>
              <Option value="root">Корневой раздел</Option>
              <Option value="manufacturer">Производитель</Option>
              <Option value="equipment-type">Тип оборудования</Option>
              <Option value="model">Модель</Option>
              <Option value="folder">Папка</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="background_image" label="URL фонового изображения">
            <Input placeholder="https://example.com/bg.jpg" />
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок сортировки">
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно добавления связи */}
      <Modal
        title="Добавить связь"
        open={linkModalOpen}
        onCancel={() => setLinkModalOpen(false)}
        onOk={() => linkForm.submit()}
      >
        <Form form={linkForm} layout="vertical" onFinish={handleAddLink}>
          <Form.Item name="ancestor_id" label="Родительская категория" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Выберите категорию">
              {categories.map(c => (
                <Option key={c.id} value={c.id}>{c.name} ({c.type})</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="descendant_id" label="Дочерняя категория" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Выберите категорию">
              {categories.map(c => (
                <Option key={c.id} value={c.id}>{c.name} ({c.type})</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryManager;