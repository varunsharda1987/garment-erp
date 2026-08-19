/**
 * AI Settings Page
 *
 * Admin page for configuring AI provider settings.
 * Features:
 * - Provider selection (DeepSeek, Kimi, Ollama, etc.)
 * - API key input (encrypted at rest)
 * - Model selection
 * - Connection testing
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Save,
  TestTube,
  Key,
  Trash2,
  CheckCircle2,
  XCircle,
  Bot,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  getAISettings,
  updateAISettings,
  testAIConnection,
  clearAPIKey,
  getAIProviders,
  getAIModels,
  type AIProvider,
  type AIModel,
} from '@/services/ai-settings.service';

// Provider API key URLs
const PROVIDER_KEY_URLS: Record<string, string> = {
  deepseek: 'https://platform.deepseek.com/api_keys',
  kimi: 'https://platform.kimi.com/',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/',
  google: 'https://makersuite.google.com/app/apikey',
};

export default function AISettingsPage() {
  const queryClient = useQueryClient();

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Test connection state
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    provider?: string;
    model?: string;
  } | null>(null);

  // Fetch current settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: getAISettings,
  });

  // Fetch available providers
  const { data: providers = [] } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: getAIProviders,
  });

  // Fetch models for selected provider
  const { data: models = [] } = useQuery({
    queryKey: ['ai-models', provider],
    queryFn: () => getAIModels(provider),
    enabled: !!provider,
  });

  // Sync form state with loaded settings
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setProvider(settings.provider || '');
      setModel(settings.model || '');
      setBaseUrl(settings.baseUrl || '');
      setHasChanges(false);
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: updateAISettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      handleApiSuccess('Settings saved', 'AI configuration has been updated.');
      setHasChanges(false);
      setApiKey(''); // Clear the API key input after save
    },
    onError: (error) => {
      handleApiError(error, 'Failed to save settings');
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: () =>
      testAIConnection({
        provider: provider || undefined,
        apiKey: apiKey || undefined,
        model: model || undefined,
        baseUrl: baseUrl || undefined,
      }),
    onSuccess: (result) => {
      setTestResult(result);
      if (result.success) {
        handleApiSuccess('Connection successful', `Connected to ${result.provider} (${result.model})`);
      }
    },
    onError: (error) => {
      handleApiError(error, 'Connection test failed');
      setTestResult({ success: false, message: 'Connection test failed' });
    },
  });

  // Clear API key mutation
  const clearKeyMutation = useMutation({
    mutationFn: clearAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      handleApiSuccess('API key cleared', 'The stored API key has been removed.');
    },
    onError: (error) => {
      handleApiError(error, 'Failed to clear API key');
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      enabled,
      provider: provider || undefined,
      apiKey: apiKey || undefined,
      model: model || undefined,
      baseUrl: baseUrl || undefined,
    });
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    setModel(''); // Reset model when provider changes
    setHasChanges(true);
    setTestResult(null);
  };

  const markChanged = () => {
    setHasChanges(true);
    setTestResult(null);
  };

  if (settingsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedProvider = providers.find((p: AIProvider) => p.value === provider);
  const needsApiKey = provider && provider !== 'ollama';
  const needsBaseUrl = provider === 'ollama';

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-display font-medium text-foreground">AI Settings</h1>
            <p className="text-muted-foreground mt-1">Configure the AI assistant for your team</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Assistant Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => {
                    setEnabled(checked);
                    markChanged();
                  }}
                />
                <div>
                  <p className="font-medium">{enabled ? 'Enabled' : 'Disabled'}</p>
                  <p className="text-sm text-muted-foreground">
                    {enabled ? 'Team can use the AI Assistant' : 'AI Assistant is turned off'}
                  </p>
                </div>
              </div>
              {settings?.apiKeySet && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Key className="h-3 w-3" />
                  API Key Set
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Provider Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Configuration</CardTitle>
            <CardDescription>Choose your AI provider and configure the connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>AI Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p: AIProvider) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex flex-col">
                        <span>{p.label}</span>
                        <span className="text-xs text-muted-foreground">{p.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProvider && <p className="text-sm text-muted-foreground">{selectedProvider.description}</p>}
            </div>

            {/* API Key (for cloud providers) */}
            {needsApiKey && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>API Key</Label>
                  {PROVIDER_KEY_URLS[provider] && (
                    <a
                      href={PROVIDER_KEY_URLS[provider]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Get API Key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      markChanged();
                    }}
                    placeholder={settings?.apiKeyMasked || 'Enter your API key'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {settings?.apiKeySet && !apiKey && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Current key: {settings.apiKeyMasked}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearKeyMutation.mutate()}
                      disabled={clearKeyMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      {clearKeyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="ml-1">Clear Key</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Base URL (for Ollama) */}
            {needsBaseUrl && (
              <div className="space-y-2">
                <Label>Ollama Server URL</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    markChanged();
                  }}
                  placeholder="http://localhost:11434"
                />
                <p className="text-sm text-muted-foreground">
                  Default: http://localhost:11434. Change if Ollama is running on a different machine.
                </p>
              </div>
            )}

            {/* Model Selection */}
            {provider && models.length > 0 && (
              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={model}
                  onValueChange={(value) => {
                    setModel(value);
                    markChanged();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m: AIModel) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Test Connection */}
            {provider && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                    {testMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="mr-2 h-4 w-4" />
                    )}
                    Test Connection
                  </Button>

                  {testResult && (
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-success" />
                          <span className="text-sm text-success">{testResult.message}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-destructive" />
                          <span className="text-sm text-destructive">{testResult.message}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security:</strong> API keys are encrypted before storage. Only admins can access this page. Your
            team members can use the AI Assistant at{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">/ai-assistant</code> once configured.
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (settings) {
                setEnabled(settings.enabled);
                setProvider(settings.provider || '');
                setModel(settings.model || '');
                setBaseUrl(settings.baseUrl || '');
                setApiKey('');
                setHasChanges(false);
              }
            }}
            disabled={!hasChanges || saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            {saveMutation.isPending ? (
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
