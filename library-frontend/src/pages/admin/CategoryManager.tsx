import { Breadcrumb, Typography } from 'antd';
import { HomeOutlined, FolderOutlined } from '@ant-design/icons';

const { Title } = Typography;

const CategoryManager: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb>
        <Breadcrumb.Item href="/"><HomeOutlined /> Главная</Breadcrumb.Item>
        <Breadcrumb.Item><FolderOutlined /> Админка</Breadcrumb.Item>
        <Breadcrumb.Item>Категории</Breadcrumb.Item>
      </Breadcrumb>
      <Title level={3} style={{ marginTop: 16 }}>Управление категориями (старая версия)</Title>
    </div>
  );
};

export default CategoryManager;
