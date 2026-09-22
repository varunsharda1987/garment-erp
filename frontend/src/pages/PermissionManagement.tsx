/**
 * Permission Management Page
 * Admin-only page to view and edit role permissions
 */

import { useState, useEffect, useMemo } from 'react';
import { Download, Filter, RotateCcw, History, ChevronDown, Loader2, ShieldCheck } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { UserRole } from '@/types/user.types';
import {
  getPermissionMatrix,
  togglePermission,
  bulkUpdatePermissions,
  resetToDefaults,
  getAuditLog,
} from '@/services/permission.service';
import type { PermissionMatrixResponse, PermissionAuditEntry } from '@/types/permission.types';
import { formatDateTime } from '@/lib/date';

// Role display names and colors
const ROLE_CONFIG: Record<UserRole, { name: string; color: string }> = {
  [UserRole.ADMIN]: { name: 'Admin', color: 'bg-accent/10 text-accent' },
  [UserRole.MERCHANDISER]: { name: 'Merchandiser', color: 'bg-info-muted text-info' },
  [UserRole.PRODUCTION_MANAGER]: { name: 'Production Mgr', color: 'bg-success-muted text-success' },
  [UserRole.SALES]: { name: 'Sales', color: 'bg-yellow-100 text-yellow-800' },
  [UserRole.ACCOUNTS]: { name: 'Accounts', color: 'bg-orange-100 text-orange-800' },
  [UserRole.INVENTORY]: { name: 'Inventory', color: 'bg-cyan-100 text-cyan-800' },
  [UserRole.QUALITY]: { name: 'Quality', color: 'bg-pink-100 text-pink-800' },
  [UserRole.PURCHASE]: { name: 'Purchase', color: 'bg-primary/10 text-primary' },
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
  // "All on" / "All off" for one role — confirmed in a dialog because it rewrites every switch
  const [bulkTarget, setBulkTarget] = useState<{ role: UserRole; allowed: boolean } | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

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

  // Turn every switch on or off for one role (Admin is always fully on and is never sent)
  const handleBulk = async () => {
    if (!matrix || !bulkTarget) return;
    const { role, allowed } = bulkTarget;
    try {
      setBulkSaving(true);
      const result = await bulkUpdatePermissions(
        matrix.permissions.map((p) => ({ role, permissionKey: p.permissionKey, allowed }))
      );
      if (result.failed > 0) {
        toast.error(`${result.failed} of ${result.updated + result.failed} switches could not be changed`);
      } else {
        toast.success(
          `${allowed ? 'Enabled' : 'Disabled'} all ${result.updated} modules for ${ROLE_CONFIG[role]?.name || role}`
        );
      }
      await loadMatrix();
    } catch {
      toast.error('Failed to update permissions');
    } finally {
      setBulkSaving(false);
      setBulkTarget(null);
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-display font-medium text-foreground">Permission Management</h1>
          <p className="text-muted-foreground mt-1">Configure which roles can access each feature in the system</p>
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
                  This sets every role's switches back to the built-in defaults — a restricted set per role (for
                  example, Sales keeps Orders, Quotations, Invoices, Styles and Customers). Any changes you have made on
                  this page will be lost, and users in those roles lose access to the modules that default to off. This
                  action cannot be undone.
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

      {/* What these switches do */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>These switches are enforced</AlertTitle>
        <AlertDescription>
          A switch that is off blocks that role from creating or changing anything in the module, and hides it from
          their menu. The server applies a change immediately; a signed-in user sees their menu change when they next
          reload the app or sign in. Everyone can still look things up. <strong>Admin always has full access</strong> —
          its column cannot be changed, and user management, this page, audit and integration settings are always
          admin-only.
        </AlertDescription>
      </Alert>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {allRoles.map((role) => (
          <Card
            key={role}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedRole(selectedRole === role ? 'all' : role)}
          >
            <CardContent className="p-4">
              <Badge className={ROLE_CONFIG[role]?.color || 'bg-muted'}>{ROLE_CONFIG[role]?.name || role}</Badge>
              <div className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-success">{roleStats[role]?.enabled || 0}</span>
                {' / '}
                <span>{roleStats[role]?.total || 0}</span>
                <span className="ml-1">modules</span>
              </div>
              {role === UserRole.ADMIN ? (
                <div className="mt-1 text-xs text-muted-foreground">Always full access</div>
              ) : (
                <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={bulkSaving}
                    onClick={() => setBulkTarget({ role, allowed: true })}
                  >
                    All on
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={bulkSaving}
                    onClick={() => setBulkTarget({ role, allowed: false })}
                  >
                    All off
                  </Button>
                </div>
              )}
              {selectedRole === role && <div className="mt-1 text-xs text-info">Click to clear filter</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={bulkTarget !== null} onOpenChange={(open) => !open && !bulkSaving && setBulkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkTarget?.allowed ? 'Enable' : 'Disable'} every module for{' '}
              {bulkTarget ? ROLE_CONFIG[bulkTarget.role]?.name || bulkTarget.role : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkTarget?.allowed
                ? 'Every switch in this column turns on. The role can create and change records in every module.'
                : 'Every switch in this column turns off. The role can still sign in and look things up, but cannot create or change anything until you turn modules back on.'}{' '}
              Each change is recorded in Recent Changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulk} disabled={bulkSaving}>
              {bulkSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {bulkTarget?.allowed ? 'Yes, enable all' : 'Yes, disable all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  <TableHead className="w-[200px] sticky left-0 bg-card z-10">Permission</TableHead>
                  {displayRoles.map((role) => (
                    <TableHead key={role} className="text-center min-w-[100px]">
                      <Badge className={ROLE_CONFIG[role]?.color || 'bg-muted'}>
                        {ROLE_CONFIG[role]?.name || role}
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermissions.map((perm) => (
                  <TableRow key={perm.permissionKey}>
                    <TableCell className="font-medium sticky left-0 bg-card z-10">
                      <div>
                        <div>{perm.displayName}</div>
                        <div className="text-xs text-muted-foreground">{perm.moduleGroup}</div>
                      </div>
                    </TableCell>
                    {displayRoles.map((role) => {
                      // Admin bypasses every check server-side, so its switches are shown on and locked
                      const isDisabled = saving === `${role}:${perm.permissionKey}` || role === UserRole.ADMIN;
                      const isSaving = saving === `${role}:${perm.permissionKey}`;

                      return (
                        <TableCell key={role} className="text-center">
                          <div className="flex justify-center items-center">
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                    <TableCell colSpan={displayRoles.length + 1} className="text-center text-muted-foreground py-8">
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
            <CardHeader className="cursor-pointer hover:bg-muted">
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
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No permission changes recorded yet</div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">
                          {log.newValues?.allowed ? 'Enabled' : 'Disabled'}{' '}
                          <span className="text-info">{log.newValues?.permissionKey}</span>
                          {' for '}
                          <Badge className={ROLE_CONFIG[log.newValues?.role as UserRole]?.color || 'bg-muted'}>
                            {ROLE_CONFIG[log.newValues?.role as UserRole]?.name || log.newValues?.role}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          by {log.users?.firstName} {log.users?.lastName}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">{formatDateTime(new Date(log.timestamp))}</div>
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
