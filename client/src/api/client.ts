import axios from 'axios';

const apiClient = axios.create({ baseURL: '/api', withCredentials: true });

// Module-level token so the request interceptor avoids a circular Zustand import
let _token: string | null = null;
export const setApiToken = (t: string | null) => { _token = t; };

apiClient.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      original._retry = true;
      if (!refreshing) {
        refreshing = apiClient
          .post<{ accessToken: string }>('/auth/refresh')
          .then((r) => r.data.accessToken)
          .finally(() => { refreshing = null; });
      }
      try {
        const token = await refreshing;
        // Update Zustand store lazily to avoid circular import
        const { useAuthStore } = await import('../stores/authStore');
        useAuthStore.getState().setAccessToken(token);
        original.headers['Authorization'] = `Bearer ${token}`;
        return apiClient(original);
      } catch {
        const { useAuthStore } = await import('../stores/authStore');
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
