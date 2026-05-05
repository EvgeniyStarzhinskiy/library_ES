import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import AppHeader from './AppHeader';

const { Content } = Layout;

const MainLayout: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ 
        padding: '16px', 
        marginTop: 64, 
        maxWidth: 1200, 
        marginLeft: 'auto', 
        marginRight: 'auto', 
        width: '100%' 
      }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default MainLayout;