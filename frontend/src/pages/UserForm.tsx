import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { userService } from '@/services/user.service';
import type { CreateUserData, UpdateUserData, UserRole } from '@/types/user.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const userFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal('')),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.string(),
  department: z.string().optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  mode: 'create' | 'edit';
}

export default function UserForm({ mode }: UserFormProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNewUser = mode === 'create';
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, setValue } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
  });

  useEffect(() => {
    if (id && !isNewUser) {
      userService.getUserById(id).then(user => {
        setValue('email', user.email);
        setValue('firstName', user.firstName);
        setValue('lastName', user.lastName);
        setValue('phone', user.phone || '');
        setValue('role', user.role);
        setValue('department', user.department || '');
      });
    }
  }, [id, isNewUser, setValue]);

  const onSubmit = async (data: UserFormData) => {
    try {
      setLoading(true);
      setSubmitError(null);
      if (isNewUser) {
        if (!data.password) {
          setSubmitError('Password required');
          setLoading(false);
          return;
        }
        const createData: CreateUserData = {
          email: data.email,
          password: data.password as string,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role as UserRole,
          department: data.department,
        };
        await userService.createUser(createData);
      } else if (id) {
        const updateData: UpdateUserData = {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || null,
          department: data.department || null,
          password: data.password || undefined,
        };
        await userService.updateUser(id, updateData);
      }
      // Navigate with replace to force component remount
      navigate('/users', { replace: true });
      // Force reload by navigating away and back
      window.location.href = '/users';
    } catch (error) {
      setSubmitError('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/users')}>Back</Button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{isNewUser ? 'Create New User' : 'Edit User'}</CardTitle>
          </CardHeader>
          <CardContent>
            {submitError && <div className="p-4 mb-4 bg-red-50 text-red-800">{submitError}</div>}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...register('password')} />
              </div>
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...register('firstName')} />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...register('lastName')} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register('phone')} />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <select id="role" {...register('role')} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ADMIN">Admin</option>
                  <option value="MERCHANDISER">Merchandiser</option>
                  <option value="PRODUCTION_MANAGER">Production Manager</option>
                  <option value="SALES">Sales</option>
                  <option value="INVENTORY">Inventory</option>
                  <option value="ACCOUNTS">Accounts</option>
                  <option value="QUALITY">Quality</option>
                  <option value="PURCHASE">Purchase</option>
                  <option value="FACTORY_SUPERVISOR">Factory Supervisor</option>
                </select>
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <select id="department" {...register('department')} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select Department --</option>
                  <option value="Merchandising">Merchandising</option>
                  <option value="Production">Production</option>
                  <option value="Cutting">Cutting</option>
                  <option value="Stitching">Stitching</option>
                  <option value="Finishing">Finishing</option>
                  <option value="Checking">Checking</option>
                  <option value="Packing">Packing</option>
                  <option value="Quality Control">Quality Control</option>
                  <option value="Inventory">Inventory/Stores</option>
                  <option value="Sales">Sales/Marketing</option>
                  <option value="Accounts">Accounts/Finance</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Design">Design</option>
                  <option value="Dispatch">Dispatch</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="HR">HR/Admin</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/users')}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isNewUser ? 'Create User' : 'Update User'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}