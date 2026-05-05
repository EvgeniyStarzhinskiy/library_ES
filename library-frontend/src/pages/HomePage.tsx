import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Typography, Row, Col, Card, Spin } from 'antd';
import { getTree } from '../api/categories';
import { getRecentDocuments } from '../api/documents';

const { Title } = Typography;

const HomePage: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, docRes] = await Promise.all([getTree('types'), getRecentDocuments()]);
        setCategories(catRes.data || []);
        setRecentDocs(docRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Категории оборудования</Title>
      <Row gutter={[16, 16]}>
        {categories.map((cat: any) => (
          <Col key={cat.id} xs={24} sm={12} md={8}>
            <Card title={cat.name} extra={<Link to={`/category/${cat.slug}`}>Все документы</Link>}>
              {cat.children?.map((child: any) => (
                <div key={child.id}>
                  <Link to={`/category/${child.slug}`}>{child.name}</Link>
                  <span style={{ marginLeft: 8, color: '#888' }}>({child.document_count || 0})</span>
                </div>
              ))}
            </Card>
          </Col>
        ))}
      </Row>
      <Title level={2} style={{ marginTop: 32 }}>Последние документы</Title>
      <Row gutter={[16, 16]}>
        {recentDocs.map((doc: any) => (
          <Col key={doc.id} xs={24} sm={12} md={8}>
            <Card title={<Link to={`/documents/${doc.id}`}>{doc.name}</Link>} size="small">
              <span style={{ color: '#888' }}>{new Date(doc.created_at).toLocaleDateString()}</span>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default HomePage;
