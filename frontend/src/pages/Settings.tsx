import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { userService } from '@/services/user.service';
import { getSystemSettingsDefaults, updateSystemSetting } from '@/services/system-settings.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
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
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium">Password Requirements:</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-blue-800">
                    <li>Must be at least 6 characters long</li>
                    <li>Must be different from your current password</li>
                  </ul>
                </div>
              </div>

              {/* Current Password */}
              <div>
                <Label htmlFor="currentPassword">
                  Current Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => handleChange('currentPassword', e.target.value)}
                    className={`pl-10 pr-10 ${errors.currentPassword ? 'border-red-500' : ''}`}
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.currentPassword && <p className="mt-1 text-sm text-red-600">{errors.currentPassword}</p>}
              </div>

              {/* New Password */}
              <div>
                <Label htmlFor="newPassword">
                  New Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => handleChange('newPassword', e.target.value)}
                    className={`pl-10 pr-10 ${errors.newPassword ? 'border-red-500' : ''}`}
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.newPassword && <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>}
              </div>

              {/* Confirm New Password */}
              <div>
                <Label htmlFor="confirmPassword">
                  Confirm New Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className={`pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
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
        <WastageDefaultsCard />
      </div>
    </div>
  );
}

const WASTAGE_SETTINGS = [
  {
    key: 'FABRIC_DEFAULT_WASTAGE_PERCENT',
    label: 'Fabric Wastage %',
    description: 'Default wastage for fabric materials in CAD and BOM',
  },
  {
    key: 'GREIGE_DEFAULT_WASTAGE_PERCENT',
    label: 'Greige Wastage %',
    description: 'Default wastage for greige materials in CAD and BOM',
  },
  { key: 'LACE_DEFAULT_WASTAGE_PERCENT', label: 'Lace Wastage %', description: 'Default wastage for lace materials' },
  {
    key: 'LABEL_DEFAULT_EXTRA_PERCENT',
    label: 'Label Extra %',
    description: 'Default extra percentage for label materials',
  },
];

function WastageDefaultsCard() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: defaults, isLoading } = useQuery({
    queryKey: ['system-settings', 'defaults'],
    queryFn: getSystemSettingsDefaults,
  });

  // Sync loaded defaults into edit state
  useEffect(() => {
    if (defaults) {
      const values: Record<string, string> = {};
      WASTAGE_SETTINGS.forEach(({ key }) => {
        values[key] = defaults[key] ?? '';
      });
      setEditValues(values);
      setHasChanges(false);
    }
  }, [defaults]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = WASTAGE_SETTINGS.map(({ key }) => {
        const newValue = editValues[key];
        const oldValue = defaults?.[key];
        if (newValue !== oldValue) {
          return updateSystemSetting(key, newValue, 'NUMBER');
        }
        return Promise.resolve(null);
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      handleApiSuccess('Settings saved', 'Default wastage settings have been updated.');
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
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Default Wastage Settings
        </CardTitle>
        <CardDescription>
          Configure default wastage percentages for different material types. These defaults are used when creating new
          CAD entries and BOM items.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {WASTAGE_SETTINGS.map(({ key, label, description }) => (
            <div key={key}>
              <Label htmlFor={key}>{label}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id={key}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={editValues[key] ?? ''}
                  onChange={(e) => handleValueChange(key, e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{description}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
          <Button
            type="button"
            variant="outline"
            disabled={!hasChanges || saveMutation.isPending}
            onClick={() => {
              if (defaults) {
                const values: Record<string, string> = {};
                WASTAGE_SETTINGS.forEach(({ key }) => {
                  values[key] = defaults[key] ?? '';
                });
                setEditValues(values);
                setHasChanges(false);
              }
            }}
          >
            Reset
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
