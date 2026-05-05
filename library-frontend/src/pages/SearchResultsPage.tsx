import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Typography, Spin, Empty, Breadcrumb, Row, Col } from 'antd';
import { searchDocs } from '../api/search';

const { Title } = Typography;

const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) return;
    (async () => {
      try {
        const res = await searchDocs(query);
        setResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [query]);

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb>
        <Breadcrumb.Item><Link to="/">Главная</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Поиск</Breadcrumb.Item>
      </Breadcrumb>
      <Title level={3} style={{ marginTop: 16 }}>Результаты поиска: {query}</Title>
      {loading ? (
        <Spin size="large" />
      ) : results.length === 0 ? (
        <Empty description="Ничего не найдено" />
      ) : (
        <Row gutter={[16, 16]}>
          {results.map(doc => (
            <Col key={doc.id} xs={24} sm={12} md={8}>
              {/* карточка документа */}
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default SearchResultsPage;
