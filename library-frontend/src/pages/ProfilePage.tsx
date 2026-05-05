import { Typography, Space, Card, Button, Descriptions } from 'antd';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;

const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <div style={{ textAlign: 'center', padding: 50 }}>Пожалуйста, войдите</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Личный кабинет</Title>
      <Card style={{ maxWidth: 600 }}>
        <Descriptions column={1}>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Роль">{user.role === 'admin' ? 'Администратор' : 'Пользователь'}</Descriptions.Item>
        </Descriptions>
        <Space style={{ marginTop: 16 }}>
          <Link to="/profile/favorites"><Button type="primary">Избранное</Button></Link>
          <Link to="/profile/donations"><Button>Донаты</Button></Link>
        </Space>
      </Card>
    </div>
  );
};

export default ProfilePage;
