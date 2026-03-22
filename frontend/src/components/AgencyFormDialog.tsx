import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Agency, CreateAgencyRequest, UpdateAgencyRequest } from '@/types/agency.types';

const agencySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  isActive: z.boolean(),
});

type AgencyFormValues = z.infer<typeof agencySchema>;

interface AgencyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agency?: Agency | null;
  onSubmit: (data: CreateAgencyRequest | UpdateAgencyRequest) => Promise<void>;
  isSubmitting?: boolean;
}

export function AgencyFormDialog({
  open,
  onOpenChange,
  agency,
  onSubmit,
  isSubmitting = false,
}: AgencyFormDialogProps) {
  const isEditing = !!agency;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AgencyFormValues>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      isActive: true,
    },
  });

  const isActive = watch('isActive');

  useEffect(() => {
    if (open) {
      if (agency) {
        reset({
          name: agency.name,
          phone: agency.phone || '',
          email: agency.email || '',
          address: agency.address || '',
          isActive: agency.isActive,
        });
      } else {
        reset({
          name: '',
          phone: '',
          email: '',
          address: '',
          isActive: true,
        });
      }
    }
  }, [open, agency, reset]);

  const handleFormSubmit = async (data: AgencyFormValues) => {
    const submitData: CreateAgencyRequest | UpdateAgencyRequest = {
      name: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      isActive: data.isActive,
    };
    await onSubmit(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Agency' : 'Create Agency'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="Enter agency name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="Enter phone number" {...register('phone')} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter email address" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" placeholder="Enter address" rows={2} {...register('address')} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch id="isActive" checked={isActive} onCheckedChange={(checked) => setValue('isActive', checked)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
