import api from '@/lib/api';

/**
 * Open a PDF in a new browser tab (with auth)
 */
export async function openPDF(endpoint: string): Promise<void> {
  const response = await api.get(endpoint, { responseType: 'blob' });
  const url = window.URL.createObjectURL(response.data);
  window.open(url, '_blank');
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}

/**
 * Download a file (with auth)
 */
export async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const response = await api.get(endpoint, { responseType: 'blob' });
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
