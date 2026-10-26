import { LogoutOutlined } from '@ant-design/icons';
import { Avatar, Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { navItems } from '../routes.jsx';

const ROLE_LABEL = { ADMIN: 'Quản trị', RECEPTIONIST: 'Lễ tân', DOCTOR: 'Bác sĩ' };

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = navItems
    .filter((item) => !item.roles || item.roles.includes(user.role))
    .map((item) => ({ key: item.path, icon: item.icon, label: item.label }));
  const current = navItems.find((item) => pathname.startsWith(item.path));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider
        breakpoint="lg"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={232}
      >
        <div style={{ padding: '18px 20px', fontWeight: 700, color: '#0f766e', whiteSpace: 'nowrap' }}>
          {collapsed ? '✚' : '✚ Phòng khám đa khoa'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={current ? [current.path] : []}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            {current?.label ?? ''}
          </Typography.Title>
          <Space>
            <Avatar style={{ background: '#0f766e' }}>{user.fullName?.[0] ?? '?'}</Avatar>
            <span>{user.fullName}</span>
            <Tag>{ROLE_LABEL[user.role] ?? user.role}</Tag>
            <Button icon={<LogoutOutlined />} onClick={logout}>
              Đăng xuất
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ margin: 24 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
