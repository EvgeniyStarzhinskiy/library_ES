import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Typography, Card, Row, Col, Spin, Breadcrumb, Empty, Tag } from 'antd';
import { HomeOutlined, FolderOutlined } from '@ant-design/icons';
import apiClient from '../api/client';
import DocumentCard from '../components/DocumentCard';

const { Title, Paragraph } = Typography;

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  description?: string;
  background_image?: string;
  document_count: number;
  children: any[];
  documents: any[];
}

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<CategoryNode | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const res = await apiClient.get(`/categories/${slug}`);
        setCategory(res.data);
      } catch (err) {
        console.error('Ошибка загрузки категории:', err);
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchCategory();
  }, [slug]);

  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  if (!category) return <div>Категория не найдена</div>;

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }} items={[
        { title: <Link to="/"><HomeOutlined /> Главная</Link> },
        { title: category.name }
      ]} />

      <div style={{
        background: category.background_image
          ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${category.background_image}) center/cover no-repeat`
          : 'linear-gradient(135deg, #2C3E50 0%, #E67E22 100%)',
        padding: '40px 24px', borderRadius: 12, marginBottom: 24, minHeight: 150,
        display: 'flex', alignItems: 'center'
      }}>
        <Title level={2} style={{ color: 'white', margin: 0 }}>{category.name}</Title>
      </div>

      {category.description && (
        <Paragraph style={{ fontSize: 16, marginBottom: 24 }}>{category.description}</Paragraph>
      )}

      {/* Подкатегории (прямые потомки) */}
      {category.children && category.children.length > 0 && (
        <>
          <Title level={4}><FolderOutlined /> Подразделы</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {category.children.map((child: any) => (
              <Col xs={24} sm={12} md={8} key={child.id}>
                <Card hoverable onClick={() => navigate(`/category/${child.slug}`)}>
                  <Title level={5}>{child.name}</Title>
                  {child.document_count > 0 && <Tag color="blue">{child.document_count} документов</Tag>}
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      {/* Документы */}
      {category.documents && category.documents.length > 0 && (
        <>
          <Title level={4}>Документы</Title>
          <Row gutter={[16, 16]}>
            {category.documents.map((doc: any) => (
              <Col xs={24} sm={12} lg={8} key={doc.id}>
                <DocumentCard {...doc} />
              </Col>
            ))}
          </Row>
        </>
      )}

      {(!category.children || category.children.length === 0) && (!category.documents || category.documents.length === 0) && (
        <Empty description="В этой категории пока нет документов" />
      )}
    </div>
  );
};

export default CategoryPage;