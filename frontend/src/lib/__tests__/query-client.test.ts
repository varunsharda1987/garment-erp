/**
 * Queries retry transient failures, never a 4xx — the default said so in a comment while `retry: 2`
 * retried everything, so a refused list request sat on "No purchase orders found" for ~3 s first.
 */
import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { createQueryClient, shouldRetryQuery } from '@/lib/query-client';

function httpError(status: number) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_RESPONSE',
    config,
    {},
    {
      status,
      statusText: '',
      headers: {},
      config,
      data: {},
    }
  );
}

describe('shouldRetryQuery', () => {
  it.each([400, 401, 403, 404, 409, 422, 499])('does not retry HTTP %i', (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(false);
  });

  it('does not retry an expired session (api.ts rejects with SESSION_EXPIRED)', () => {
    expect(shouldRetryQuery(0, new Error('SESSION_EXPIRED'))).toBe(false);
  });

  it.each([500, 502, 503, 504])('retries HTTP %i up to 2 times', (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(true);
    expect(shouldRetryQuery(1, httpError(status))).toBe(true);
    expect(shouldRetryQuery(2, httpError(status))).toBe(false);
  });

  it('retries a network error (no response) up to 2 times', () => {
    const offline = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(shouldRetryQuery(0, offline)).toBe(true);
    expect(shouldRetryQuery(1, offline)).toBe(true);
    expect(shouldRetryQuery(2, offline)).toBe(false);
    expect(shouldRetryQuery(0, new TypeError('x is undefined'))).toBe(true);
    expect(shouldRetryQuery(0, null)).toBe(true);
  });

  it('is the default for every query', () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });
});
