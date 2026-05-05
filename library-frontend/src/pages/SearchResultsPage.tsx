import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Typography, List, Spin, Empty, Breadcrumb, Row, Col, Tag } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import apiClient from '../api/client';
import DocumentCard from '../components/DocumentCard';

const { Title, Text } = Typography;

interface Document {
  id: number;
  title: string;
  author: string;
  year: number;
  description: string;
  file_type: string;
  avg_rating: number;
  preview_cloud_path?: string;
}

const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const author = searchParams.get('author') || '';
  const tag = searchParams.get('tag') || '';
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Собираем параметры для запроса
    const params: any = { limit: 50 };
    if (query) params.q = query;
    if (author) params.author = author;
    if (tag) params.tag = tag;

    setLoading(true);
    apiClient.get('/documents/search', { params })
      .then(res => {
        setResults(res.data.data || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query, author, tag]); // перезапуск при изменении любого параметра

  const searchDescription = query 
    ? `«${query}»` 
    : (author ? `автор: ${author}` : `тег: #${tag}`);

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }} items={[
        { title: <Link to="/"><HomeOutlined /> Главная</Link> },
        { title: `Поиск` }
      ]} />
      
      <Title level={3}>Результаты поиска: {searchDescription}</Title>
      <Text type="secondary">Найдено: {total} документов</Text>

      <Spin spinning={loading}>
        {results.length === 0 && !loading ? (
          <Empty description="Ничего не найдено" style={{ marginTop: 48 }} />
        ) : (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {results.map(item => (
              <Col xs={24} sm={12} lg={8} key={item.id}>
                <DocumentCard {...item} />
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  );
};

export default SearchResultsPage;