import { useState, useEffect, useCallback } from 'react';
import { List, Form, Input, Button, Avatar, message, Spin, Typography, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface CommentType {
  id: number;
  content: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  parent_id: number | null;
  replies_count: number;
}

interface CommentSectionProps {
  documentId: string;
}

const CommentSection: React.FC<CommentSectionProps> = ({ documentId }) => {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [form] = Form.useForm();
  const { user } = useAuth();

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/comments/${documentId}`);
      setComments(res.data.data || []);
    } catch (err) {
      console.error('Ошибка загрузки комментариев:', err);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async (values: { content: string }) => {
    if (!user) {
      message.error('Войдите, чтобы оставить комментарий');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(`/comments/${documentId}`, {
        content: values.content,
        parent_id: replyTo
      });
      form.resetFields();
      setReplyTo(null);
      message.success('Комментарий отправлен');
      loadComments();
    } catch (err) {
      message.error('Ошибка отправки комментария');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (commentId: number) => {
    setReplyTo(commentId);
    form.focusField('content');
  };

  return (
    <div style={{ marginTop: 32 }}>
      <Title level={4}>Комментарии ({comments.length})</Title>
      
      {user ? (
        <Form form={form} onFinish={handleSubmit} style={{ marginBottom: 24 }}>
          {replyTo && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Ответ на комментарий #{replyTo}{' '}
              <Button type="link" size="small" onClick={() => setReplyTo(null)}>Отменить</Button>
            </Text>
          )}
          <Form.Item name="content" rules={[{ required: true, message: 'Введите текст комментария' }]}>
            <TextArea rows={3} placeholder="Ваш комментарий..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Отправить
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          <a href="/login">Войдите</a>, чтобы оставить комментарий.
        </Text>
      )}

      {loading ? (
        <Spin />
      ) : comments.length > 0 ? (
        <List
          dataSource={comments}
          itemLayout="horizontal"
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="reply" type="link" size="small" onClick={() => handleReply(item.id)}>
                  Ответить
                </Button>,
                item.replies_count > 0 && (
                  <Text key="replies" type="secondary">
                    {item.replies_count} {item.replies_count === 1 ? 'ответ' : 'ответов'}
                  </Text>
                )
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} src={item.avatar_url} />}
                title={
                  <Space>
                    <Text strong>{item.display_name}</Text>
                    <Text type="secondary">{new Date(item.created_at).toLocaleString('ru')}</Text>
                  </Space>
                }
                description={<Text>{item.content}</Text>}
              />
            </List.Item>
          )}
        />
      ) : (
        <Text type="secondary">Пока нет комментариев. Будьте первым!</Text>
      )}
    </div>
  );
};

export default CommentSection;