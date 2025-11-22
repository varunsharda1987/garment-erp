import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { chartOfAccountsService } from '@/services/chartOfAccounts.service';
import type { ChartOfAccount } from '@/types/financial.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import { logError } from '../lib/logger';

export default function ChartOfAccountsList() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chartOfAccountsService.getHierarchy();
      setAccounts(data);
      // Auto-expand level 1 accounts
      const level1Ids = data.map(acc => acc.id);
      setExpandedNodes(new Set(level1Ids));
    } catch (err) {
      logError('Failed to fetch chart of accounts:', err);
      setError('Failed to load chart of accounts');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
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
      case 'ASSET': return 'text-green-600 bg-green-50';
      case 'LIABILITY': return 'text-red-600 bg-red-50';
      case 'EQUITY': return 'text-purple-600 bg-purple-50';
      case 'REVENUE': return 'text-blue-600 bg-blue-50';
      case 'EXPENSE': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderAccount = (account: ChartOfAccount, level: number = 0) => {
    const hasChildren = account.childAccounts && account.childAccounts.length > 0;
    const isExpanded = expandedNodes.has(account.id);
    const indentClass = `pl-${Math.min(level * 8, 32)}`;

    return (
      <div key={account.id} className="border-b last:border-b-0">
        <div
          className={`flex items-center justify-between py-3 px-4 hover:bg-gray-50 ${indentClass}`}
        >
          <div className="flex items-center flex-1">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(account.id)}
                className="mr-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className="mr-2 w-4"></span>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-gray-600">{account.accountCode}</span>
                <span className="font-medium">{account.accountName}</span>
                {account.isSystem && (
                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                    System
                  </span>
                )}
                {!account.isActive && (
                  <span className="text-xs px-2 py-0.5 bg-red-200 text-red-700 rounded">
                    Inactive
                  </span>
                )}
              </div>
              {account.description && (
                <p className="text-xs text-gray-500 mt-1">{account.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${getAccountTypeColor(account.accountType)}`}>
              {account.accountType}
            </span>
            <span className="text-xs text-gray-500 px-2">
              {account.accountGroup.replace(/_/g, ' ')}
            </span>
            {!account.isSystem && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/chart-of-accounts/${account.id}/edit`)}
              >
                Edit
              </Button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && account.childAccounts && (
          <div className="bg-gray-50">
            {account.childAccounts.map(child => renderAccount(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="bg-white shadow-sm border-b mb-6">
        <div className="flex justify-between items-center h-16 px-6">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              ← Back
            </Button>
            <div className="text-2xl">💼</div>
            <h1 className="text-xl font-bold text-gray-800">Chart of Accounts</h1>
          </div>
          <div className="flex gap-2">
            <ExportButton module="chart_of_accounts" />
            <ImportButton module="chart_of_accounts" onSuccess={fetchAccounts} />
            <Button onClick={() => navigate('/chart-of-accounts/new')}>
              + New Account
            </Button>
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
                <div className="text-gray-500">Loading chart of accounts...</div>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <div className="text-red-600">{error}</div>
                <Button onClick={fetchAccounts} className="mt-4" variant="outline">
                  Retry
                </Button>
              </div>
            )}

            {!loading && !error && accounts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">No accounts found</div>
                <Button onClick={() => navigate('/chart-of-accounts/new')}>
                  Create First Account
                </Button>
              </div>
            )}

            {!loading && !error && accounts.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                {accounts.map(account => renderAccount(account, 0))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map(type => {
            const count = accounts.filter(acc => acc.accountType === type).length;
            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">{type}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getAccountTypeColor(type)}`}>
                    {count}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}
