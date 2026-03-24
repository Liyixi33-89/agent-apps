const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '请求失败');
  }

  return payload.data;
};

export const getOverview = () => request('/api/overview');
export const getAgents = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    searchParams.set(key, value);
  });

  const query = searchParams.toString();
  return request(query ? `/api/agents?${query}` : '/api/agents');
};
export const getCategories = () => request('/api/categories');
export const getPipelines = () => request('/api/pipelines');
export const triggerIngestion = () => request('/api/ingest', { method: 'POST' });