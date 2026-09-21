/**
 * Company Profile Service
 *
 * Reads are open to any authenticated user — the Purchase Order screens render the letterhead
 * from the default entity, so gating reads to admins would leave every non-admin with a
 * permanent fallback. Writes are admin-only, enforced server-side.
 */

import api from '../lib/api';
import type {
  CompanyProfile,
  CreateCompanyProfileRequest,
  UpdateCompanyProfileRequest,
} from '@/types/companyProfile.types';

const BASE_URL = '/company-profiles';

/** Every entity, default first. */
export async function getCompanyProfiles(): Promise<CompanyProfile[]> {
  const response = await api.get(BASE_URL);
  return response.data.data;
}

/** The entity every document uses. */
export async function getDefaultCompanyProfile(): Promise<CompanyProfile> {
  const response = await api.get(`${BASE_URL}/default`);
  return response.data.data;
}

export async function getCompanyProfileById(id: string): Promise<CompanyProfile> {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data.data;
}

export async function createCompanyProfile(data: CreateCompanyProfileRequest): Promise<CompanyProfile> {
  const response = await api.post(BASE_URL, data);
  return response.data.data;
}

export async function updateCompanyProfile(id: string, data: UpdateCompanyProfileRequest): Promise<CompanyProfile> {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data.data;
}

/** Switches the entity every FUTURE document is issued under. */
export async function setDefaultCompanyProfile(id: string): Promise<CompanyProfile> {
  const response = await api.post(`${BASE_URL}/${id}/set-default`, {});
  return response.data.data;
}

async function uploadAsset(id: string, kind: 'logo' | 'signature', file: File): Promise<CompanyProfile> {
  const formData = new FormData();
  formData.append(kind, file);
  const response = await api.post(`${BASE_URL}/${id}/${kind}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export const uploadCompanyLogo = (id: string, file: File) => uploadAsset(id, 'logo', file);
export const uploadCompanySignature = (id: string, file: File) => uploadAsset(id, 'signature', file);
