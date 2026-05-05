#!/bin/bash
set -e

SRC="/home/nodejs/library/library-frontend/src"

cat > "$SRC/components/AppHeader.tsx" << 'EOF'
import { useState } from 'react';
import { Layout, Input, Button, Space, AutoComplete, Drawer, Menu, Tag } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { SearchOutlined, MenuOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { searchDocs } from '../api/search';
import type { SearchItem } from '../api/search';

const { Header } = Layout;

const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: React.ReactNode }[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Меню временно отключено, чтобы избежать ошибки 400 от бэкенда
  const menuItems: any[] = [];

  const handleSearch = async (value: string) => {
    if (!value.trim()) return;
    const res = await searchDocs(value);
    const opts = res.data.map((item: SearchItem) => ({
      value: `/documents/${item.id}`,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{item.title || item.name}</span>
          <Tag>{item.type === 'title' ? 'док.' : item.type === 'author' ? 'автор' : 'тег'}</Tag>
        </div>
      )
    }));
    setSearchOptions(opts);
  };

  return (
    <Header style={{ background: '#fff', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Button
        type="text"
        icon={<MenuOutlined />}
        onClick={() => setDrawerVisible(true)}
        style={{ marginLeft: 16 }}
      />
      <Link to="/" style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff', marginLeft: 16 }}>
        Library ES
      </Link>
      <AutoComplete
        options={searchOptions}
        style={{ flex: 1, margin: '0 24px' }}
        onSearch={handleSearch}
        onSelect={(value) => navigate(value)}
      >
        <Input size="large" placeholder="Поиск документов..." prefix={<SearchOutlined />} />
      </AutoComplete>
      <Space style={{ marginRight: 16 }}>
        {user ? (
          <>
            <Link to="/profile">Профиль</Link>
            {user.role === 'admin' && <Link to="/admin">Админ</Link>}
            <Button type="link" onClick={logout}>Выйти</Button>
          </>
        ) : (
          <>
            <Link to="/login">Войти</Link>
            <Link to="/register">Регистрация</Link>
          </>
        )}
      </Space>
      <Drawer
        title="Меню"
        placement="left"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        <Menu mode="inline" items={menuItems} onClick={() => setDrawerVisible(false)} />
      </Drawer>
    </Header>
  );
};

export default AppHeader;
EOF

cd /home/nodejs/library/library-frontend
npm run build

mkdir -p /home/nodejs/library/library-backend/public
cp -r dist/* /home/nodejs/library/library-backend/public/

pkill -f "node server.js" || true
cd /home/nodejs/library/library-backend && node server.js &
echo "✅ Исправление применено. Обновите страницу /library_ES/admin/categories/v2"