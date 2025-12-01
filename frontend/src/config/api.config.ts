/**
 * API Configuration
 * Centralizes all API URL configuration for the frontend
 * Uses environment variables with sensible defaults for development
 */

// Base server URL (without /api) - used for static files, images, uploads
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

// API base URL (with /api) - used for API calls
export const API_URL = import.meta.env.VITE_API_URL || `${SERVER_URL}/api`;

/**
 * Get the full URL for an uploaded file/image
 * @param path - The path returned from the API (e.g., /uploads/styles/image.jpg)
 * @returns Full URL to the resource
 */
export const getUploadUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Otherwise, prepend the server URL
  return `${SERVER_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

/**
 * Get the full API URL for an endpoint
 * @param endpoint - The API endpoint (e.g., /users or users)
 * @returns Full API URL
 */
export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_URL}/${cleanEndpoint}`;
};

export default {
  SERVER_URL,
  API_URL,
  getUploadUrl,
  getApiUrl,
};
