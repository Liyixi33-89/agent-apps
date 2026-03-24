import axios from 'axios';

const api = axios.create({ baseURL: '/api/admin', timeout: 60_000 });

// 请求拦截器：自动附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截器：401 跳转登录
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const adminLogin = async (username: string, password: string) => {
  const { data } = await api.post<{ success: boolean; data: { token: string; username: string; role: string } }>('/login', { username, password });
  return data.data;
};

export const fetchDashboard = async () => {
  const { data } = await api.get('/dashboard');
  return data.data;
};

export const fetchAdminAgents = async (params?: { page?: number; limit?: number; category?: string; search?: string }) => {
  const { data } = await api.get('/agents', { params });
  return data;
};

export const updateAgent = async (id: string, update: Record<string, unknown>) => {
  const { data } = await api.put(`/agents/${id}`, update);
  return data.data;
};

export const deleteAgent = async (id: string) => {
  await api.delete(`/agents/${id}`);
};

export const fetchAdminKnowledge = async (params?: { page?: number; limit?: number }) => {
  const { data } = await api.get('/knowledge', { params });
  return data;
};

export const createKnowledge = async (body: {
  titleZh: string; titleEn: string; content: string;
  sourceType: 'markdown' | 'text' | 'url'; categoryKey?: string;
  agentSlug?: string; tags?: string[]; translate?: boolean;
}) => {
  const { data } = await api.post('/knowledge', body);
  return data.data;
};

export const deleteKnowledge = async (id: string) => {
  await api.delete(`/knowledge/${id}`);
};

export const fetchAdminPipelines = async () => {
  const { data } = await api.get('/pipelines');
  return data.data;
};

export const createPipeline = async (body: Record<string, unknown>) => {
  const { data } = await api.post('/pipelines', body);
  return data.data;
};

export const deletePipeline = async (id: string) => {
  await api.delete(`/pipelines/${id}`);
};

export const fetchAdminChats = async (params?: { page?: number; limit?: number }) => {
  const { data } = await api.get('/chats', { params });
  return data;
};

export const deleteChat = async (id: string) => {
  await api.delete(`/chats/${id}`);
};

export const triggerAdminIngest = async (translate = false) => {
  const { data } = await api.post('/ingest', { translate });
  return data.data;
};

export const fetchSettings = async () => {
  const { data } = await api.get('/settings');
  return data.data;
};
