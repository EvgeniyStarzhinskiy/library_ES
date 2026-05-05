import { useState, useEffect } from 'react';
import { Typography, Row, Col, Spin, Tabs, Card } from 'antd';
import {
  FolderOutlined,
  BuildOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import DocumentCard from '../components/DocumentCard';

const { Title, Paragraph } = Typography;

interface Document {
  id: number;
  title: string;
  author: string;
  year: number;
  description: string;
  avg_rating: number;
  rating_count: number;
  file_type: string;
  preview_cloud_path?: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  type: string;
  document_count: number;
}

const HomePage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRes = await apiClient.get('/documents?limit=12');
        setDocuments(docRes.data.data || []);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      {/* Баннер */}
      <div style={{
        background: 'linear-gradient(135deg, #E67E22 0%, #2C3E50 100%)',
        padding: '40px 24px',
        borderRadius: 12,
        marginBottom: 32,
        color: 'white'
      }}>
        <Title level={2} style={{ color: 'white', marginBottom: 8 }}>
          Библиотека технической документации
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
          Системы очистки буровых растворов: инструкции, спецификации, руководства
        </Paragraph>
      </div>

      {/* Навигационные плитки */}
      <Title level={4}><FolderOutlined /> Навигация</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            style={{ height: '100%' }}
            onClick={() => navigate('/browse?axis=type-first')}
          >
            <Title level={5}><BuildOutlined /> Типы оборудования</Title>
            <Paragraph type="secondary">
              Вибросита, центрифуги, гидроциклоны и другое оборудование
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            style={{ height: '100%' }}
            onClick={() => navigate('/browse?axis=manufacturer-first')}
          >
            <Title level={5}><AppstoreOutlined /> Производители</Title>
            <Paragraph type="secondary">
              Mi Swaco, Derrick, Brandt, Kem‑Tron и другие
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            style={{ height: '100%' }}
            onClick={() => navigate('/browse')}
          >
            <Title level={5}><FolderOutlined /> Все категории</Title>
            <Paragraph type="secondary">
              Полный обзор разделов библиотеки
            </Paragraph>
          </Card>
        </Col>
      </Row>

      {/* Последние поступления */}
      <Tabs defaultActiveKey="all" items={[
        {
          key: 'all',
          label: 'Последние поступления',
          children: (
            <Row gutter={[16, 16]}>
              {documents.map(doc => (
                <Col xs={24} sm={12} lg={8} key={doc.id}>
                  <DocumentCard {...doc} />
                </Col>
              ))}
            </Row>
          )
        }
      ]} />
    </div>
  );
};

export default HomePage;