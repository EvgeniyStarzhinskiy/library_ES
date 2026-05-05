import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Spin, Descriptions, Tag, Space, Rate, Button, Breadcrumb, Modal, message } from 'antd';
import { DownloadOutlined, HeartOutlined, HeartFilled, HomeOutlined, EyeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import CommentSection from '../components/CommentSection';

const { Title, Paragraph } = Typography;

interface DocData {
  id: number;
  title: string;
  author: string;
  year: number;
  theme: string;
  publisher: string;
  pages: number;
  description: string;
  file_type: string;
  avg_rating: number;
  cloud_path: string;
  tags: { id: number; name: string }[];
  categories: { id: number; name: string; slug: string }[];
}

const DocumentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const viewUrl = `/library_ES/api/v1/documents/${id}/view`;

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const docRes = await apiClient.get(`/documents/${id}`);
        setDoc(docRes.data);

        if (user) {
          const [favRes, ratingRes] = await Promise.all([
            apiClient.get(`/favorites/${id}/status`),
            apiClient.get(`/ratings/${id}/my`)
          ]);
          setIsFavorite(favRes.data.isFavorite);
          setUserRating(ratingRes.data.stars || 0);
        }
      } catch (err) {
        console.error('Ошибка загрузки:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, user]);

  const handleFavorite = async () => {
    if (!user) return;
    try {
      if (isFavorite) {
        await apiClient.delete(`/favorites/${id}`);
        setIsFavorite(false);
        message.success('Удалено из избранного');
      } else {
        await apiClient.post(`/favorites/${id}`);
        setIsFavorite(true);
        message.success('Добавлено в избранное');
      }
    } catch (err) {
      message.error('Ошибка');
    }
  };

  const handleRating = async (stars: number) => {
    if (!user) return;
    try {
      const res = await apiClient.post(`/ratings/${id}`, { stars });
      setUserRating(stars);
      if (res.data.avg_rating && doc) {
        setDoc({ ...doc, avg_rating: res.data.avg_rating });
      }
      message.success('Оценка сохранена');
    } catch (err) {
      message.error('Ошибка');
    }
  };

  const handleDownload = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('access_token');
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `/library_ES/api/v1/documents/${id}/download`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.responseType = 'blob';

      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response;
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;

          const fileType = doc?.file_type;
          const cloudExt = doc?.cloud_path?.split('.').pop()?.toLowerCase();
          const ext = fileType || cloudExt || 'pdf';
          a.download = `${doc?.title || 'document'}.${ext}`;

          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
        } else {
          try {
            const reader = new FileReader();
            reader.onload = () => {
              const err = JSON.parse(reader.result as string);
              message.error(err.message || 'Ошибка скачивания');
            };
            reader.readAsText(blob);
          } catch {
            message.error('Ошибка скачивания');
          }
        }
      };

      xhr.onerror = () => message.error('Ошибка сети при скачивании');
      xhr.send();
    } catch (err) {
      message.error('Ошибка скачивания');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  if (!doc) return <div>Документ не найден</div>;

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /> Главная</Link> },
          { title: doc.title }
        ]}
      />

      <Title level={2}>{doc.title}</Title>
      
      <Space style={{ marginBottom: 16 }}>
        {doc.tags?.map(tag => (
          <Tag key={tag.id} color="orange">{tag.name}</Tag>
        ))}
      </Space>

      <div style={{ marginBottom: 16 }}>
        <Rate value={userRating} onChange={handleRating} />
        <span style={{ marginLeft: 8, color: '#888' }}>
          {doc.avg_rating ? `${doc.avg_rating.toFixed(1)} / 5` : 'Нет оценок'}
        </span>
      </div>

      <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Автор">{doc.author}</Descriptions.Item>
        <Descriptions.Item label="Год">{doc.year}</Descriptions.Item>
        <Descriptions.Item label="Издательство">{doc.publisher}</Descriptions.Item>
        <Descriptions.Item label="Страниц">{doc.pages}</Descriptions.Item>
        <Descriptions.Item label="Тематика">{doc.theme}</Descriptions.Item>
        <Descriptions.Item label="Формат">{doc.file_type?.toUpperCase()}</Descriptions.Item>
      </Descriptions>

      <Paragraph style={{ fontSize: 16, marginBottom: 24 }}>{doc.description}</Paragraph>

      <Space style={{ marginBottom: 24 }}>
        <Button icon={<EyeOutlined />} type="primary" onClick={() => setViewerOpen(true)}>
          Просмотр
        </Button>
        {user && (
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>
            Скачать
          </Button>
        )}
        {user && (
          <Button
            icon={isFavorite ? <HeartFilled style={{ color: 'red' }} /> : <HeartOutlined />}
            onClick={handleFavorite}
          >
            {isFavorite ? 'В избранном' : 'В избранное'}
          </Button>
        )}
      </Space>

      <Modal
        title={doc.title}
        open={viewerOpen}
        onCancel={() => setViewerOpen(false)}
        width={isMobile ? '100%' : '90%'}
        style={{ top: isMobile ? 0 : 20 }}
        footer={null}
        destroyOnHidden
      >
        <iframe
          src={viewUrl}
          style={{ width: '100%', height: '80vh', border: 'none' }}
          title="PDF Viewer"
        />
      </Modal>

      <CommentSection documentId={id!} />
    </div>
  );
};

export default DocumentPage;