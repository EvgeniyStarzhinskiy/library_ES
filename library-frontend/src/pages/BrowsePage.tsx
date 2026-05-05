import { useState, useEffect } from 'react';
import { Typography, Row, Col, Spin, Breadcrumb, Radio, Card, Empty, Tag } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { HomeOutlined, FolderOutlined } from '@ant-design/icons';
import apiClient from '../api/client';

const { Title } = Typography;

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  background_image?: string;
  description?: string;
  document_count: number;
  children?: CategoryNode[];
}

const BrowsePage: React.FC = () => {
  const [axis, setAxis] = useState<'type-first' | 'manufacturer-first'>('type-first');
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTree = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/categories/tree/${axis}`);
        setTree(res.data.tree || []);
      } catch (err) {
        console.error('Ошибка загрузки дерева:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, [axis]);

  const renderModels = (models: CategoryNode[]) => {
    if (!models || models.length === 0) return null;
    return (
      <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
        {models.map(model => (
          <Col key={model.id}>
            <Tag
              color="blue"
              style={{ cursor: 'pointer', fontSize: 13 }}
              onClick={() => navigate(`/category/${model.slug}`)}
            >
              {model.name} ({model.document_count})
            </Tag>
          </Col>
        ))}
      </Row>
    );
  };

  const renderCategoryCard = (cat: CategoryNode, depth: number = 0) => {
    const bgColor = depth === 0
      ? 'linear-gradient(135deg, #2C3E50 0%, #E67E22 100%)'
      : undefined;
    const borderColor = depth === 1 ? 'rgba(255,255,255,0.2)' : undefined;

    return (
      <Card
        key={cat.id}
        style={{
          background: bgColor || (cat.background_image
            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${cat.background_image}) center/cover no-repeat`
            : undefined),
          borderRadius: 8,
          marginBottom: 8,
          border: borderColor ? `1px solid ${borderColor}` : undefined,
          color: depth === 0 ? 'white' : undefined
        }}
        bodyStyle={{ padding: 12 }}
        onClick={() => navigate(`/category/${cat.slug}`)}
        hoverable
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, color: depth === 0 ? 'white' : 'inherit' }}>
            {depth === 0 && <FolderOutlined style={{ marginRight: 8 }} />}
            {cat.name}
          </span>
          <Tag color="blue">{cat.document_count} док.</Tag>
        </div>
        {cat.children && cat.children.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {cat.children.map(child => (
              <div key={child.id} style={{ marginBottom: 4 }}>
                {renderCategoryCard(child, depth + 1)}
                {child.children && child.children.length > 0 && (
                  <div style={{ marginLeft: 16 }}>
                    {renderModels(child.children)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }} items={[
        { title: <Link to="/"><HomeOutlined /> Главная</Link> },
        { title: 'Категории' }
      ]} />

      <Title level={2}>Обзор категорий</Title>

      <Radio.Group
        value={axis}
        onChange={(e) => setAxis(e.target.value)}
        style={{ marginBottom: 24 }}
        optionType="button"
        buttonStyle="solid"
      >
        <Radio.Button value="type-first">Тип → Производитель → Модель</Radio.Button>
        <Radio.Button value="manufacturer-first">Производитель → Тип → Модель</Radio.Button>
      </Radio.Group>

      <Spin spinning={loading}>
        {tree.length === 0 && !loading ? (
          <Empty description="Нет данных для отображения" />
        ) : (
          tree.map(root => renderCategoryCard(root, 0))
        )}
      </Spin>
    </div>
  );
};

export default BrowsePage;