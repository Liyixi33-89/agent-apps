/**
 * @file pages/OAuthCallbackPage.tsx
 * @description OAuth 第三方登录回调页面
 *
 * 功能：
 *   1. 从 URL 参数中获取 token
 *   2. 存储到 localStorage
 *   3. 跳转到首页
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';

const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const role = searchParams.get('role');
    const errorMsg = searchParams.get('error');

    if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      return;
    }

    if (token) {
      // 存储登录信息
      localStorage.setItem('token', token);
      if (username) localStorage.setItem('username', username);
      if (role) localStorage.setItem('role', role);

      // 跳转到首页
      setTimeout(() => navigate('/', { replace: true }), 500);
    } else {
      setError('未收到登录凭证');
    }
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Result
          status="error"
          title="登录失败"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate('/', { replace: true })}>
              返回首页
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
      <Spin size="large" />
      <p className="text-slate-500 text-sm">登录成功，正在跳转...</p>
    </div>
  );
};

export default OAuthCallbackPage;
