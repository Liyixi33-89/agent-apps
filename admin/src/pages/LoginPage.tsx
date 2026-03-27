import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { RobotOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { adminLogin } from '../api';
import { useAdminStore } from '../store';

const { Title, Text } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAdminStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError('');
    try {
      const result = await adminLogin(values.username, values.password);
      setAuth(result.token, result.username);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-sky-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-200">
            <RobotOutlined style={{ fontSize: 32, color: 'white' }} />
          </div>
          <Title level={3} className="!mb-0 !text-slate-800">Agency Agents</Title>
          <Text type="secondary" className="text-sm">管理后台</Text>
        </div>

        <Card
          className="shadow-xl shadow-slate-100 border-slate-200 rounded-2xl"
          styles={{ body: { padding: '24px' } }}
        >
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              className="mb-4 rounded-lg"
            />
          )}

          <Form
            layout="vertical"
            initialValues={{ username: 'admin' }}
            onFinish={handleLogin}
            autoComplete="off"
          >
            <Form.Item
              label={<span className="text-xs font-medium text-slate-500">用户名</span>}
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined className="text-slate-400" />}
                placeholder="admin"
                size="large"
                autoComplete="username"
                aria-label="用户名"
              />
            </Form.Item>

            <Form.Item
              label={<span className="text-xs font-medium text-slate-500">密码</span>}
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-slate-400" />}
                placeholder="输入密码"
                size="large"
                autoComplete="current-password"
                aria-label="密码"
              />
            </Form.Item>

            <Form.Item className="mb-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                icon={<LockOutlined />}
                aria-label="登录"
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" className="text-xs block text-center">
            首次登录将自动创建管理员账号
          </Text>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
