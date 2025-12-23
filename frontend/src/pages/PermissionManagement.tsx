/**
 * Permission Management Page
 * Admin-only page to visualize what each role can access
 */

import { useState, useMemo } from 'react';
import { Check, X, Minus, Download, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PERMISSIONS, type PermissionKey } from '@/config/permissions.config';
import { UserRole } from '@/types/user.types';

// Define module categories for better organization
const MODULE_CATEGORIES = {
  'Core': ['dashboard', 'users'],
  'Sales & CRM': ['orders', 'quotations', 'customers', 'styles', 'bom', 'costSheets'],
  'Production': ['workOrders', 'cutting', 'stitching', 'finishing', 'dispatch', 'samples', 'productionStatus'],
  'Procurement': ['suppliers', 'purchaseOrders', 'grn', 'mrp'],
  'Inventory': ['inventory', 'warehouses', 'stockMovements', 'greige', 'fabric'],
  'Materials': ['materials', 'trims', 'embroidery', 'colors', 'componentMasters', 'componentGroups', 'productCategories', 'sizeCategories'],
  'Finance': ['invoices', 'chartOfAccounts'],
  'Quality': ['testing', 'fabricTests', 'garmentTests', 'testingLabs', 'testTemplates'],
  'Processing': ['processing', 'printing', 'dyeing'],
  'System': ['admin', 'processGuide', 'aiAssistant'],
} as const;

// Role display names and colors
const ROLE_CONFIG: Record<UserRole, { name: string; color: string }> = {
  [UserRole.ADMIN]: { name: 'Admin', color: 'bg-purple-100 text-purple-800' },
  [UserRole.MERCHANDISER]: { name: 'Merchandiser', color: 'bg-blue-100 text-blue-800' },
  [UserRole.PRODUCTION_MANAGER]: { name: 'Production Mgr', color: 'bg-green-100 text-green-800' },
  [UserRole.SALES]: { name: 'Sales', color: 'bg-yellow-100 text-yellow-800' },
  [UserRole.ACCOUNTS]: { name: 'Accounts', color: 'bg-orange-100 text-orange-800' },
  [UserRole.INVENTORY]: { name: 'Inventory', color: 'bg-cyan-100 text-cyan-800' },
  [UserRole.QUALITY]: { name: 'Quality', color: 'bg-pink-100 text-pink-800' },
  [UserRole.PURCHASE]: { name: 'Purchase', color: 'bg-indigo-100 text-indigo-800' },
  [UserRole.FACTORY_SUPERVISOR]: { name: 'Factory Sup.', color: 'bg-teal-100 text-teal-800' },
};

// Permission key to display name mapping
const PERMISSION_DISPLAY_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'User Management',
  orders: 'Orders',
  quotations: 'Quotations',
  customers: 'Customers',
  suppliers: 'Suppliers',
  styles: 'Style Master',
  bom: 'Bill of Materials',
  costSheets: 'Cost Sheets',
  workOrders: 'Work Orders',
  cutting: 'Cutting',
  stitching: 'Stitching',
  finishing: 'Finishing',
  dispatch: 'Dispatch',
  samples: 'Samples',
  productionStatus: 'Production Status',
  purchaseOrders: 'Purchase Orders',
  grn: 'GRN',
  mrp: 'MRP',
  inventory: 'Inventory',
  warehouses: 'Warehouses',
  stockMovements: 'Stock Movements',
  greige: 'Greige Fabric',
  fabric: 'Finished Fabric',
  materials: 'Raw Materials',
  trims: 'Trim Masters',
  embroidery: 'Embroidery',
  colors: 'Color Master',
  componentMasters: 'Component Masters',
  componentGroups: 'Component Groups',
  productCategories: 'Product Categories',
  sizeCategories: 'Size Categories',
  invoices: 'Invoices',
  chartOfAccounts: 'Chart of Accounts',
  testing: 'Testing Dashboard',
  fabricTests: 'Fabric Tests',
  garmentTests: 'Garment Tests',
  testingLabs: 'Testing Labs',
  testTemplates: 'Test Templates',
  processing: 'Job Work Processing',
  printing: 'Printing',
  dyeing: 'Dyeing',
  admin: 'Admin Tools',
  processGuide: 'Process Guide',
  aiAssistant: 'AI Assistant',
};

type AccessLevel = 'full' | 'partial' | 'none';

function getAccessLevel(permissionKey: PermissionKey, role: UserRole): AccessLevel {
  const allowedRoles = PERMISSIONS[permissionKey];
  if (!allowedRoles) return 'none';

  // Admin always has full access
  if (role === UserRole.ADMIN) return 'full';

  // Check if role has access
  if (allowedRoles.includes(role)) return 'full';

  return 'none';
}

function AccessIcon({ level }: { level: AccessLevel }) {
  switch (level) {
    case 'full':
      return <Check className="h-4 w-4 text-green-600" />;
    case 'partial':
      return <Minus className="h-4 w-4 text-yellow-600" />;
    case 'none':
      return <X className="h-4 w-4 text-gray-300" />;
  }
}

