import api from '../lib/api';
import type { SystemSetting, SystemSettingsDefaults } from '../types/system-settings.types';

export async function getSystemSettingsDefaults(): Promise<SystemSettingsDefaults> {
  const response = await api.get('/system-settings/defaults');
  return response.data;
}

export async function getSystemSettingByKey(key: string): Promise<SystemSetting> {
  const response = await api.get(`/system-settings/${key}`);
  return response.data;
}

export async function updateSystemSetting(key: string, value: string, dataType?: string): Promise<SystemSetting> {
  const response = await api.put(`/system-settings/${key}`, { value, dataType });
  return response.data;
}
