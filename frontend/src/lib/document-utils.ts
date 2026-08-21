import api from '@/lib/api';

/**
 * Extract filename from Content-Disposition header
 */
function extractFilename(contentDisposition: string | null | undefined): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename="?([^";\n]+)"?/i);
  return match ? match[1] : null;
}

/**
 * Open a PDF in a new browser tab (with auth).
 * Creates a File object with the server's filename so "Save As" uses the correct name.
 */
export async function openPDF(endpoint: string): Promise<void> {
  const response = await api.get(endpoint, { responseType: 'blob' });
  const contentDisposition = response.headers['content-disposition'];
  const filename = extractFilename(contentDisposition) || 'document.pdf';

  // Create a File object with the proper name (instead of raw Blob)
  const file = new File([response.data], filename, { type: 'application/pdf' });
  const url = window.URL.createObjectURL(file);
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
