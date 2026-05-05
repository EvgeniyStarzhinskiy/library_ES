import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Statistic, Table, Tag, Button, Space, Spin, Alert } from 'antd';
import { FileOutlined, UserOutlined, FolderOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

const { Title } = Typography;

interface Stats {
  documents: number;
  users: number;
  categories: number;
  recentDocuments: any[];
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, docsRes] = await Promise.all([
        apiClient.get('/admin/stats'),
        apiClient.get('/admin/documents?limit=10')
      ]);
      setStats(statsRes.data);
      setDocuments(docsRes.data.data || []);
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError('Не удалось загрузить данные админки. Проверьте права доступа.');
    } finally {
      setLoading(false);
    }
  };

  const docColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Название', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Формат', dataIndex: 'file_type', key: 'file_type', render: (t: string) => <Tag>{t?.toUpperCase()}</Tag>, width: 80 },
    { title: 'Размер', dataIndex: 'file_size', key: 'file_size', render: (s: number) => s ? `${(s / 1024).toFixed(1)} KB` : '-', width: 100 },
    { title: 'Дата', dataIndex: 'created_at', key: 'created_at', render: (d: string) => d ? new Date(d).toLocaleDateString('ru') : '-', width: 110 },
    { 
      title: 'Действия', key: 'actions', width: 100,
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => navigate(`/documents/${record.id}`)}>Просмотр</Button>
      )
    }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  if (error) return <Alert message="Ошибка" description={error} type="error" showIcon />;

  return (
    <div>
      <Title level={2}>Панель администратора</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Документов" value={stats?.documents || 0} prefix={<FileOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Пользователей" value={stats?.users || 0} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Категорий" value={stats?.categories || 0} prefix={<FolderOutlined />} /></Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/admin/documents/upload')}>
          Загрузить документ
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => navigate('/admin/categories')}>
          Управление категориями
        </Button>
      </Space>

      <Card title="Последние документы">
        <Table
          dataSource={documents}
          columns={docColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default AdminDashboard;