import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerService } from '@/services/customer.service';
import { customerAddressService } from '@/services/customerAddress.service';
import { customerContactService } from '@/services/customerContact.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CustomerCategory, CustomerType } from '@/types/customer.types';
import type {
  CustomerAddress,
  CreateCustomerAddressRequest,
  UpdateCustomerAddressRequest,
} from '@/types/customerAddress.types';
import { CustomerAddressTypeLabels } from '@/types/customerAddress.types';
import type {
  CustomerContact,
  CreateCustomerContactRequest,
  UpdateCustomerContactRequest,
} from '@/types/customerContact.types';
import { handleApiError } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  Building2,
  MapPin,
  CreditCard,
  Calendar,
  User,
  Percent,
  Plus,
  Copy,
  Star,
  Pencil,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { CustomerAccessoryPresets } from '@/components/CustomerAccessoryPresets';
import { CustomerAddressDialog } from '@/components/CustomerAddressDialog';
import { CustomerContactDialog } from '@/components/CustomerContactDialog';
import { toast } from 'sonner';

interface CustomerGstNumber {
  id: string;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  isPrimary: boolean;
}

interface BrandCategory {
  id: string;
  brandName: string;
  category: string;
}

interface CustomerDetailData {
  id: string;
  code: string;
  name: string;
  type: CustomerType;
  category: CustomerCategory;
  brandNames?: string;
  categories?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstNumber?: string;
  creditLimit?: number;
  creditDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customerGstNumbers?: CustomerGstNumber[];
  brandCategories?: BrandCategory[];
  customerAddresses?: CustomerAddress[];
  customerContacts?: CustomerContact[];
  agent?: {
    id: string;
    code: string;
    name: string;
    phone?: string;
  };
  agentCommissionPercent?: number;
  _count?: {
    orders: number;
    quotations: number;
    invoices: number;
  };
}

