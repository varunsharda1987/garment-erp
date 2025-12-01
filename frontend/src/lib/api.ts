import axios from 'axios';
import axiosRetry from 'axios-retry';
import humps from 'humps';
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
    // Retry on network errors or 5xx errors or rate limiting (429)
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

// Response interceptor to handle errors and transform data
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
  (error) => {
    // Handle 401 unauthorized - clear auth
    // But skip clearing auth for login/register endpoints (they return 401 on invalid credentials)
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/login') ||
                             error.config?.url?.includes('/auth/register');

      if (!isAuthEndpoint) {
        useAuthStore.getState().clearAuth();
      }
    }

    // Transform error response data to camelCase as well
    if (error.response?.data && typeof error.response.data === 'object') {
      error.response.data = humps.camelizeKeys(error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;
