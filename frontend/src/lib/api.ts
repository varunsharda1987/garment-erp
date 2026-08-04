import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import humps from 'humps';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/auth.store';

// API base URL - uses environment variable with fallback for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
  // Note: Don't set default Content-Type - let it be set per request
});

// Configure retry logic for network errors and rate limiting
axiosRetry(api, {
  retries: 3, // Retry 3 times
  retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
  retryCondition: (error) => {
    // ONLY auto-retry read-only methods. On a network error or 5xx a write may have
    // SUCCEEDED on the server and only the response was lost — retrying would duplicate
    // it (a second challan, payment, or stock movement). This app's PUT/PATCH handlers
    // are not all idempotent (some increment stock/counters), so writes of every kind
    // are excluded, not just POST (bug-hunt BH-0280).
    const method = error.config?.method?.toLowerCase();
    if (method !== 'get' && method !== 'head' && method !== 'options') {
      return false;
    }
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429 ||
      (error.response?.status !== undefined && error.response.status >= 500)
    );
  },
  onRetry: (retryCount, error) => {
    if (import.meta.env.DEV) {
      console.warn(`Retry attempt ${retryCount} for ${error.config?.url}`);
    }
  },
});

// Token refresh state management
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Request interceptor to add auth token and transform data
api.interceptors.request.use(
  (config) => {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = new axios.AxiosHeaders();
    }

    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Set Content-Type based on data type
    if (config.data instanceof FormData) {
      // Don't set Content-Type - browser will set it with boundary
      // Content-Type will be: multipart/form-data; boundary=----WebKitFormBoundary...
    } else if (config.data && !config.headers['Content-Type']) {
      // Set JSON content type for non-FormData requests
      config.headers['Content-Type'] = 'application/json';
    }

    // Transform request data from camelCase to snake_case (if needed)
    // Note: Currently backend accepts camelCase, so this is optional
    // Uncomment if backend expects snake_case for request bodies
    // if (config.data && !(config.data instanceof FormData)) {
    //   config.data = humps.decamelizeKeys(config.data);
    // }

    // Transform query parameters from camelCase to snake_case (if needed)
    // if (config.params) {
    //   config.params = humps.decamelizeKeys(config.params);
    // }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors, token refresh, and transform data
api.interceptors.response.use(
  (response) => {
    // Transform response data from snake_case to camelCase
    // Note: Backend now handles this transformation, but we keep this as a safety net
    // In case any response slips through without transformation
    if (response.data && typeof response.data === 'object') {
      // The backend middleware already converts to camelCase
      // But we can add additional client-side transformation if needed
      // response.data = humps.camelizeKeys(response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const message = String((error.response?.data as { message?: string })?.message || '').toLowerCase();
    const isTokenForbidden = status === 403 && (message.includes('token') || message.includes('expired'));

    // Check if this is an auth-related error that could benefit from token refresh
    const isAuthError = status === 401 || isTokenForbidden;
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh');

    // BUG-AUTH6: Attempt token refresh for expired tokens (but not auth endpoints)
    if (isAuthError && !isAuthEndpoint && !originalRequest._retry) {
      const refreshToken = useAuthStore.getState().refreshToken;

      // Only attempt refresh if we have a refresh token
      if (refreshToken) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Attempt to refresh the token
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token: newToken, refreshToken: newRefreshToken } = response.data;

          // Update tokens in store
          useAuthStore.getState().setTokens(newToken, newRefreshToken);

          // Process queued requests with new token
          processQueue(null, newToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - clear auth and redirect
          processQueue(refreshError, null);

          const wasAuthenticated = useAuthStore.getState().isAuthenticated;
          useAuthStore.getState().clearAuth();

          if (wasAuthenticated) {
            toast.error('Session expired. Please log in again.');
            setTimeout(() => {
              window.location.href = '/login';
            }, 500);
          }

          return Promise.reject(new Error('SESSION_EXPIRED'));
        } finally {
          isRefreshing = false;
        }
      }
    }

    // Handle expired/invalid session when no refresh token available
    if (isAuthError && !isAuthEndpoint) {
      const wasAuthenticated = useAuthStore.getState().isAuthenticated;
      useAuthStore.getState().clearAuth();

      if (wasAuthenticated) {
        toast.error('Session expired. Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }

      return Promise.reject(new Error('SESSION_EXPIRED'));
    }

    // Transform error response data to camelCase as well
    if (error.response?.data && typeof error.response.data === 'object') {
      error.response.data = humps.camelizeKeys(error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;
