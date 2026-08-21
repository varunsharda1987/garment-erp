import api from '../lib/api';
import type { SystemSetting, SystemDefaultRow } from '../types/system-settings.types';

/**
 * Every registered default, as rows. See SystemDefaultRow for why this is not a keyed map.
 */
export async function getSystemSettingsDefaults(): Promise<SystemDefaultRow[]> {
  const response = await api.get<SystemDefaultRow[]>('/system-settings/defaults');
  return response.data;
}

export async function getSystemSettingByKey(key: string): Promise<SystemSetting> {
  const response = await api.get(`/system-settings/${key}`);
  return response.data;
}

/**
 * Update one setting. `dataType` comes from the row being edited — never invent it here,
 * or a NUMBER setting silently becomes a STRING.
 */
export async function updateSystemSetting(key: string, value: string, dataType: string): Promise<SystemSetting> {
  const response = await api.put(`/system-settings/${key}`, { value, dataType });
  return response.data;
}