export default function PermissionManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  const allRoles = Object.values(UserRole);
  const allCategories = Object.keys(MODULE_CATEGORIES);

  // Get filtered permissions based on search and category
  const filteredPermissions = useMemo(() => {
    let permissions: PermissionKey[] = [];

    if (selectedCategory === 'all') {
      // Get all permissions from all categories
      Object.values(MODULE_CATEGORIES).forEach((categoryPermissions) => {
        permissions.push(...(categoryPermissions as PermissionKey[]));
      });
    } else {
      permissions = [...(MODULE_CATEGORIES[selectedCategory as keyof typeof MODULE_CATEGORIES] as PermissionKey[])];
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      permissions = permissions.filter((key) => {
        const displayName = PERMISSION_DISPLAY_NAMES[key] || key;
        return displayName.toLowerCase().includes(search) || key.toLowerCase().includes(search);
      });
    }

    return permissions;
  }, [selectedCategory, searchTerm]);

  // Get roles to display
  const displayRoles = useMemo(() => {
    if (selectedRole === 'all') return allRoles;
    return [selectedRole as UserRole];
  }, [selectedRole, allRoles]);

  // Export as CSV
  const exportToCSV = () => {
    const headers = ['Module', ...allRoles.map((r) => ROLE_CONFIG[r].name)];
    const rows = Object.keys(PERMISSIONS).map((key) => {
      const permKey = key as PermissionKey;
      const displayName = PERMISSION_DISPLAY_NAMES[permKey] || permKey;
      const accessLevels = allRoles.map((role) => {
        const level = getAccessLevel(permKey, role);
        return level === 'full' ? 'Yes' : level === 'partial' ? 'Partial' : 'No';
      });
      return [displayName, ...accessLevels];
    });

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'permission-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate permission stats for each role
  const roleStats = useMemo(() => {
    const stats: Record<UserRole, { total: number; full: number; partial: number }> = {} as Record<UserRole, { total: number; full: number; partial: number }>;
    const totalPermissions = Object.keys(PERMISSIONS).length;

    allRoles.forEach((role) => {
      let full = 0;
      let partial = 0;

      Object.keys(PERMISSIONS).forEach((key) => {
        const level = getAccessLevel(key as PermissionKey, role);
        if (level === 'full') full++;
        else if (level === 'partial') partial++;
      });

      stats[role] = { total: totalPermissions, full, partial };
    });

    return stats;
  }, [allRoles]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permission Management</h1>
          <p className="text-gray-500 mt-1">
            View what each role can access in the system
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {allRoles.map((role) => (
          <Card key={role} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedRole(role)}>
            <CardContent className="p-4">
              <Badge className={ROLE_CONFIG[role].color}>{ROLE_CONFIG[role].name}</Badge>
              <div className="mt-2 text-sm text-gray-500">
                <span className="font-medium text-green-600">{roleStats[role].full}</span>
                {' / '}
                <span>{roleStats[role].total}</span>
                <span className="ml-1">modules</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="w-[200px]">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[200px]">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {allRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_CONFIG[role].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <Check className="h-4 w-4 text-green-600" />
                <span>Full Access</span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="h-4 w-4 text-yellow-600" />
                <span>Partial Access</span>
              </div>
              <div className="flex items-center gap-1">
                <X className="h-4 w-4 text-gray-300" />
                <span>No Access</span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] sticky left-0 bg-white">Module</TableHead>
                  {displayRoles.map((role) => (
                    <TableHead key={role} className="text-center min-w-[100px]">
                      <Badge className={ROLE_CONFIG[role].color}>{ROLE_CONFIG[role].name}</Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermissions.map((permKey) => (
                  <TableRow key={permKey}>
                    <TableCell className="font-medium sticky left-0 bg-white">
                      {PERMISSION_DISPLAY_NAMES[permKey] || permKey}
                    </TableCell>
                    {displayRoles.map((role) => (
                      <TableCell key={role} className="text-center">
                        <div className="flex justify-center">
                          <AccessIcon level={getAccessLevel(permKey, role)} />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {filteredPermissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={displayRoles.length + 1} className="text-center text-gray-500 py-8">
                      No modules found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allCategories.map((category) => {
          const categoryPermissions = MODULE_CATEGORIES[category as keyof typeof MODULE_CATEGORIES];
          return (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{category}</CardTitle>
                <CardDescription>{categoryPermissions.length} modules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(categoryPermissions as readonly PermissionKey[]).map((permKey) => (
                    <div key={permKey} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {PERMISSION_DISPLAY_NAMES[permKey] || permKey}
                      </span>
                      <div className="flex gap-1">
                        {allRoles.slice(0, 5).map((role) => {
                          const level = getAccessLevel(permKey, role);
                          return (
                            <div
                              key={role}
                              className={`w-2 h-2 rounded-full ${
                                level === 'full'
                                  ? 'bg-green-500'
                                  : level === 'partial'
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-200'
                              }`}
                              title={`${ROLE_CONFIG[role].name}: ${level}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
