import axios from 'axios';
import humps from 'humps';
import { useAuthStore } from '../stores/auth.store';

// Create axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  // Note: Don't set default Content-Type - let it be set per request
});

// Request interceptor to add auth token and transform data
api.interceptors.request.use(
  (config) => {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {} as any;
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

    // DEBUG: Log request data for styles endpoint
    if (config.url?.includes('/styles') && config.method === 'post') {
      console.log('🌐 AXIOS INTERCEPTOR - Request URL:', config.url);
      console.log('🌐 AXIOS INTERCEPTOR - Request data.components:', config.data?.components);
      console.log('🌐 AXIOS INTERCEPTOR - Request data.brandCategoryId:', config.data?.brandCategoryId);
      console.log('🌐 AXIOS INTERCEPTOR - Full request data:', config.data);
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
