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
import type {
  CustomerContact,
  CreateCustomerContactRequest,
  UpdateCustomerContactRequest,
} from '@/types/customerContact.types';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  designation: z.string().optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface CustomerContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  contact?: CustomerContact | null;
  onSubmit: (data: CreateCustomerContactRequest | UpdateCustomerContactRequest) => Promise<void>;
  isSubmitting?: boolean;
}

export function CustomerContactDialog({
  open,
  onOpenChange,
  customerId,
  contact,
  onSubmit,
  isSubmitting = false,
}: CustomerContactDialogProps) {
  const isEditing = !!contact;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      designation: '',
      phone: '',
      alternatePhone: '',
      email: '',
      whatsapp: '',
      isPrimary: false,
      isActive: true,
      notes: '',
    },
  });

  const isPrimary = watch('isPrimary');
  const isActive = watch('isActive');

  useEffect(() => {
    if (open) {
      if (contact) {
        reset({
          name: contact.name,
          designation: contact.designation || '',
          phone: contact.phone || '',
          alternatePhone: contact.alternatePhone || '',
          email: contact.email || '',
          whatsapp: contact.whatsapp || '',
          isPrimary: contact.isPrimary,
          isActive: contact.isActive,
          notes: contact.notes || '',
        });
      } else {
        reset({
          name: '',
          designation: '',
          phone: '',
          alternatePhone: '',
          email: '',
          whatsapp: '',
          isPrimary: false,
          isActive: true,
          notes: '',
        });
      }
    }
  }, [open, contact, reset]);

  const handleFormSubmit = async (data: ContactFormValues) => {
    const submitData: CreateCustomerContactRequest | UpdateCustomerContactRequest = {
      ...(isEditing ? {} : { customerId }),
      name: data.name,
      designation: data.designation || null,
      phone: data.phone || null,
      alternatePhone: data.alternatePhone || null,
      email: data.email || null,
      whatsapp: data.whatsapp || null,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
      notes: data.notes || null,
    };
    await onSubmit(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="grid gap-4 py-4">
            {/* Row 1: Name and Designation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" placeholder="Contact name" {...register('name')} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" placeholder="e.g., Buying Head" {...register('designation')} />
              </div>
            </div>

            {/* Row 2: Phone and Alternate Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="Phone number" {...register('phone')} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="alternatePhone">Alternate Phone</Label>
                <Input id="alternatePhone" placeholder="Alternate number" {...register('alternatePhone')} />
              </div>
            </div>

            {/* Row 3: Email and WhatsApp */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="email@example.com" {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" placeholder="WhatsApp number" {...register('whatsapp')} />
              </div>
            </div>

            {/* Row 4: Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="e.g., Best time to call: 10am-12pm" rows={2} {...register('notes')} />
            </div>

            {/* Row 5: Switches */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="isPrimary"
                  checked={isPrimary}
                  onCheckedChange={(checked) => setValue('isPrimary', checked)}
                />
                <Label htmlFor="isPrimary" className="cursor-pointer">
                  Primary Contact
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch id="isActive" checked={isActive} onCheckedChange={(checked) => setValue('isActive', checked)} />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
