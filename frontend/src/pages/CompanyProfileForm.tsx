import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { validators } from '@/lib/validators';
import {
  createCompanyProfile,
  getCompanyProfileById,
  updateCompanyProfile,
  uploadCompanyLogo,
  uploadCompanySignature,
} from '@/services/companyProfile.service';
import { COMPANY_PROFILE_QUERY_KEY } from '@/hooks/useCompanyProfile';
import { ArrowLeft, Loader2, Save, Upload, Building2, AlertCircle } from 'lucide-react';

/** Mirrors backend/src/schemas/companyProfile.schema.ts. */
const schema = z
  .object({
    name: validators.required('Trading name'),
    legalName: validators.required('Legal name'),
    gstin: validators.gstRequired,
    pan: validators.pan,
    msmeNumber: z.string().max(50).optional().or(z.literal('')),
    cin: z.string().max(30).optional().or(z.literal('')),
    iec: z.string().max(20).optional().or(z.literal('')),
    tan: z.string().max(20).optional().or(z.literal('')),

    stateCode: z
      .string()
      .length(2, 'State code must be 2 digits')
      .regex(/^[0-9]{2}$/, 'State code must be 2 digits'),
    stateName: validators.required('State name'),
    address: validators.required('Address'),
    city: validators.required('City'),
    pincode: validators.pincodeRequired,
    phone: validators.phone,
    email: validators.email,
    contactPerson: z.string().max(150).optional().or(z.literal('')),
    contactPhone: validators.phone,
    contactEmail: validators.email,
    website: z.string().max(255).optional().or(z.literal('')),

    bankName: z.string().max(150).optional().or(z.literal('')),
    bankBranch: z.string().max(150).optional().or(z.literal('')),
    bankAccountNumber: validators.bankAccount,
    bankIfscCode: validators.ifsc,

    tagline: z.string().max(200).optional().or(z.literal('')),
    invoiceTerms: z.string().max(2000).optional().or(z.literal('')),
    jurisdiction: z.string().max(200).optional().or(z.literal('')),
    brandColorPrimary: z.string().optional().or(z.literal('')),
    brandColorAccent: z.string().optional().or(z.literal('')),
    brandColorHeader: z.string().optional().or(z.literal('')),
    brandColorText: z.string().optional().or(z.literal('')),
    brandColorMuted: z.string().optional().or(z.literal('')),
  })
  // The GSTIN's first two digits ARE the state code. A mismatch is exactly what silently
  // flips CGST/SGST to IGST on every document this entity issues.
  .superRefine((data, ctx) => {
    if (data.gstin && data.stateCode && data.gstin.slice(0, 2) !== data.stateCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateCode'],
        message: `Must match the GSTIN prefix (${data.gstin.slice(0, 2)})`,
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '',
  legalName: '',
  gstin: '',
  pan: '',
  msmeNumber: '',
  cin: '',
  iec: '',
  tan: '',
  stateCode: '',
  stateName: '',
  address: '',
  city: '',
  pincode: '',
  phone: '',
  email: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  website: '',
  bankName: '',
  bankBranch: '',
  bankAccountNumber: '',
  bankIfscCode: '',
  tagline: '',
  invoiceTerms: '',
  jurisdiction: '',
  brandColorPrimary: '',
  brandColorAccent: '',
  brandColorHeader: '',
  brandColorText: '',
  brandColorMuted: '',
};

const assetBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

interface Props {
  mode: 'create' | 'edit';
}

export default function CompanyProfileForm({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const signatureInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<'logo' | 'signature' | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['company-profiles', id],
    queryFn: () => getCompanyProfileById(id as string),
    enabled: mode === 'edit' && Boolean(id),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (!profile) return;
    reset({
      ...EMPTY,
      ...(Object.fromEntries(
        Object.keys(EMPTY).map((k) => [k, (profile as unknown as Record<string, unknown>)[k] ?? ''])
      ) as FormValues),
    });
  }, [profile, reset]);

  // Derive the state code from the GSTIN so the two cannot disagree by a typo.
  const gstin = watch('gstin');
  useEffect(() => {
    if (gstin && gstin.length >= 2 && /^[0-9]{2}$/.test(gstin.slice(0, 2))) {
      setValue('stateCode', gstin.slice(0, 2), { shouldValidate: true });
    }
  }, [gstin, setValue]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      mode === 'create' ? createCompanyProfile(values as never) : updateCompanyProfile(id as string, values as never),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['company-profiles'] });
      queryClient.invalidateQueries({ queryKey: COMPANY_PROFILE_QUERY_KEY });
      handleApiSuccess(mode === 'create' ? 'Entity created' : 'Company profile saved', `${saved.name} has been saved.`);
      if (mode === 'create') navigate(`/settings/company/${saved.id}`, { replace: true });
    },
    onError: (error) => handleApiError(error, 'Could not save the company profile'),
  });

  const upload = async (kind: 'logo' | 'signature', file: File) => {
    if (!id) return;
    try {
      setUploading(kind);
      await (kind === 'logo' ? uploadCompanyLogo : uploadCompanySignature)(id, file);
      queryClient.invalidateQueries({ queryKey: ['company-profiles', id] });
      queryClient.invalidateQueries({ queryKey: COMPANY_PROFILE_QUERY_KEY });
      handleApiSuccess('Image uploaded', `The ${kind} has been updated.`);
    } catch (error) {
      handleApiError(error, `Could not upload the ${kind}`);
    } finally {
      setUploading(null);
    }
  };

  if (mode === 'edit' && isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const field = (name: keyof FormValues, label: string, opts: { required?: boolean; placeholder?: string } = {}) => (
    <div>
      <Label htmlFor={name}>
        {label} {opts.required && <span className="text-destructive">*</span>}
      </Label>
      <Input id={name} className="mt-1" placeholder={opts.placeholder} {...register(name)} />
      {errors[name] && <p className="text-sm text-destructive mt-1">{errors[name]?.message as string}</p>}
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/settings/company')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> All entities
          </Button>
          <h1 className="text-3xl font-display font-medium text-foreground">
            {mode === 'create' ? 'New company entity' : profile?.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {mode === 'create'
              ? 'Add another legal entity you invoice as.'
              : 'These details appear on every invoice, purchase order and challan.'}
          </p>
        </div>
        {profile?.isDefault && <Badge className="mt-10">Default</Badge>}
      </div>

      <form onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Tabs defaultValue="identity">
          <TabsList>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="address">Address &amp; contact</TabsTrigger>
            <TabsTrigger value="bank">Bank</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="terms">Terms</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Identity &amp; statutory numbers</CardTitle>
                <CardDescription>Printed on the letterhead of every statutory document.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {field('name', 'Trading name', { required: true, placeholder: 'KASHAYA FABS' })}
                {field('legalName', 'Legal name', { required: true })}
                {field('gstin', 'GSTIN', { required: true, placeholder: '08DCDPS0146D1ZU' })}
                {field('pan', 'PAN', { placeholder: 'DCDPS0146D' })}
                {field('msmeNumber', 'Udyam / MSME number', { placeholder: 'UDYAM-RJ-17-0028194' })}
                {field('cin', 'CIN')}
                {field('iec', 'IEC (import-export code)')}
                {field('tan', 'TAN')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="address" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Address &amp; contact</CardTitle>
                <CardDescription>
                  The main phone and email are the accounts contact printed on invoices. The lab contact below is who a
                  buyer&apos;s testing lab rings about a test requirement form — deliberately separate.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">{field('address', 'Address', { required: true })}</div>
                {field('city', 'City', { required: true })}
                {field('pincode', 'PIN code', { required: true })}
                <div>
                  <Label htmlFor="stateCode">
                    State code <span className="text-destructive">*</span>
                  </Label>
                  <Input id="stateCode" className="mt-1" readOnly {...register('stateCode')} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Derived from the GSTIN. Drives CGST/SGST vs IGST on every document.
                  </p>
                  {errors.stateCode && <p className="text-sm text-destructive mt-1">{errors.stateCode.message}</p>}
                </div>
                {field('stateName', 'State name', { required: true, placeholder: 'Rajasthan' })}
                {field('phone', 'Phone (accounts)', { placeholder: '8890729433' })}
                {field('email', 'Email (accounts)')}
                {field('website', 'Website')}
                <div className="sm:col-span-2 border-t pt-4 mt-2">
                  <p className="text-sm font-medium mb-3">Lab / test-report contact</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {field('contactPerson', 'Contact name')}
                    {field('contactPhone', 'Contact phone')}
                    {field('contactEmail', 'Contact email')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bank" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Bank details</CardTitle>
                <CardDescription>Used on proforma invoices when no primary bank account is configured.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {field('bankName', 'Bank name')}
                {field('bankBranch', 'Branch')}
                {field('bankAccountNumber', 'Account number')}
                {field('bankIfscCode', 'IFSC code', { placeholder: 'ICIC0005325' })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>Logo, signature and the colours used in generated PDFs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {mode === 'create' ? (
                  <div className="flex items-start gap-3 p-4 bg-info-muted border border-info/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-info mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-info">Save the entity first, then add a logo and signature.</p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {[
                      ['logo', 'Company logo', profile?.logoUrl, logoInput] as const,
                      ['signature', 'Authorised signature', profile?.signatureUrl, signatureInput] as const,
                    ].map(([kind, label, url, ref]) => (
                      <div key={kind} className="border rounded-lg p-4">
                        <p className="text-sm font-medium mb-3">{label}</p>
                        <div className="h-24 flex items-center justify-center bg-muted/40 rounded mb-3 overflow-hidden">
                          {url ? (
                            <img src={`${assetBase}${url}`} alt={label} className="max-h-24 object-contain" />
                          ) : (
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <input
                          ref={ref}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void upload(kind, f);
                            e.target.value = '';
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={uploading === kind}
                          onClick={() => ref.current?.click()}
                        >
                          {uploading === kind ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-1" />
                          )}
                          {url ? 'Replace' : 'Upload'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  {field('tagline', 'Tagline', {
                    placeholder: 'Proprietorship · Contract & Private Label Manufacturing',
                  })}
                </div>

                <div className="grid gap-4 sm:grid-cols-5">
                  {(
                    [
                      ['brandColorPrimary', 'Primary'],
                      ['brandColorAccent', 'Accent'],
                      ['brandColorHeader', 'Header'],
                      ['brandColorText', 'Text'],
                      ['brandColorMuted', 'Muted'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <Label htmlFor={key}>{label}</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          aria-label={`${label} colour`}
                          className="h-9 w-10 rounded border cursor-pointer bg-transparent"
                          value={watch(key) || '#000000'}
                          onChange={(e) => setValue(key, e.target.value, { shouldDirty: true })}
                        />
                        <Input id={key} className="flex-1" placeholder="#B85C38" {...register(key)} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Invoice terms</CardTitle>
                <CardDescription>Printed at the foot of invoices and orders.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="invoiceTerms">Terms &amp; conditions</Label>
                  <Textarea
                    id="invoiceTerms"
                    className="mt-1"
                    rows={6}
                    placeholder={'Goods once sold will not be taken back.\nE. & O.E.\nPayment terms as per agreement.'}
                    {...register('invoiceTerms')}
                  />
                  <p className="text-xs text-muted-foreground mt-1">One term per line.</p>
                </div>
                {field('jurisdiction', 'Jurisdiction', { placeholder: 'Subject to Jaipur jurisdiction only.' })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-3 mt-6 sticky bottom-4">
          <Button type="button" variant="outline" onClick={() => navigate('/settings/company')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || save.isPending || (mode === 'edit' && !isDirty)}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {mode === 'create' ? 'Create entity' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
