import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chartOfAccountsService } from '@/services/chartOfAccounts.service';
import { AccountType, AccountGroup, type ChartOfAccount } from '@/types/financial.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import { logError } from '../lib/logger';

const NO_PARENT = 'NONE';

interface AccountFormData {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountGroup: AccountGroup;
  parentAccountId: string; // NO_PARENT sentinel or a parent UUID
  description: string;
}

const emptyForm: AccountFormData = {
  accountCode: '',
  accountName: '',
  accountType: 'ASSET',
  accountGroup: 'CURRENT_ASSET',
  parentAccountId: NO_PARENT,
  description: '',
};

// Flatten the account hierarchy into a single list (for the parent selector)
function flattenAccounts(list: ChartOfAccount[], acc: ChartOfAccount[] = []): ChartOfAccount[] {
  for (const a of list) {
    acc.push(a);
    if (a.childAccounts?.length) flattenAccounts(a.childAccounts, acc);
  }
  return acc;
}

export default function ChartOfAccountsList() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openCreateDialog = () => {
    setEditingAccount(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (account: ChartOfAccount) => {
    setEditingAccount(account);
    setFormData({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      accountGroup: account.accountGroup,
      parentAccountId: account.parentAccountId ?? NO_PARENT,
      description: account.description ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountName.trim() || (!editingAccount && !formData.accountCode.trim())) {
      toast.error('Account code and name are required');
      return;
    }

    const parentAccountId = formData.parentAccountId === NO_PARENT ? null : formData.parentAccountId;
    const description = formData.description.trim() || null;

    try {
      setSubmitting(true);
      if (editingAccount) {
        // accountCode is not updatable on the backend, so it is omitted here
        await chartOfAccountsService.update(editingAccount.id, {
          accountName: formData.accountName.trim(),
          accountType: formData.accountType,
          accountGroup: formData.accountGroup,
          parentAccountId,
          description,
        });
        toast.success('Account updated successfully');
      } else {
        await chartOfAccountsService.create({
          accountCode: formData.accountCode.trim(),
          accountName: formData.accountName.trim(),
          accountType: formData.accountType,
          accountGroup: formData.accountGroup,
          parentAccountId,
          description,
        });
        toast.success('Account created successfully');
      }
      setDialogOpen(false);
      setEditingAccount(null);
      fetchAccounts();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        `Failed to ${editingAccount ? 'update' : 'create'} account`;
      logError('Chart of accounts save failed:', err);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chartOfAccountsService.getHierarchy();
      setAccounts(data);
      // Auto-expand level 1 accounts
      const level1Ids = data.map((acc) => acc.id);
      setExpandedNodes(new Set(level1Ids));
    } catch (err) {
      logError('Failed to fetch chart of accounts:', err);
      setError('Failed to load chart of accounts');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'ASSET':
        return 'text-success bg-success-muted';
      case 'LIABILITY':
        return 'text-destructive bg-destructive/10';
      case 'EQUITY':
        return 'text-accent bg-accent/10';
      case 'REVENUE':
        return 'text-info bg-info-muted';
      case 'EXPENSE':
        return 'text-primary bg-primary/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const renderAccount = (account: ChartOfAccount, level: number = 0) => {
    const hasChildren = account.childAccounts && account.childAccounts.length > 0;
    const isExpanded = expandedNodes.has(account.id);
    const indentClass = `pl-${Math.min(level * 8, 32)}`;

    return (
      <div key={account.id} className="border-b last:border-b-0">
        <div className={`flex items-center justify-between py-3 px-4 hover:bg-muted ${indentClass}`}>
          <div className="flex items-center flex-1">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(account.id)}
                className="mr-2 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className="mr-2 w-4"></span>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{account.accountCode}</span>
                <span className="font-medium">{account.accountName}</span>
                {account.isSystem && (
                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-foreground rounded">System</span>
                )}
                {!account.isActive && (
                  <span className="text-xs px-2 py-0.5 bg-destructive/15 text-destructive rounded">Inactive</span>
                )}
              </div>
              {account.description && <p className="text-xs text-muted-foreground mt-1">{account.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${getAccountTypeColor(account.accountType)}`}>
              {account.accountType}
            </span>
            <span className="text-xs text-muted-foreground px-2">{account.accountGroup.replace(/_/g, ' ')}</span>
            {!account.isSystem && (
              <Button variant="outline" size="sm" onClick={() => openEditDialog(account)}>
                Edit
              </Button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && account.childAccounts && (
          <div className="bg-muted">{account.childAccounts.map((child) => renderAccount(child, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="bg-card shadow-sm border-b mb-6">
        <div className="flex justify-between items-center h-16 px-6">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              ← Back
            </Button>
            <div className="text-2xl">💼</div>
            <h1 className="text-xl font-display font-medium text-foreground">Chart of Accounts</h1>
          </div>
          <div className="flex gap-2">
            <ExportButton module="chart_of_accounts" />
            <ImportButton module="chart_of_accounts" onSuccess={fetchAccounts} />
            <Button onClick={openCreateDialog}>+ New Account</Button>
          </div>
        </div>
      </div>

      <main>
        <Card>
          <CardHeader>
            <CardTitle>Chart of Accounts Hierarchy</CardTitle>
            <CardDescription>
              Manage your accounting structure. Click arrows to expand/collapse accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="text-center py-12">
                <div className="text-muted-foreground">Loading chart of accounts...</div>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <div className="text-destructive">{error}</div>
                <Button onClick={fetchAccounts} className="mt-4" variant="outline">
                  Retry
                </Button>
              </div>
            )}

            {!loading && !error && accounts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">No accounts found</div>
                <Button onClick={openCreateDialog}>Create First Account</Button>
              </div>
            )}

            {!loading && !error && accounts.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                {accounts.map((account) => renderAccount(account, 0))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => {
            const count = accounts.filter((acc) => acc.accountType === type).length;
            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{type}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getAccountTypeColor(type)}`}>{count}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Create / Edit Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'New Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountCode">Account Code *</Label>
                <Input
                  id="accountCode"
                  placeholder="e.g., 1000"
                  value={formData.accountCode}
                  disabled={!!editingAccount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, accountCode: e.target.value }))}
                  required={!editingAccount}
                />
                {editingAccount && <p className="text-xs text-muted-foreground">Account code cannot be changed.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name *</Label>
                <Input
                  id="accountName"
                  placeholder="e.g., Cash in Hand"
                  value={formData.accountName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, accountName: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type *</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, accountType: val as AccountType }))}
                >
                  <SelectTrigger id="accountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AccountType).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountGroup">Account Group *</Label>
                <Select
                  value={formData.accountGroup}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, accountGroup: val as AccountGroup }))}
                >
                  <SelectTrigger id="accountGroup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AccountGroup).map((g) => (
                      <SelectItem key={g} value={g}>
                        {g.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentAccountId">Parent Account</Label>
              <Select
                value={formData.parentAccountId}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, parentAccountId: val }))}
              >
                <SelectTrigger id="parentAccountId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>None (top-level)</SelectItem>
                  {flattenAccounts(accounts)
                    .filter((a) => a.id !== editingAccount?.id)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.accountCode} — {a.accountName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingAccount ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