export default function CustomerDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [customer, setCustomer] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Address state
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<CustomerAddress | null>(null);
  const [addressSubmitting, setAddressSubmitting] = useState(false);

  // Contact state
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [deletingContact, setDeletingContact] = useState<CustomerContact | null>(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const canEdit =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'SALES' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchCustomerDetails();
      fetchAddresses();
      fetchContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await customerService.getCustomerById(id!);
      setCustomer(data as unknown as CustomerDetailData);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load customer details', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      const data = await customerAddressService.getByCustomerId(id!);
      setAddresses(data);
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const data = await customerContactService.getByCustomerId(id!);
      setContacts(data);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  };

  // Address handlers
  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressDialogOpen(true);
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setEditingAddress(address);
    setAddressDialogOpen(true);
  };

  const handleAddressSubmit = async (data: CreateCustomerAddressRequest | UpdateCustomerAddressRequest) => {
    setAddressSubmitting(true);
    try {
      if (editingAddress) {
        await customerAddressService.update(editingAddress.id, data);
        toast.success('Address updated successfully');
      } else {
        await customerAddressService.create({ ...data, customerId: id! } as CreateCustomerAddressRequest);
        toast.success('Address created successfully');
      }
      setAddressDialogOpen(false);
      fetchAddresses();
    } catch (err) {
      handleApiError(err, 'Failed to save address');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleDeleteAddress = async () => {
    if (!deletingAddress) return;
    try {
      await customerAddressService.delete(deletingAddress.id);
      toast.success('Address deleted successfully');
      setDeletingAddress(null);
      fetchAddresses();
    } catch (err) {
      handleApiError(err, 'Failed to delete address');
    }
  };

  const handleSetPrimaryAddress = async (address: CustomerAddress) => {
    try {
      await customerAddressService.setPrimary(address.id);
      toast.success('Primary address updated');
      fetchAddresses();
    } catch (err) {
      handleApiError(err, 'Failed to set primary address');
    }
  };

  const handleCopyAddress = async (address: CustomerAddress) => {
    try {
      const formatted = await customerAddressService.getFormatted(address.id);
      await navigator.clipboard.writeText(formatted);
      toast.success('Address copied to clipboard');
    } catch (err) {
      handleApiError(err, 'Failed to copy address');
    }
  };

  // Contact handlers
  const handleAddContact = () => {
    setEditingContact(null);
    setContactDialogOpen(true);
  };

  const handleEditContact = (contact: CustomerContact) => {
    setEditingContact(contact);
    setContactDialogOpen(true);
  };

  const handleContactSubmit = async (data: CreateCustomerContactRequest | UpdateCustomerContactRequest) => {
    setContactSubmitting(true);
    try {
      if (editingContact) {
        await customerContactService.update(editingContact.id, data);
        toast.success('Contact updated successfully');
      } else {
        await customerContactService.create({ ...data, customerId: id! } as CreateCustomerContactRequest);
        toast.success('Contact created successfully');
      }
      setContactDialogOpen(false);
      fetchContacts();
    } catch (err) {
      handleApiError(err, 'Failed to save contact');
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;
    try {
      await customerContactService.delete(deletingContact.id);
      toast.success('Contact deleted successfully');
      setDeletingContact(null);
      fetchContacts();
    } catch (err) {
      handleApiError(err, 'Failed to delete contact');
    }
  };

  const handleSetPrimaryContact = async (contact: CustomerContact) => {
    try {
      await customerContactService.setPrimary(contact.id);
      toast.success('Primary contact updated');
      fetchContacts();
    } catch (err) {
      handleApiError(err, 'Failed to set primary contact');
    }
  };

  const getCategoryVariant = (category: CustomerCategory) => {
    switch (category) {
      case 'DOMESTIC':
        return 'warning' as const;
      case 'EXPORT':
        return 'info' as const;
      case 'WHOLESALER':
        return 'success' as const;
      case 'RETAILER':
        return 'default' as const;
      default:
        return 'secondary' as const;
    }
  };

  // Group brand categories by brand name
  const groupedBrandCategories = customer?.brandCategories?.reduce((acc: { [key: string]: string[] }, bc) => {
    if (!acc[bc.brandName]) {
      acc[bc.brandName] = [];
    }
    acc[bc.brandName].push(bc.category);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <header className="bg-card shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error || 'Customer not found'}</p>
              <Button onClick={() => navigate('/customers')} className="mt-4">
                Return to Customers
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
      <header className="bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/customers/${customer.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Customer
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Customer Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-3xl">{customer.name}</CardTitle>
                  <StatusBadge status={customer.category} variant={getCategoryVariant(customer.category)} />
                  <StatusBadge
                    status={customer.isActive ? 'Active' : 'Inactive'}
                    variant={customer.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-muted-foreground">Customer Code: {customer.code}</p>
              </div>
              {customer._count && (
                <div className="text-right text-sm text-muted-foreground">
                  <div>Orders: {customer._count.orders}</div>
                  <div>Quotations: {customer._count.quotations}</div>
                  <div>Invoices: {customer._count.invoices}</div>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="addresses">Addresses ({addresses.length})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customer.contactPerson && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                      <p className="text-foreground">{customer.contactPerson}</p>
                    </div>
                  )}
                  {customer.email && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        Email
                      </label>
                      <p className="text-foreground">{customer.email}</p>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        Phone
                      </label>
                      <p className="text-foreground">{customer.phone}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Brand Categories */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Brand Names & Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groupedBrandCategories && Object.keys(groupedBrandCategories).length > 0 ? (
                    Object.entries(groupedBrandCategories).map(([brandName, categories]) => (
                      <div key={brandName} className="p-3 bg-muted rounded-lg border border-border">
                        <p className="font-medium text-foreground mb-1">{brandName}</p>
                        <div className="flex flex-wrap gap-1">
                          {categories.map((cat, idx) => (
                            <span key={idx} className="inline-block px-2 py-1 bg-info-muted text-info text-xs rounded">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : customer.brandNames ? (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Brand Names</label>
                      <p className="text-foreground whitespace-pre-line">{customer.brandNames}</p>
                      {customer.categories && (
                        <>
                          <label className="text-sm font-medium text-muted-foreground mt-3 block">Categories</label>
                          <p className="text-foreground whitespace-pre-line">{customer.categories}</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No brand information available</p>
                  )}
                </CardContent>
              </Card>

              {/* GST Information */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    GST Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customer.customerGstNumbers && customer.customerGstNumbers.length > 0 ? (
                    <div className="space-y-3">
                      {customer.customerGstNumbers.map((gst) => (
                        <div key={gst.id} className="p-4 bg-info-muted rounded-lg border border-info/20">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">State</label>
                              <p className="text-foreground">
                                {gst.stateName} {gst.stateCode && `(${gst.stateCode})`}
                                {gst.isPrimary && (
                                  <span className="ml-2 inline-block px-2 py-0.5 bg-success-muted text-success text-xs rounded">
                                    Primary
                                  </span>
                                )}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">GST Number</label>
                              <p className="text-foreground font-mono">{gst.gstNumber}</p>
                            </div>
                            {gst.billingAddress && (
                              <div className="md:col-span-2">
                                <label className="text-xs font-medium text-muted-foreground">Billing Address</label>
                                <p className="text-foreground">{gst.billingAddress}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : customer.gstNumber ? (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">GST Number</label>
                      <p className="text-foreground font-mono">{customer.gstNumber}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No GST information available</p>
                  )}
                </CardContent>
              </Card>

              {/* Credit Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Credit Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Credit Limit</label>
                    <p className="text-foreground text-xl font-semibold">
                      {customer.creditLimit ? formatCurrency(customer.creditLimit, { decimals: 0 }) : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Credit Days</label>
                    <p className="text-foreground text-xl font-semibold">
                      {customer.creditDays ? `${customer.creditDays} days` : 'Not set'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Agent Information - Only for WHOLESALER/RETAILER */}
              {(customer.category === 'WHOLESALER' || customer.category === 'RETAILER') && customer.agent && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Agent Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Agent</label>
                      <p className="text-foreground font-medium">
                        {customer.agent.code} - {customer.agent.name}
                      </p>
                      {customer.agent.phone && <p className="text-sm text-muted-foreground">{customer.agent.phone}</p>}
                    </div>
                    {customer.agentCommissionPercent != null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Percent className="h-4 w-4" />
                          Commission
                        </label>
                        <p className="text-foreground text-xl font-semibold">{customer.agentCommissionPercent}%</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* System Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">System Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created At</label>
                    <p className="text-foreground">{new Date(customer.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                    <p className="text-foreground">{new Date(customer.updatedAt).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Addresses
                </CardTitle>
                {canEdit && (
                  <Button onClick={handleAddAddress} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Address
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {addresses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className={`p-4 rounded-lg border ${
                          address.isPrimary ? 'border-warning bg-warning/5' : 'border-border bg-muted/50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{address.label}</span>
                            <span className="px-2 py-0.5 text-xs rounded bg-info-muted text-info">
                              {CustomerAddressTypeLabels[address.addressType]}
                            </span>
                            {address.isPrimary && <Star className="h-4 w-4 text-warning fill-warning" />}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopyAddress(address)}
                                title="Copy address"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              {!address.isPrimary && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleSetPrimaryAddress(address)}
                                  title="Set as primary"
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditAddress(address)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeletingAddress(address)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{address.addressLine1}</p>
                          {address.addressLine2 && <p>{address.addressLine2}</p>}
                          {address.landmark && <p>{address.landmark}</p>}
                          <p>
                            {address.city?.cityName && `${address.city.cityName}, `}
                            {address.state?.stateName && `${address.state.stateName} - `}
                            {address.pincode}
                          </p>
                          {address.contactPerson && (
                            <p className="pt-2 text-foreground">
                              Contact: {address.contactPerson}
                              {address.contactPhone && ` (${address.contactPhone})`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No addresses added yet. Click "Add Address" to add one.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Buyer Contacts
                </CardTitle>
                {canEdit && (
                  <Button onClick={handleAddContact} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {contacts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`p-4 rounded-lg border ${
                          contact.isPrimary ? 'border-warning bg-warning/5' : 'border-border bg-muted/50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{contact.name}</span>
                            {contact.isPrimary && <Star className="h-4 w-4 text-warning fill-warning" />}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              {!contact.isPrimary && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleSetPrimaryContact(contact)}
                                  title="Set as primary"
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditContact(contact)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeletingContact(contact)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {contact.designation && (
                          <p className="text-sm text-muted-foreground mb-2">{contact.designation}</p>
                        )}
                        <div className="text-sm space-y-1">
                          {contact.phone && (
                            <a
                              href={`tel:${contact.phone}`}
                              className="flex items-center gap-2 text-info hover:underline"
                            >
                              <Phone className="h-4 w-4" />
                              {contact.phone}
                            </a>
                          )}
                          {contact.whatsapp && (
                            <a
                              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-success hover:underline"
                            >
                              <MessageCircle className="h-4 w-4" />
                              WhatsApp
                            </a>
                          )}
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-2 text-info hover:underline"
                            >
                              <Mail className="h-4 w-4" />
                              {contact.email}
                            </a>
                          )}
                        </div>
                        {contact.notes && <p className="text-xs text-muted-foreground mt-2 italic">{contact.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No contacts added yet. Click "Add Contact" to add one.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Presets Tab */}
          <TabsContent value="presets">
            <CustomerAccessoryPresets customerId={customer.id} customerName={customer.name} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Address Dialog */}
      <CustomerAddressDialog
        open={addressDialogOpen}
        onOpenChange={setAddressDialogOpen}
        customerId={id!}
        address={editingAddress}
        onSubmit={handleAddressSubmit}
        isSubmitting={addressSubmitting}
      />

      {/* Contact Dialog */}
      <CustomerContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        customerId={id!}
        contact={editingContact}
        onSubmit={handleContactSubmit}
        isSubmitting={contactSubmitting}
      />

      {/* Delete Address Confirmation */}
      <AlertDialog open={!!deletingAddress} onOpenChange={() => setDeletingAddress(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingAddress?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAddress} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Contact Confirmation */}
      <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingContact?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContact} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
