import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { userService } from '@/services/user.service';
import { getSystemSettingsDefaults, updateSystemSetting } from '@/services/system-settings.service';
import type { SystemDefaultRow } from '@/types/system-settings.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Lock, Loader2, Eye, EyeOff, AlertCircle, Settings2, Save } from 'lucide-react';

export default function Settings() {
  const { user: currentUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePasswords = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (
      passwordData.currentPassword &&
      passwordData.newPassword &&
      passwordData.currentPassword === passwordData.newPassword
    ) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.id) return;

    if (!validatePasswords()) return;

    try {
      setIsSaving(true);

      await userService.changePassword(currentUser.id, passwordData.currentPassword, passwordData.newPassword);

      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setErrors({});

      handleApiSuccess('Password changed', 'Your password has been successfully updated.');
    } catch (error) {
      handleApiError(error, 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof typeof passwordData, value: string) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!currentUser) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Security Notice */}
              <div className="flex items-start gap-3 p-4 bg-info-muted border border-info/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-info mt-0.5 flex-shrink-0" />
                <div className="text-sm text-info">
                  <p className="font-medium">Password Requirements:</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-info">
                    <li>Must be at least 6 characters long</li>
                    <li>Must be different from your current password</li>
                  </ul>
                </div>
              </div>

              {/* Current Password */}
              <div>
                <Label htmlFor="currentPassword">
                  Current Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => handleChange('currentPassword', e.target.value)}
                    className={`pl-10 pr-10 ${errors.currentPassword ? 'border-destructive' : ''}`}
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.currentPassword && <p className="mt-1 text-sm text-destructive">{errors.currentPassword}</p>}
              </div>

              {/* New Password */}
              <div>
                <Label htmlFor="newPassword">
                  New Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => handleChange('newPassword', e.target.value)}
                    className={`pl-10 pr-10 ${errors.newPassword ? 'border-destructive' : ''}`}
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.newPassword && <p className="mt-1 text-sm text-destructive">{errors.newPassword}</p>}
              </div>

              {/* Confirm New Password */}
              <div>
                <Label htmlFor="confirmPassword">
                  Confirm New Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className={`pl-10 pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: '',
                    });
                    setErrors({});
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Default Wastage Settings Card */}
        <SystemDefaultsCard />
      </div>
    </div>
  );
}

/**
 * Renders EVERY registered default, grouped by area.
 *
 * There is deliberately no hand-maintained list of keys here. The previous version kept a
 * local WASTAGE_SETTINGS array, which drifted: TRIM_DEFAULT_WASTAGE_PERCENT was missing from
 * it, so the setting that governs every trim on the BOM had no UI at all and could not be
 * changed. Rows come from the backend registry, so a new default is editable the moment it
 * is declared there.
 */
function SystemDefaultsCard() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['system-settings', 'defaults'],
    queryFn: getSystemSettingsDefaults,
  });

  const syncFromServer = useCallback((source: SystemDefaultRow[] | undefined) => {
    if (!source) return;
    const values: Record<string, string> = {};
    source.forEach((row) => {
      values[row.key] = row.value;
    });
    setEditValues(values);
    setHasChanges(false);
  }, []);

  useEffect(() => {
    syncFromServer(rows);
  }, [rows, syncFromServer]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const changed = (rows ?? []).filter((row) => editValues[row.key] !== row.value);
      // dataType comes from the row itself — inventing it here would rewrite a NUMBER
      // setting as a STRING.
      await Promise.all(changed.map((row) => updateSystemSetting(row.key, editValues[row.key], row.dataType)));
      return changed.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      handleApiSuccess('Settings saved', `${count} default${count === 1 ? '' : 's'} updated.`);
      setHasChanges(false);
    },
    onError: (error) => {
      handleApiError(error, 'Failed to save settings');
    },
  });

  const handleValueChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Preserve the registry's declaration order within each group.
  const groups: Array<{ name: string; rows: SystemDefaultRow[] }> = [];
  (rows ?? []).forEach((row) => {
    const existing = groups.find((g) => g.name === row.group);
    if (existing) existing.rows.push(row);
    else groups.push({ name: row.group, rows: [row] });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Default Values
        </CardTitle>
        <CardDescription>
          These defaults apply when a value is not set on the item itself. Changing one here takes effect immediately —
          no deployment needed — and is never overwritten by an update.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.name}>
              <h4 className="text-sm font-semibold mb-3">{group.name}</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.rows.map((row) => (
                  <div key={row.key}>
                    <Label htmlFor={row.key} className="flex items-center gap-2">
                      {row.label}
                      {editValues[row.key] !== row.registryValue && (
                        <Badge variant="secondary" className="text-[10px]">
                          changed
                        </Badge>
                      )}
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id={row.key}
                        type={row.dataType === 'NUMBER' ? 'number' : 'text'}
                        min={row.min ?? undefined}
                        max={row.max ?? undefined}
                        step={row.dataType === 'NUMBER' ? 0.1 : undefined}
                        value={editValues[row.key] ?? ''}
                        onChange={(e) => handleValueChange(row.key, e.target.value)}
                        className="w-28"
                      />
                      {row.unit && <span className="text-sm text-muted-foreground">{row.unit}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{row.description}</p>
                    {editValues[row.key] !== row.registryValue && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline mt-1"
                        onClick={() => handleValueChange(row.key, row.registryValue)}
                      >
                        Reset to default ({row.registryValue}
                        {row.unit ?? ''})
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
          <Button
            type="button"
            variant="outline"
            disabled={!hasChanges || saveMutation.isPending}
            onClick={() => syncFromServer(rows)}
          >
            Discard changes
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
