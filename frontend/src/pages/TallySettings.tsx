import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Save,
  TestTube,
  Plus,
  Check,
  X,
  AlertTriangle,
  Link2,
  Upload,
  Receipt,
  Scale,
  FileText,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  getTallySettings,
  updateTallySettings,
  testTallyConnection,
  getTallyLedgers,
  getTallyVoucherTypes,
  getTallyGroups,
  createTallyMissingLedgers,
} from '@/services/tally.service';
import type { TallySettings, TallySettingsUpdateRequest, TallyLedger } from '@/types/tally.types';

const TALLY_TOOLS = [
  { title: 'Customer-Ledger Matching', route: '/settings/tally/customers', icon: Link2 },
  { title: 'Supplier Matching', route: '/settings/tally/suppliers', icon: Link2 },
  { title: 'Invoice Push', route: '/settings/tally/invoices', icon: Upload },
  { title: 'Credit Note Push', route: '/settings/tally/credit-notes', icon: FileText },
  { title: 'Debit Note Push', route: '/settings/tally/debit-notes', icon: FileText },
  { title: 'Receipt Push', route: '/settings/tally/payments', icon: Receipt },
  { title: 'Outstanding Sync', route: '/settings/tally/outstanding', icon: Scale },
];

export default function TallySettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<TallySettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tally-settings'],
    queryFn: getTallySettings,
  });

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: updateTallySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tally-settings'] });
      handleApiSuccess('Settings saved', 'Tally settings have been updated.');
      setHasChanges(false);
    },
    onError: (error) => handleApiError(error, 'Failed to save settings'),
  });

  const testMutation = useMutation({
    mutationFn: testTallyConnection,
    onSuccess: (data) => {
      if (data.companyMatched) {
        handleApiSuccess('Connection successful', `Connected to Tally. ${data.companies.length} company(ies) open.`);
      } else {
        handleApiError(null, 'Connection issue: configured company not found in open companies');
      }
    },
    onError: (error) => handleApiError(error, 'Connection failed'),
  });

  const [loadLedgers, setLoadLedgers] = useState(false);
  const ledgersQuery = useQuery({
    queryKey: ['tally-ledgers'],
    queryFn: getTallyLedgers,
    enabled: loadLedgers,
  });

  const [loadVoucherTypes, setLoadVoucherTypes] = useState(false);
  const voucherTypesQuery = useQuery({
    queryKey: ['tally-voucher-types'],
    queryFn: getTallyVoucherTypes,
    enabled: loadVoucherTypes,
  });

  const [loadGroups, setLoadGroups] = useState(false);
  const groupsQuery = useQuery({
    queryKey: ['tally-groups'],
    queryFn: getTallyGroups,
    enabled: loadGroups,
  });

  const createLedgersMutation = useMutation({
    mutationFn: createTallyMissingLedgers,
    onSuccess: (data) => {
      if (data.created.length > 0) {
        handleApiSuccess('Ledgers created', `Created: ${data.created.join(', ')}`);
      } else if (data.skipped.length > 0) {
        handleApiSuccess('All ledgers exist', 'All configured ledgers already exist in Tally.');
      }
      if (data.failed.length > 0) {
        handleApiError(null, `Failed to create: ${data.failed.map((f) => f.name).join(', ')}`);
      }
      testMutation.mutate();
    },
    onError: (error) => handleApiError(error, 'Failed to create ledgers'),
  });

  const updateField = <K extends keyof TallySettings>(key: K, value: TallySettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: TallySettingsUpdateRequest = {};
    if (settings) {
      for (const key of Object.keys(form) as Array<keyof TallySettings>) {
        if (form[key] !== settings[key]) {
          (updates as Record<string, unknown>)[key] = form[key];
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    }
  };

  const handleReset = () => {
    if (settings) {
      setForm(settings);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ledgerOptions = ledgersQuery.data?.map((l: TallyLedger) => l.name) || [];
  const voucherTypeOptions = voucherTypesQuery.data || [];
  const groupOptions = groupsQuery.data || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">Tally Integration</h1>
        <p className="text-muted-foreground mt-1">Configure connection to Tally ERP for pushing sales invoices</p>
      </div>

      <div className="grid gap-6">
        {/* Tally Tools — matching, push, and sync workflows */}
        <Card>
          <CardHeader>
            <CardTitle>Tally Tools</CardTitle>
            <CardDescription>Ledger matching, voucher push, and outstanding reconciliation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {TALLY_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Button
                    key={tool.route}
                    variant="outline"
                    className="h-auto py-3 justify-start"
                    onClick={() => navigate(tool.route)}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{tool.title}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Settings</CardTitle>
            <CardDescription>Connect to Tally PC running TallyPrime with "acts as Server" enabled</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="tallyEnabled"
                checked={form.tallyEnabled || false}
                onCheckedChange={(checked) => updateField('tallyEnabled', checked)}
              />
              <Label htmlFor="tallyEnabled">Enable Tally integration</Label>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tallyHost">Tally Host (IP)</Label>
                <Input
                  id="tallyHost"
                  value={form.tallyHost || ''}
                  onChange={(e) => updateField('tallyHost', e.target.value)}
                  placeholder="192.168.1.x"
                />
              </div>
              <div>
                <Label htmlFor="tallyPort">Port</Label>
                <Input
                  id="tallyPort"
                  type="number"
                  value={form.tallyPort || 9000}
                  onChange={(e) => updateField('tallyPort', parseInt(e.target.value) || 9000)}
                  placeholder="9000"
                />
              </div>
              <div>
                <Label htmlFor="tallyCompanyName">Company Name</Label>
                <Input
                  id="tallyCompanyName"
                  list="tally-companies"
                  value={form.tallyCompanyName || ''}
                  onChange={(e) => updateField('tallyCompanyName', e.target.value || null)}
                  placeholder="As open in Tally"
                />
                <datalist id="tally-companies">
                  {testMutation.data?.companies.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                {testMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button
                variant="outline"
                onClick={() => createLedgersMutation.mutate()}
                disabled={createLedgersMutation.isPending}
              >
                {createLedgersMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create Missing Ledgers
              </Button>
            </div>

            {/* Test Results */}
            {testMutation.data && (
              <div className="rounded border p-3 text-sm space-y-2 bg-muted/30">
                <div>
                  Open companies:{' '}
                  {testMutation.data.companies.length > 0 ? testMutation.data.companies.join(', ') : '—'}
                </div>
                {testMutation.data.companyConfigured && (
                  <div className={testMutation.data.companyMatched ? 'text-green-600' : 'text-red-600'}>
                    {testMutation.data.companyMatched ? (
                      <Check className="inline h-4 w-4 mr-1" />
                    ) : (
                      <X className="inline h-4 w-4 mr-1" />
                    )}
                    Configured company "{testMutation.data.companyConfigured}"{' '}
                    {testMutation.data.companyMatched ? 'is open' : 'is NOT open'}
                  </div>
                )}
                {testMutation.data.warnings.map((w, i) => (
                  <div key={i} className="text-amber-600 flex items-start gap-1">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {w}
                  </div>
                ))}
                <div className="space-y-1">
                  {testMutation.data.ledgers.map((l) => (
                    <div key={l.name} className={l.present ? 'text-green-600' : 'text-red-600'}>
                      {l.present ? <Check className="inline h-4 w-4 mr-1" /> : <X className="inline h-4 w-4 mr-1" />}
                      {l.name}
                      {!l.present && l.suggestion && (
                        <span className="text-muted-foreground ml-2">— Did you mean "{l.suggestion}"?</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Load Tally Data */}
        <Card>
          <CardHeader>
            <CardTitle>Load Tally Data</CardTitle>
            <CardDescription>Load ledgers, voucher types, and groups from Tally to populate dropdowns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoadLedgers(true);
                  if (loadLedgers) ledgersQuery.refetch();
                }}
                disabled={ledgersQuery.isFetching}
              >
                {ledgersQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {ledgersQuery.data ? `Reload Ledgers (${ledgersQuery.data.length})` : 'Load Ledgers'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoadVoucherTypes(true);
                  if (loadVoucherTypes) voucherTypesQuery.refetch();
                }}
                disabled={voucherTypesQuery.isFetching}
              >
                {voucherTypesQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {voucherTypesQuery.data
                  ? `Reload Voucher Types (${voucherTypesQuery.data.length})`
                  : 'Load Voucher Types'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoadGroups(true);
                  if (loadGroups) groupsQuery.refetch();
                }}
                disabled={groupsQuery.isFetching}
              >
                {groupsQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {groupsQuery.data ? `Reload Groups (${groupsQuery.data.length})` : 'Load Groups'}
              </Button>
            </div>
            {ledgersQuery.data && (
              <p className="text-sm text-green-600 mt-2">
                {ledgersQuery.data.length} ledgers loaded — click any ledger field below and start typing
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sales Voucher Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Voucher Settings</CardTitle>
            <CardDescription>Configure ledgers for sales invoices pushed to Tally</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tallyVoucherType">Voucher Type</Label>
                <Input
                  id="tallyVoucherType"
                  list="tally-voucher-types"
                  value={form.tallyVoucherType || ''}
                  onChange={(e) => updateField('tallyVoucherType', e.target.value)}
                  placeholder="Sales"
                />
                <datalist id="tally-voucher-types">
                  {voucherTypeOptions.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label htmlFor="tallyPartyGroup">Party Group</Label>
                <Input
                  id="tallyPartyGroup"
                  list="tally-groups"
                  value={form.tallyPartyGroup || ''}
                  onChange={(e) => updateField('tallyPartyGroup', e.target.value)}
                  placeholder="Sundry Debtors"
                />
                <datalist id="tally-groups">
                  {groupOptions.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tallySalesLedgerIntra">Sales Ledger (Intra-state)</Label>
                <Input
                  id="tallySalesLedgerIntra"
                  list="tally-ledgers"
                  value={form.tallySalesLedgerIntra || ''}
                  onChange={(e) => updateField('tallySalesLedgerIntra', e.target.value)}
                  placeholder="Intrastate Sales @5%"
                />
              </div>
              <div>
                <Label htmlFor="tallySalesLedgerInter">Sales Ledger (Inter-state)</Label>
                <Input
                  id="tallySalesLedgerInter"
                  list="tally-ledgers"
                  value={form.tallySalesLedgerInter || ''}
                  onChange={(e) => updateField('tallySalesLedgerInter', e.target.value)}
                  placeholder="Interstate Sales @5%"
                />
              </div>
            </div>

            <datalist id="tally-ledgers">
              {ledgerOptions.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">GST Output Ledgers (5% rate - apparel ≤ ₹2,500/pc)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tallyCgstLedger">CGST @2.5%</Label>
                  <Input
                    id="tallyCgstLedger"
                    list="tally-ledgers"
                    value={form.tallyCgstLedger || ''}
                    onChange={(e) => updateField('tallyCgstLedger', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tallySgstLedger">SGST @2.5%</Label>
                  <Input
                    id="tallySgstLedger"
                    list="tally-ledgers"
                    value={form.tallySgstLedger || ''}
                    onChange={(e) => updateField('tallySgstLedger', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tallyIgstLedger">IGST @5%</Label>
                  <Input
                    id="tallyIgstLedger"
                    list="tally-ledgers"
                    value={form.tallyIgstLedger || ''}
                    onChange={(e) => updateField('tallyIgstLedger', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">GST Output Ledgers (18% rate - apparel &gt; ₹2,500/pc)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tallyCgstLedger18">CGST @9%</Label>
                  <Input
                    id="tallyCgstLedger18"
                    list="tally-ledgers"
                    value={form.tallyCgstLedger18 || ''}
                    onChange={(e) => updateField('tallyCgstLedger18', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tallySgstLedger18">SGST @9%</Label>
                  <Input
                    id="tallySgstLedger18"
                    list="tally-ledgers"
                    value={form.tallySgstLedger18 || ''}
                    onChange={(e) => updateField('tallySgstLedger18', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tallyIgstLedger18">IGST @18%</Label>
                  <Input
                    id="tallyIgstLedger18"
                    list="tally-ledgers"
                    value={form.tallyIgstLedger18 || ''}
                    onChange={(e) => updateField('tallyIgstLedger18', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Other Ledgers</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tallyRoundOffLedger">Round Off Ledger</Label>
                  <Input
                    id="tallyRoundOffLedger"
                    list="tally-ledgers"
                    value={form.tallyRoundOffLedger || ''}
                    onChange={(e) => updateField('tallyRoundOffLedger', e.target.value)}
                    placeholder="Round Off"
                  />
                </div>
                <div>
                  <Label htmlFor="tallyFreightLedger">Freight Ledger</Label>
                  <Input
                    id="tallyFreightLedger"
                    list="tally-ledgers"
                    value={form.tallyFreightLedger || ''}
                    onChange={(e) => updateField('tallyFreightLedger', e.target.value)}
                    placeholder="Freight & Forwarding"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Inventory Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tallyGodownName">Godown Name</Label>
                  <Input
                    id="tallyGodownName"
                    value={form.tallyGodownName || ''}
                    onChange={(e) => updateField('tallyGodownName', e.target.value)}
                    placeholder="Main Location"
                  />
                </div>
                <div>
                  <Label htmlFor="tallyStockUnit">Stock Unit</Label>
                  <Input
                    id="tallyStockUnit"
                    value={form.tallyStockUnit || ''}
                    onChange={(e) => updateField('tallyStockUnit', e.target.value)}
                    placeholder="Pcs"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save/Reset Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges || updateMutation.isPending}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
