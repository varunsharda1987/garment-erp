import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, TestTube, QrCode, Check, X, AlertTriangle } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getEInvoiceSettings, updateEInvoiceSettings, testEInvoiceConnection } from '@/services/einvoice.service';
import type { EInvoiceSettings, EInvoiceSettingsUpdateRequest } from '@/types/einvoice.types';

export default function EInvoiceSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<EInvoiceSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['einvoice-settings'],
    queryFn: getEInvoiceSettings,
  });

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: updateEInvoiceSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['einvoice-settings'] });
      handleApiSuccess('Settings saved', 'e-Invoice settings have been updated.');
      setHasChanges(false);
    },
    onError: (error) => handleApiError(error, 'Failed to save settings'),
  });

  const testMutation = useMutation({
    mutationFn: testEInvoiceConnection,
    onSuccess: (data) => {
      if (data.ok) {
        handleApiSuccess('Connection successful', data.message);
      } else {
        handleApiError(null, data.message);
      }
    },
    onError: (error) => handleApiError(error, 'Connection test failed'),
  });

  const updateField = <K extends keyof EInvoiceSettings>(key: K, value: EInvoiceSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: EInvoiceSettingsUpdateRequest = {};
    if (settings) {
      for (const key of Object.keys(form) as Array<keyof EInvoiceSettings>) {
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

  const testResult = testMutation.data;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">GST e-Invoice (IRN)</h1>
        <p className="text-muted-foreground mt-1">
          Generate IRNs directly from the ERP via the government Invoice Registration Portal — works alongside Tally
        </p>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/einvoice/invoices">
            <QrCode className="h-4 w-4 mr-1" />
            IRN Generation
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally">Tally Settings</Link>
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
            <CardDescription>Portal mode and seller identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">Enable e-Invoicing</Label>
                <p className="text-sm text-muted-foreground">Master switch — IRN generation is blocked while off</p>
              </div>
              <Switch
                checked={form.einvEnabled ?? false}
                onCheckedChange={(checked) => updateField('einvEnabled', checked)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="einvMode">Mode</Label>
                <Select
                  value={form.einvMode ?? 'SANDBOX'}
                  onValueChange={(v) => updateField('einvMode', v as 'SANDBOX' | 'PRODUCTION')}
                >
                  <SelectTrigger id="einvMode" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SANDBOX">Sandbox (testing)</SelectItem>
                    <SelectItem value="PRODUCTION">Production (live IRNs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="einvGstin">Seller GSTIN</Label>
                <Input
                  id="einvGstin"
                  value={form.einvGstin ?? ''}
                  onChange={(e) => updateField('einvGstin', e.target.value.toUpperCase())}
                  placeholder="08XXXXXXXXXXXZX"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {form.einvMode === 'PRODUCTION' && (
              <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Production mode registers <strong>real, legally binding IRNs</strong>. Make sure the credentials below
                  are your production API user and the production public key is pasted.
                </span>
              </div>
            )}

            <div>
              <Label htmlFor="einvBaseUrl">Base URL override (optional)</Label>
              <Input
                id="einvBaseUrl"
                value={form.einvBaseUrl ?? ''}
                onChange={(e) => updateField('einvBaseUrl', e.target.value || null)}
                placeholder="Leave blank to use the standard portal URL for the selected mode"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle>API Credentials</CardTitle>
            <CardDescription>
              From the e-Invoice portal → API Registration. Saved secrets show as •••••••• — leave them unchanged to
              keep the saved value; submit an empty field to clear it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="einvClientId">Client ID</Label>
                <Input
                  id="einvClientId"
                  type="password"
                  autoComplete="off"
                  value={form.einvClientId ?? ''}
                  onChange={(e) => updateField('einvClientId', e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="einvClientSecret">Client Secret</Label>
                <Input
                  id="einvClientSecret"
                  type="password"
                  autoComplete="off"
                  value={form.einvClientSecret ?? ''}
                  onChange={(e) => updateField('einvClientSecret', e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="einvApiUsername">API Username</Label>
                <Input
                  id="einvApiUsername"
                  autoComplete="off"
                  value={form.einvApiUsername ?? ''}
                  onChange={(e) => updateField('einvApiUsername', e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="einvApiPassword">API Password</Label>
                <Input
                  id="einvApiPassword"
                  type="password"
                  autoComplete="off"
                  value={form.einvApiPassword ?? ''}
                  onChange={(e) => updateField('einvApiPassword', e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="einvPublicKeyPem">NIC Public Key (PEM)</Label>
              <Textarea
                id="einvPublicKeyPem"
                value={form.einvPublicKeyPem ?? ''}
                onChange={(e) => updateField('einvPublicKeyPem', e.target.value || null)}
                placeholder={
                  '-----BEGIN PUBLIC KEY-----\nDownload from the e-Invoice portal after login (API Credentials → Public Key) and paste here\n-----END PUBLIC KEY-----'
                }
                className="mt-1 font-mono text-xs min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required for authentication — the portal serves different keys for sandbox and production.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || hasChanges}
                className="gap-2"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Test Connection
              </Button>
              {hasChanges && (
                <span className="text-sm text-muted-foreground self-center">Save changes before testing</span>
              )}
            </div>

            {testResult && (
              <div className="rounded border p-3 text-sm bg-muted/30">
                <div className="flex items-center gap-2">
                  {testResult.ok ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                  <span className={testResult.ok ? 'text-green-700' : 'text-red-700'}>{testResult.message}</span>
                </div>
                {testResult.tokenExpiry && (
                  <p className="text-muted-foreground mt-1 ml-6">
                    Token valid until {new Date(testResult.tokenExpiry).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How it works with Tally</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Create the invoice in the ERP as usual.</p>
            <p>
              2. Generate the IRN here (or from the invoice page). The invoice is then <strong>locked</strong> — the IRP
              only allows whole-document cancellation within 24 hours, never edits.
            </p>
            <p>3. Push to Tally — the voucher carries the IRN, so Tally records it as already e-invoiced.</p>
            <p>4. The invoice PDF automatically shows the IRN and the signed QR code.</p>
          </CardContent>
        </Card>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={handleReset} disabled={!hasChanges || updateMutation.isPending}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending} className="gap-2">
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
