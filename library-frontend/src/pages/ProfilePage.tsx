import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Typography, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        display_name: user.display_name,
        avatar_url: user.avatar_url || ''
      });
    }
  }, [user, form]);

  const handleSave = async (values: any) => {
    try {
      await apiClient.patch('/auth/me', {
        display_name: values.display_name,
        avatar_url: values.avatar_url || null
      });
      message.success('Профиль обновлён');
      // Обновить данные пользователя в контексте (можно перезагрузить или обновить состояние)
      window.location.reload();
    } catch (err) {
      message.error('Ошибка обновления');
    }
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Title level={2}>Личный кабинет</Title>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar size={80} src={user.avatar_url} icon={<UserOutlined />} />
        </div>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label="Email">
            <Input value={user.email} disabled />
          </Form.Item>
          <Form.Item name="display_name" label="Имя" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="avatar_url" label="URL аватара">
            <Input placeholder="https://example.com/avatar.jpg" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">Сохранить</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ProfilePage;