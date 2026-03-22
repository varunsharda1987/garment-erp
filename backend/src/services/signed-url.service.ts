/**
 * Signed URL Service
 *
 * Generates temporary signed URLs for accessing uploaded files.
 * This allows secure file access without exposing files publicly.
 */

import crypto from 'crypto';
import { logDebug } from '../utils/logger';

// Secret key for signing URLs (should be in env in production)
const SIGNING_SECRET = process.env.FILE_SIGNING_SECRET || 'kashaya-fabs-file-secret-key-change-in-production';

// Default expiry time in seconds (1 hour)
const DEFAULT_EXPIRY_SECONDS = 3600;

/**
 * Generate a signed URL for a file
 *
 * @param filePath - The path to the file (e.g., /uploads/styles/image.jpg)
 * @param expirySeconds - How long the URL should be valid (default: 1 hour)
 * @returns The signed URL with expiry and signature
 */
export function generateSignedUrl(filePath: string, expirySeconds: number = DEFAULT_EXPIRY_SECONDS): string {
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
  const signature = createSignature(filePath, expiry);

  // Return the path with query params for signature verification
  const signedPath = `${filePath}?expires=${expiry}&signature=${signature}`;

  logDebug(`Generated signed URL for ${filePath}, expires in ${expirySeconds}s`);
  return signedPath;
}

/**
 * Verify a signed URL
 *
 * @param filePath - The file path (without query params)
 * @param expires - The expiry timestamp from the URL
 * @param signature - The signature from the URL
 * @returns True if the signature is valid and not expired
 */
export function verifySignedUrl(
  filePath: string,
  expires: string | number,
  signature: string
): { valid: boolean; reason?: string } {
  // Check expiry
  const expiryTime = typeof expires === 'string' ? parseInt(expires, 10) : expires;
  const now = Math.floor(Date.now() / 1000);

  if (now > expiryTime) {
    return { valid: false, reason: 'URL has expired' };
  }

  // Verify signature
  const expectedSignature = createSignature(filePath, expiryTime);

  if (signature !== expectedSignature) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Create a signature for a file path and expiry time
 */
function createSignature(filePath: string, expiry: number): string {
  const data = `${filePath}:${expiry}`;
  return crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest('hex').substring(0, 32); // Use first 32 chars for shorter URLs
}

/**
 * Middleware to verify signed URLs for file access
 */
export function verifySignedUrlMiddleware(
  req: { path: string; query: { expires?: string; signature?: string } },
  res: { status: (code: number) => { json: (data: unknown) => void } },
  next: () => void
): void {
  const { expires, signature } = req.query;

  // If no signature params, allow access (for backward compatibility or public files)
  // You can change this to require signatures by removing this check
  if (!expires || !signature) {
    next();
    return;
  }

  const result = verifySignedUrl(req.path, expires, signature);

  if (!result.valid) {
    res.status(403).json({
      error: 'Forbidden',
      message: result.reason || 'Access denied',
    });
    return;
  }

  next();
}

/**
 * Generate signed URLs for an array of file paths
 */
export function generateSignedUrls(
  filePaths: string[],
  expirySeconds: number = DEFAULT_EXPIRY_SECONDS
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const path of filePaths) {
    result[path] = generateSignedUrl(path, expirySeconds);
  }

  return result;
}

export default {
  generateSignedUrl,
  verifySignedUrl,
  verifySignedUrlMiddleware,
  generateSignedUrls,
};
