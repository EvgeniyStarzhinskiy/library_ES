import { Form, Input, Button, Card, Typography, Divider, Space, message } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const { Title } = Typography;

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password);
      message.success('Вход выполнен');
      navigate('/');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Ошибка входа');
    }
  };

  const handleOAuth = (provider: string) => {
    window.location.href = `/library_ES/api/v1/auth/oauth/${provider}`;
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto' }}>
      <Card>
        <Title level={3} style={{ textAlign: 'center' }}>Вход</Title>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>Войти</Button>
          </Form.Item>
        </Form>
        <Divider>или</Divider>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button icon={<GoogleOutlined />} block onClick={() => handleOAuth('google')}>Google</Button>
          <Button block onClick={() => handleOAuth('yandex')}>Яндекс</Button>
          <Button block onClick={() => handleOAuth('vk')}>ВКонтакте</Button>
        </Space>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/register">Зарегистрироваться</Link>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;