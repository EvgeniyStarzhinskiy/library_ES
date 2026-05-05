import { useState, useEffect } from 'react';
import { List, Button, message, Typography, Spin, Empty } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import apiClient from '../api/client';
import DocumentCard from '../components/DocumentCard';

const { Title } = Typography;

interface Doc {
  id: number;
  title: string;
  file_type: string;
  author: string;
  year: number;
  avg_rating: number;
  preview_cloud_path?: string;
}

const FavoritesPage: React.FC = () => {
  const [favorites, setFavorites] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    try {
      const res = await apiClient.get('/favorites');
      setFavorites(res.data.data || []);
    } catch (err) {
      message.error('Ошибка загрузки избранного');
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (docId: number) => {
    try {
      await apiClient.delete(`/favorites/${docId}`);
      message.success('Удалено из избранного');
      loadFavorites();
    } catch (err) {
      message.error('Ошибка');
    }
  };

  useEffect(() => { loadFavorites(); }, []);

  return (
    <div>
      <Title level={2}>Избранные документы</Title>
      <Spin spinning={loading}>
        {favorites.length === 0 && !loading ? (
          <Empty description="Вы ещё ничего не добавили в избранное" />
        ) : (
          <List
            dataSource={favorites}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    icon={<DeleteOutlined />}
                    danger
                    onClick={() => removeFavorite(item.id)}
                  />
                ]}
                style={{ padding: 0 }}
              >
                <div style={{ width: '100%' }}>
                  <DocumentCard {...item} onClick={() => window.location.href = `/library_ES/documents/${item.id}`} />
                </div>
              </List.Item>
            )}
          />
        )}
      </Spin>
    </div>
  );
};

export default FavoritesPage;