/**
 * Permission Management Page
 * Admin-only page to view and edit role permissions
 */

import { useState, useEffect, useMemo } from 'react';
import { Download, Filter, RotateCcw, History, ChevronDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { UserRole } from '@/types/user.types';
import { getPermissionMatrix, togglePermission, resetToDefaults, getAuditLog } from '@/services/permission.service';
import type { PermissionMatrixResponse, PermissionAuditEntry } from '@/types/permission.types';

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

export default function PermissionManagement() {
  const [matrix, setMatrix] = useState<PermissionMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [auditLogs, setAuditLogs] = useState<PermissionAuditEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const allRoles = Object.values(UserRole);

  // Load permission matrix
  useEffect(() => {
    loadMatrix();
  }, []);

  const loadMatrix = async () => {
    try {
      setLoading(true);
      const data = await getPermissionMatrix();
      setMatrix(data);
    } catch (error) {
      console.error('Failed to load permission matrix:', error);
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  // Load audit log
  const loadAuditLog = async () => {
    try {
      setLoadingAudit(true);
      const data = await getAuditLog({ limit: 20 });
      setAuditLogs(data.logs);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Handle audit log toggle
  const handleAuditToggle = (open: boolean) => {
    setShowAuditLog(open);
    if (open && auditLogs.length === 0) {
      loadAuditLog();
    }
  };

  // Get unique categories from matrix
  const allCategories = useMemo(() => {
    if (!matrix) return [];
    const categories = new Set(matrix.permissions.map((p) => p.moduleGroup));
    return Array.from(categories);
  }, [matrix]);

  // Filter permissions
  const filteredPermissions = useMemo(() => {
    if (!matrix) return [];

    let permissions = matrix.permissions;

    // Filter by category
    if (selectedCategory !== 'all') {
      permissions = permissions.filter((p) => p.moduleGroup === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      permissions = permissions.filter(
        (p) => p.displayName.toLowerCase().includes(search) || p.permissionKey.toLowerCase().includes(search)
      );
    }

    return permissions;
  }, [matrix, selectedCategory, searchTerm]);

  // Get roles to display
  const displayRoles = useMemo(() => {
    if (selectedRole === 'all') return allRoles;
    return [selectedRole as UserRole];
  }, [selectedRole, allRoles]);

  // Handle permission toggle
  const handleToggle = async (role: UserRole, permissionKey: string, newValue: boolean) => {
    if (!matrix) return;

    const saveKey = `${role}:${permissionKey}`;
    setSaving(saveKey);

    // Optimistic update
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        permissions: prev.permissions.map((p) =>
          p.permissionKey === permissionKey ? { ...p, roles: { ...p.roles, [role]: newValue } } : p
        ),
      };
    });

    try {
      await togglePermission({ role, permissionKey, allowed: newValue });
      toast.success(`${newValue ? 'Enabled' : 'Disabled'} ${permissionKey} for ${ROLE_CONFIG[role]?.name || role}`);
    } catch {
      // Rollback on error
      setMatrix((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          permissions: prev.permissions.map((p) =>
            p.permissionKey === permissionKey ? { ...p, roles: { ...p.roles, [role]: !newValue } } : p
          ),
        };
      });
      toast.error('Failed to update permission');
    } finally {
      setSaving(null);
    }
  };

  // Handle reset to defaults
  const handleResetToDefaults = async () => {
    try {
      setResetting(true);
      const result = await resetToDefaults();
      toast.success(`Reset ${result.reset} permissions to defaults`);
      await loadMatrix();
    } catch {
      toast.error('Failed to reset permissions');
    } finally {
      setResetting(false);
    }
  };

  // Export as CSV
  const exportToCSV = () => {
    if (!matrix) return;

    const headers = ['Module', 'Permission', ...allRoles.map((r) => ROLE_CONFIG[r]?.name || r)];
    const rows = matrix.permissions.map((perm) => {
      const accessLevels = allRoles.map((role) => (perm.roles[role] ? 'Yes' : 'No'));
      return [perm.moduleGroup, perm.displayName, ...accessLevels];
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

  // Calculate role stats
  const roleStats: Record<string, { total: number; enabled: number }> = useMemo(() => {
    if (!matrix) return {};

    const stats: Record<string, { total: number; enabled: number }> = {};
    const totalPermissions = matrix.permissions.length;

    allRoles.forEach((role) => {
      let enabled = 0;
      matrix.permissions.forEach((perm) => {
        if (perm.roles[role]) enabled++;
      });
      stats[role] = { total: totalPermissions, enabled };
    });

    return stats;
  }, [matrix, allRoles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permission Management</h1>
          <p className="text-gray-500 mt-1">Configure which roles can access each feature in the system</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resetting}>
                {resetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Reset to Defaults
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset All Permissions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all permissions to their default configuration. Any custom permission changes you have
                  made will be lost. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetToDefaults}>Yes, Reset All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {allRoles.map((role) => (
          <Card
            key={role}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedRole(selectedRole === role ? 'all' : role)}
          >
            <CardContent className="p-4">
              <Badge className={ROLE_CONFIG[role]?.color || 'bg-gray-100'}>{ROLE_CONFIG[role]?.name || role}</Badge>
              <div className="mt-2 text-sm text-gray-500">
                <span className="font-medium text-green-600">{roleStats[role]?.enabled || 0}</span>
                {' / '}
                <span>{roleStats[role]?.total || 0}</span>
                <span className="ml-1">modules</span>
              </div>
              {selectedRole === role && <div className="mt-1 text-xs text-blue-600">Click to clear filter</div>}
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
                placeholder="Search permissions..."
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
                      {ROLE_CONFIG[role]?.name || role}
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
              <div className="flex items-center gap-2">
                <div className="w-8 h-5 bg-primary rounded-full" />
                <span>Enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-5 bg-gray-200 rounded-full" />
                <span>Disabled</span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] sticky left-0 bg-white z-10">Permission</TableHead>
                  {displayRoles.map((role) => (
                    <TableHead key={role} className="text-center min-w-[100px]">
                      <Badge className={ROLE_CONFIG[role]?.color || 'bg-gray-100'}>
                        {ROLE_CONFIG[role]?.name || role}
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermissions.map((perm) => (
                  <TableRow key={perm.permissionKey}>
                    <TableCell className="font-medium sticky left-0 bg-white z-10">
                      <div>
                        <div>{perm.displayName}</div>
                        <div className="text-xs text-gray-400">{perm.moduleGroup}</div>
                      </div>
                    </TableCell>
                    {displayRoles.map((role) => {
                      const isDisabled =
                        saving === `${role}:${perm.permissionKey}` ||
                        (role === UserRole.ADMIN && perm.permissionKey === 'admin');
                      const isSaving = saving === `${role}:${perm.permissionKey}`;

                      return (
                        <TableCell key={role} className="text-center">
                          <div className="flex justify-center items-center">
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : (
                              <Switch
                                checked={perm.roles[role]}
                                onCheckedChange={(checked) => handleToggle(role, perm.permissionKey, checked)}
                                disabled={isDisabled}
                                className="scale-90"
                              />
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {filteredPermissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={displayRoles.length + 1} className="text-center text-gray-500 py-8">
                      No permissions found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Collapsible open={showAuditLog} onOpenChange={handleAuditToggle}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Changes
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${showAuditLog ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {loadingAudit ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No permission changes recorded yet</div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">
                          {log.newValues?.allowed ? 'Enabled' : 'Disabled'}{' '}
                          <span className="text-blue-600">{log.newValues?.permissionKey}</span>
                          {' for '}
                          <Badge className={ROLE_CONFIG[log.newValues?.role as UserRole]?.color || 'bg-gray-100'}>
                            {ROLE_CONFIG[log.newValues?.role as UserRole]?.name || log.newValues?.role}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          by {log.user?.firstName} {log.user?.lastName}
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
