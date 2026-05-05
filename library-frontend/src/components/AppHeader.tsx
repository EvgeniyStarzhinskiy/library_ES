import { useState } from 'react';
import { Layout, Input, Button, Space, AutoComplete, Drawer, Menu } from 'antd';
import { 
  SearchOutlined, 
  HeartOutlined, 
  WalletOutlined, 
  UserOutlined, 
  SunOutlined, 
  MoonOutlined,
  AppstoreOutlined,
  LoginOutlined,
  LogoutOutlined,
  MenuOutlined,
  BookOutlined,
  TagOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { useEffect } from 'react';

const { Header } = Layout;

const AppHeader: React.FC = () => {
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [options, setOptions] = useState<{ value: string }[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Закрывать мобильное меню при смене страницы
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const fetchSuggestions = async (value: string) => {
    if (value.length < 2) {
      setOptions([]);
      return;
    }
    try {
      const res = await apiClient.get('/documents/search/suggest', { params: { q: value } });
      setOptions((res.data || []).map((item: any) => ({
        value: item.value,
        label: (
          <Space>
            {item.type === 'title' && <BookOutlined />}
            {item.type === 'author' && <UserOutlined />}
            {item.type === 'tag' && <TagOutlined />}
            <span>{item.value}</span>
            <Tag>{item.type === 'title' ? 'док.' : item.type === 'author' ? 'автор' : 'тег'}</Tag>
          </Space>
        ),
        type: item.type,
        slug: item.slug
      })));
    } catch {
      setOptions([]);
    }
  };

  const handleSearch = (value: string) => {
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value)}`);
    }
  };

  const logoText = isMobile ? '📚 Библ.' : '📚 Библиотека буровых растворов';

  const mobileMenuItems = [
    { key: 'browse', icon: <AppstoreOutlined />, label: 'Категории', onClick: () => navigate('/browse') },
    ...(user ? [
      { key: 'favorites', icon: <HeartOutlined />, label: 'Избранное', onClick: () => navigate('/profile/favorites') },
      { key: 'donations', icon: <WalletOutlined />, label: 'Пожертвования', onClick: () => navigate('/profile/donations') },
      { key: 'profile', icon: <UserOutlined />, label: user.display_name, onClick: () => navigate('/profile') },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Выйти', onClick: () => { logout(); navigate('/'); } }
    ] : [
      { key: 'login', icon: <LoginOutlined />, label: 'Войти', onClick: () => navigate('/login') }
    ])
  ];

  return (
    <>
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        position: 'fixed', 
        width: '100%', 
        zIndex: 100,
        padding: '0 16px'
      }}>
        {/* Логотип */}
        <div 
          style={{ color: 'white', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: isMobile ? 14 : 16 }} 
          onClick={() => navigate('/')}
        >
          {logoText}
        </div>

        {/* Поиск */}
        <AutoComplete
          options={options}
          onSearch={fetchSuggestions}
          value={searchValue}
          onChange={setSearchValue}
          onSelect={(value, option: any) => {
            setSearchValue(value);
            if (option.type === 'author') {
              navigate(`/search?author=${encodeURIComponent(value)}`);
            } else if (option.type === 'tag') {
              navigate(`/search?tag=${encodeURIComponent(option.slug || value)}`);
            } else {
              navigate(`/search?q=${encodeURIComponent(value)}`);
            }
          }}
          style={{ maxWidth: isMobile ? 200 : 400, flex: 1, margin: '0 8px' }}
        >
          <Input.Search
            placeholder={isMobile ? 'Поиск...' : 'Поиск документов...'}
            onSearch={handleSearch}
            enterButton={isMobile ? <SearchOutlined /> : undefined}
            size={isMobile ? 'small' : 'middle'}
          />
        </AutoComplete>

        {/* Десктопная навигация */}
        {!isMobile && (
          <Space>
            <Button icon={<AppstoreOutlined />} type="text" style={{ color: 'white' }} onClick={() => navigate('/browse')}>
              Категории
            </Button>
            {user ? (
              <>
                <Button icon={<HeartOutlined />} type="text" style={{ color: 'white' }} onClick={() => navigate('/profile/favorites')} />
                <Button icon={<WalletOutlined />} type="text" style={{ color: 'white' }} onClick={() => navigate('/profile/donations')} />
                <Button icon={<UserOutlined />} type="text" style={{ color: 'white' }} onClick={() => navigate('/profile')}>
                  {user.display_name}
                </Button>
                <Button icon={<LogoutOutlined />} type="text" style={{ color: 'white' }} onClick={logout} />
              </>
            ) : (
              <Button icon={<LoginOutlined />} type="text" style={{ color: 'white' }} onClick={() => navigate('/login')}>
                Войти
              </Button>
            )}
            <Button
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              type="text"
              style={{ color: 'white' }}
              onClick={toggleTheme}
            />
          </Space>
        )}

        {/* Мобильное меню + тема */}
        {isMobile && (
          <Space>
            <Button
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              type="text"
              style={{ color: 'white' }}
              onClick={toggleTheme}
            />
            <Button
              icon={<MenuOutlined />}
              type="text"
              style={{ color: 'white' }}
              onClick={() => setMobileMenuOpen(true)}
            />
          </Space>
        )}
      </Header>

      <Drawer
        title="Меню"
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={250}
      >
        <Menu
          mode="inline"
          items={mobileMenuItems}
          onClick={() => setMobileMenuOpen(false)}
        />
      </Drawer>
    </>
  );
};

export default AppHeader;