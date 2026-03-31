import axios from 'axios';

const api = axios.create({ baseURL: '/api/admin', timeout: 60_000 });

// 请求拦截器：自动附加 token
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch { /* ignore */ }
  return config;
});

/** 外部调用：手动设置 token（store 初始化时使用） */
export const initAdminToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

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

export const updatePipeline = async (id: string, body: Record<string, unknown>) => {
  const { data } = await api.put(`/pipelines/${id}`, body);
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

export const triggerKnowledgeIngest = async () => {
  const { data } = await api.post('/ingest/knowledge');
  return data.data as {
    totalAgents: number;
    created: number;
    updated: number;
    totalChunks: number;
    errors: Array<{ slug: string; error: string }>;
  };
};

export const fetchSettings = async () => {
  const { data } = await api.get('/settings');
  return data.data;
};

// ─── 提示词管理 ────────────────────────────────────────────────────────────────

export interface SystemPrompt {
  _id: string;
  key: string;
  category: 'vibe' | 'pipeline';
  name: string;
  description: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const fetchAdminPrompts = async (category?: string) => {
  const { data } = await api.get<{ success: boolean; data: SystemPrompt[] }>('/prompts', {
    params: category ? { category } : undefined,
  });
  return data.data;
};

export const fetchAdminPrompt = async (key: string) => {
  const { data } = await api.get<{ success: boolean; data: SystemPrompt }>(`/prompts/${key}`);
  return data.data;
};

export const createAdminPrompt = async (body: Omit<SystemPrompt, '_id' | 'createdAt' | 'updatedAt'>) => {
  const { data } = await api.post<{ success: boolean; data: SystemPrompt }>('/prompts', body);
  return data.data;
};

export const updateAdminPrompt = async (key: string, body: Partial<Omit<SystemPrompt, '_id' | 'key' | 'createdAt' | 'updatedAt'>>) => {
  const { data } = await api.put<{ success: boolean; data: SystemPrompt }>(`/prompts/${key}`, body);
  return data.data;
};

export const deleteAdminPrompt = async (key: string) => {
  await api.delete(`/prompts/${key}`);
};

export const seedAdminPrompts = async (force = false) => {
  const { data } = await api.post<{ success: boolean; data: Array<{ key: string; action: string }> }>('/prompts/seed', { force });
  return data.data;
};

// ─── Vibe 模板市场管理 ─────────────────────────────────────────────────────────

export interface VibeTemplateAdmin {
  _id: string;
  title: string;
  description: string;
  category: string;
  author: string;
  thumbnail?: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const fetchAdminVibeTemplates = async (params?: { page?: number; limit?: number; category?: string; search?: string }) => {
  const { data } = await api.get<{ success: boolean; data: VibeTemplateAdmin[]; pagination: { page: number; limit: number; total: number } }>('/vibe-templates', { params });
  return data;
};

export const updateAdminVibeTemplate = async (id: string, body: Partial<Omit<VibeTemplateAdmin, '_id' | 'createdAt' | 'updatedAt'>>) => {
  const { data } = await api.put<{ success: boolean; data: VibeTemplateAdmin }>(`/vibe-templates/${id}`, body);
  return data.data;
};

export const deleteAdminVibeTemplate = async (id: string) => {
  await api.delete(`/vibe-templates/${id}`);
};

// ─── Vibe 已发布应用管理 ──────────────────────────────────────────────────────

export interface VibeAppAdmin {
  _id: string;
  title: string;
  description: string;
  category: string;
  author: string;
  thumbnail?: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  tags: string[];
  isActive: boolean;
  codeParts: {
    isReact?: boolean;
    isFullHtml?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export const fetchAdminVibeApps = async (params?: { page?: number; limit?: number; search?: string; isActive?: string }) => {
  const { data } = await api.get<{ success: boolean; data: VibeAppAdmin[]; pagination: { page: number; limit: number; total: number } }>('/vibe-apps', { params });
  return data;
};

export const updateAdminVibeApp = async (id: string, body: Partial<Omit<VibeAppAdmin, '_id' | 'createdAt' | 'updatedAt'>>) => {
  const { data } = await api.put<{ success: boolean; data: VibeAppAdmin }>(`/vibe-apps/${id}`, body);
  return data.data;
};

export const deleteAdminVibeApp = async (id: string) => {
  await api.delete(`/vibe-apps/${id}`);
};
