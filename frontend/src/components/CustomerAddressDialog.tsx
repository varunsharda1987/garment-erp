import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StateSelector from '@/components/StateSelector';
import CitySelector from '@/components/CitySelector';
import type {
  CustomerAddress,
  CustomerAddressType,
  CreateCustomerAddressRequest,
  UpdateCustomerAddressRequest,
} from '@/types/customerAddress.types';
import { CustomerAddressTypeLabels } from '@/types/customerAddress.types';

const addressSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  addressType: z.enum(['SHIP_TO', 'COURIER', 'OFFICE']),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  landmark: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  pincode: z.string().min(1, 'Pincode is required'),
  country: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
});

type AddressFormValues = z.infer<typeof addressSchema>;

interface CustomerAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  address?: CustomerAddress | null;
  onSubmit: (data: CreateCustomerAddressRequest | UpdateCustomerAddressRequest) => Promise<void>;
  isSubmitting?: boolean;
}

export function CustomerAddressDialog({
  open,
  onOpenChange,
  customerId,
  address,
  onSubmit,
  isSubmitting = false,
}: CustomerAddressDialogProps) {
  const isEditing = !!address;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: '',
      addressType: 'SHIP_TO',
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      stateId: '',
      cityId: '',
      pincode: '',
      country: 'India',
      contactPerson: '',
      contactPhone: '',
      contactEmail: '',
      isPrimary: false,
      isActive: true,
    },
  });

  const stateId = watch('stateId');
  const isPrimary = watch('isPrimary');
  const isActive = watch('isActive');
  const addressType = watch('addressType');

  useEffect(() => {
    if (open) {
      if (address) {
        reset({
          label: address.label,
          addressType: address.addressType,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2 || '',
          landmark: address.landmark || '',
          stateId: address.stateId || '',
          cityId: address.cityId || '',
          pincode: address.pincode,
          country: address.country || 'India',
          contactPerson: address.contactPerson || '',
          contactPhone: address.contactPhone || '',
          contactEmail: address.contactEmail || '',
          isPrimary: address.isPrimary,
          isActive: address.isActive,
        });
      } else {
        reset({
          label: '',
          addressType: 'SHIP_TO',
          addressLine1: '',
          addressLine2: '',
          landmark: '',
          stateId: '',
          cityId: '',
          pincode: '',
          country: 'India',
          contactPerson: '',
          contactPhone: '',
          contactEmail: '',
          isPrimary: false,
          isActive: true,
        });
      }
    }
  }, [open, address, reset]);

  // Clear city when state changes
  useEffect(() => {
    if (!address || address.stateId !== stateId) {
      setValue('cityId', '');
    }
  }, [stateId, address, setValue]);

  const handleFormSubmit = async (data: AddressFormValues) => {
    const submitData: CreateCustomerAddressRequest | UpdateCustomerAddressRequest = {
      ...(isEditing ? {} : { customerId }),
      label: data.label,
      addressType: data.addressType as CustomerAddressType,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      landmark: data.landmark || null,
      stateId: data.stateId || null,
      cityId: data.cityId || null,
      pincode: data.pincode,
      country: data.country || 'India',
      contactPerson: data.contactPerson || null,
      contactPhone: data.contactPhone || null,
      contactEmail: data.contactEmail || null,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
    };
    await onSubmit(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Address' : 'Add Address'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="grid gap-4 py-4">
            {/* Row 1: Label and Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="label">Label *</Label>
                <Input id="label" placeholder="e.g., Mumbai Warehouse" {...register('label')} />
                {errors.label && <p className="text-sm text-destructive">{errors.label.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="addressType">Address Type *</Label>
                <Select
                  value={addressType}
                  onValueChange={(value) => setValue('addressType', value as CustomerAddressType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CustomerAddressTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Address Line 1 */}
            <div className="grid gap-2">
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Input id="addressLine1" placeholder="Building, Street" {...register('addressLine1')} />
              {errors.addressLine1 && <p className="text-sm text-destructive">{errors.addressLine1.message}</p>}
            </div>

            {/* Row 3: Address Line 2 */}
            <div className="grid gap-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input id="addressLine2" placeholder="Area, Locality" {...register('addressLine2')} />
            </div>

            {/* Row 4: Landmark */}
            <div className="grid gap-2">
              <Label htmlFor="landmark">Landmark</Label>
              <Input id="landmark" placeholder="Near..." {...register('landmark')} />
            </div>

            {/* Row 5: State, City, Pincode */}
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>State</Label>
                <StateSelector
                  value={stateId || ''}
                  onChange={(value) => setValue('stateId', value ?? undefined)}
                  stateType="ALL"
                />
              </div>

              <div className="grid gap-2">
                <Label>City</Label>
                <CitySelector
                  value={watch('cityId') || ''}
                  stateId={stateId || ''}
                  onChange={(value) => setValue('cityId', value ?? undefined)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input id="pincode" placeholder="400001" {...register('pincode')} />
                {errors.pincode && <p className="text-sm text-destructive">{errors.pincode.message}</p>}
              </div>
            </div>

            {/* Row 6: Contact Person and Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input id="contactPerson" placeholder="Name" {...register('contactPerson')} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input id="contactPhone" placeholder="Phone number" {...register('contactPhone')} />
              </div>
            </div>

            {/* Row 7: Contact Email */}
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input id="contactEmail" placeholder="email@example.com" {...register('contactEmail')} />
              {errors.contactEmail && <p className="text-sm text-destructive">{errors.contactEmail.message}</p>}
            </div>

            {/* Row 8: Switches */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="isPrimary"
                  checked={isPrimary}
                  onCheckedChange={(checked) => setValue('isPrimary', checked)}
                />
                <Label htmlFor="isPrimary" className="cursor-pointer">
                  Primary Address
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
