import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { userService } from '@/services/user.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { User, Mail, Phone, Calendar, Shield, Loader2 } from 'lucide-react';
import type { UpdateUserData } from '@/types/user.types';

export default function Profile() {
  const { user: currentUser, setUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (currentUser) {
      // Use firstName/lastName directly (aligned with user.types.ts)
      // Fallback to parsing name for backward compatibility with old auth responses
      const firstName = currentUser.firstName || (currentUser.name || '').split(' ')[0] || '';
      const lastName = currentUser.lastName || (currentUser.name || '').split(' ').slice(1).join(' ') || '';

      setFormData({
        firstName,
        lastName,
        email: currentUser.email || '',
        phone: currentUser.phone || '',
      });
    }
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.id) return;

    try {
      setIsSaving(true);

      const updateData: UpdateUserData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || undefined,
      };

      const updatedUser = await userService.updateUser(currentUser.id, updateData);

      // Map updated user back to auth store format
      setUser({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
        role: updatedUser.role,
        phone: updatedUser.phone,
        createdAt: updatedUser.createdAt,
      });

      handleApiSuccess('Profile updated', 'Your profile has been successfully updated.');
    } catch (error) {
      handleApiError(error, 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
        <h1 className="text-3xl font-display font-medium text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal information</p>
      </div>

      <div className="grid gap-6">
        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* First Name */}
              <div>
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Last Name */}
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="pl-10"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (currentUser) {
                      // Use firstName/lastName directly, fallback to parsing name
                      const firstName = currentUser.firstName || (currentUser.name || '').split(' ')[0] || '';
                      const lastName =
                        currentUser.lastName || (currentUser.name || '').split(' ').slice(1).join(' ') || '';
                      setFormData({
                        firstName,
                        lastName,
                        email: currentUser.email || '',
                        phone: currentUser.phone || '',
                      });
                    }
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Account Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>View your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role */}
            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Role</p>
                  <p className="text-xs text-muted-foreground">Your access level</p>
                </div>
              </div>
              <Badge variant="secondary">{currentUser.role}</Badge>
            </div>

            {/* User ID */}
            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">User ID</p>
                  <p className="text-xs text-muted-foreground">Unique identifier</p>
                </div>
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{currentUser.id.slice(0, 8)}...</code>
            </div>

            {/* Created Date */}
            {currentUser.createdAt && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Member Since</p>
                    <p className="text-xs text-muted-foreground">Account creation date</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(currentUser.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
