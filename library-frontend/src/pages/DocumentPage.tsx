import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Typography, Breadcrumb, Spin, Card, Space, Tag, Divider, Button } from 'antd';
import { FilePdfOutlined, FileWordOutlined, FileExcelOutlined, FilePptOutlined, FileUnknownOutlined } from '@ant-design/icons';
import { getDocument, downloadDocument } from '../api/documents';

const { Title, Text } = Typography;

const getIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case '.pdf': return <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />;
    case '.doc':
    case '.docx': return <FileWordOutlined style={{ fontSize: 48, color: '#1890ff' }} />;
    case '.xls':
    case '.xlsx': return <FileExcelOutlined style={{ fontSize: 48, color: '#52c41a' }} />;
    case '.ppt':
    case '.pptx': return <FilePptOutlined style={{ fontSize: 48, color: '#fa8c16' }} />;
    default: return <FileUnknownOutlined style={{ fontSize: 48 }} />;
  }
};

const DocumentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await getDocument(id);
        setDoc(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDownload = async () => {
    try {
      const res = await downloadDocument(doc.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error', err);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  if (!doc) return <div>Документ не найден</div>;

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb>
        <Breadcrumb.Item><Link to="/">Главная</Link></Breadcrumb.Item>
        {doc.categories?.map((c: any) => (
          <Breadcrumb.Item key={c.id}><Link to={`/category/${c.slug}`}>{c.name}</Link></Breadcrumb.Item>
        ))}
        <Breadcrumb.Item>{doc.name}</Breadcrumb.Item>
      </Breadcrumb>
      <Card style={{ marginTop: 24 }}>
        <Space align="start" size={24}>
          {getIcon(doc.type)}
          <div>
            <Title level={3}>{doc.name}</Title>
            <Space wrap>
              {doc.tags?.map((t: any) => <Tag key={t.id}>{t.name}</Tag>)}
            </Space>
            <Divider />
            <Text>Размер: {(doc.size / 1024 / 1024).toFixed(2)} МБ</Text>
            <br />
            <Text>Тип: {doc.type}</Text>
            <br />
            <Text>Загружен: {new Date(doc.created_at).toLocaleDateString()}</Text>
            <Divider />
            <Button type="primary" icon={<FilePdfOutlined />} onClick={handleDownload}>Скачать</Button>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default DocumentPage;
