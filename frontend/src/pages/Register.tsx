import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authService } from '@/services/auth.service';
import { CheckCircle, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Available roles for self-registration (excluding ADMIN)
const AVAILABLE_ROLES = [
  { value: 'SALES', label: 'Sales' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'ACCOUNTS', label: 'Accounts' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'PRODUCTION_MANAGER', label: 'Production Manager' },
  { value: 'FACTORY_SUPERVISOR', label: 'Factory Supervisor' },
  { value: 'MERCHANDISER', label: 'Merchandiser' },
];

// Validation schema
const registerSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    role: z.string().optional(), // BUG-ADM3 fix: optional since admin assigns actual role
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError('');

    try {
      // Note: role is assigned by admin after registration (defaults to SALES)
      const registerData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
      };
      const response = await authService.register(registerData);

      // Registration successful - show pending approval message
      setIsSuccess(true);
      setSuccessMessage(response.message || 'Registration successful. Your account is pending admin approval.');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const errorMessage = axiosError.response?.data?.message || 'Registration failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-success-muted rounded-full">
                <CheckCircle className="h-12 w-12 text-success" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center text-success">Registration Submitted</CardTitle>
            <CardDescription className="text-center">{successMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-warning-muted border border-warning/20 text-warning px-4 py-3 rounded-md text-sm">
              <p className="font-medium">What happens next?</p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>An administrator will review your request</li>
                <li>You will be able to log in once approved</li>
                <li>Contact your administrator if urgent</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="text-4xl">🏭</div>
          </div>
          <CardTitle className="text-2xl text-center">Create an Account</CardTitle>
          <CardDescription className="text-center">Enter your information to request access</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" type="text" placeholder="John" {...register('firstName')} disabled={isLoading} />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" type="text" placeholder="Doe" {...register('lastName')} disabled={isLoading} />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone Number <span className="text-muted-foreground text-xs">(Optional)</span>
              </Label>
              <Input id="phone" type="tel" placeholder="+91 98765 43210" {...register('phone')} disabled={isLoading} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>

            {/* BUG-ADM3 fix: Clarify that role is a preference, not assignment */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="role">
                  Preferred Role <span className="text-muted-foreground text-xs">(Optional)</span>
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger type="button" tabIndex={-1}>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px]">
                      <p>
                        This is your preferred role. The administrator will assign your actual role when approving your
                        account.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select value={selectedRole} onValueChange={(value) => setValue('role', value)} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your preferred role" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The administrator will assign your actual role during approval.
              </p>
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                disabled={isLoading}
              />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            {/* BUG-ADM3 fix: Clarify both approval and role assignment */}
            <div className="bg-info-muted border border-info/20 text-info px-4 py-3 rounded-md text-sm">
              Your account will require admin approval before you can log in. The administrator will also assign your
              role based on your responsibilities.
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'Request Access'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-info hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
