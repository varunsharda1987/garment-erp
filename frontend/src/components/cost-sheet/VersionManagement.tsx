/**
 * Version Management Component
 * Displays version history, variance, and comparison for cost sheets
 */

import { useState } from 'react';

interface CostSheetVersion {
  id: string;
  styleId: string;
  version: number;
  versionDate: string;
  versionReason: string | null;
  costVariancePercent: number | null;
  totalCost: number;
  isApproved: boolean;
  lockedForOrders: boolean;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface VersionManagementProps {
  currentVersion: CostSheetVersion;
  allVersions?: CostSheetVersion[];
  onCreateNewVersion?: () => void;
  onCompareVersions?: (v1Id: string, v2Id: string) => void;
  onSelectVersion?: (versionId: string) => void;
  className?: string;
}

export default function VersionManagement({
  currentVersion,
  allVersions = [],
  onCreateNewVersion,
  onCompareVersions,
  onSelectVersion,
  className = '',
}: VersionManagementProps) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getVarianceColor = (variance: number | null) => {
    if (!variance) return 'text-gray-600';
    if (Math.abs(variance) < 2) return 'text-gray-600';
    if (variance > 0) return 'text-red-600';
    return 'text-green-600';
  };

  const getVarianceIcon = (variance: number | null) => {
    if (!variance || Math.abs(variance) < 0.1) return '•';
    if (variance > 0) return '↑';
    return '↓';
  };

  const sortedVersions = [...allVersions].sort((a, b) => b.version - a.version);

  const handleCompare = () => {
    if (compareVersionId && onCompareVersions) {
      onCompareVersions(currentVersion.id, compareVersionId);
    }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Current Version Header */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900">Version {currentVersion.version}</h3>
                {currentVersion.isApproved && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                    <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Approved
                  </span>
                )}
                {currentVersion.lockedForOrders && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                    <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Locked
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {formatDate(currentVersion.versionDate)} by {currentVersion.createdBy.name}
              </div>
            </div>

            {/* Cost Variance Indicator */}
            {currentVersion.costVariancePercent !== null && (
              <div className="flex items-center space-x-2">
                <div className={`text-2xl font-bold ${getVarianceColor(currentVersion.costVariancePercent)}`}>
                  {getVarianceIcon(currentVersion.costVariancePercent)}
                  {Math.abs(currentVersion.costVariancePercent).toFixed(2)}%
                </div>
                <div className="text-sm text-gray-600">vs previous version</div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm text-gray-600">Total Cost</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(currentVersion.totalCost)}</div>
            </div>
            {onCreateNewVersion && !currentVersion.lockedForOrders && (
              <button
                onClick={onCreateNewVersion}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Version
              </button>
            )}
          </div>
        </div>

        {/* Version Reason */}
        {currentVersion.versionReason && (
          <div className="mt-3 bg-white bg-opacity-70 rounded p-3 border border-blue-200">
            <div className="text-xs font-medium text-gray-700 mb-1">Version Notes:</div>
            <div className="text-sm text-gray-900">{currentVersion.versionReason}</div>
          </div>
        )}
      </div>

      {/* Version History Toggle */}
      {sortedVersions.length > 1 && (
        <div className="border-b">
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <svg
                className={`h-5 w-5 text-gray-500 transition-transform ${isHistoryExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-900">
                Version History ({sortedVersions.length} versions)
              </span>
            </div>
            <span className="text-sm text-gray-600">{isHistoryExpanded ? 'Hide' : 'Show'}</span>
          </button>

          {/* Version History List */}
          {isHistoryExpanded && (
            <div className="px-6 py-4 bg-gray-50">
              <div className="space-y-3">
                {sortedVersions.map((version) => (
                  <div
                    key={version.id}
                    className={`bg-white border rounded-lg p-4 ${
                      version.id === currentVersion.id
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">Version {version.version}</span>
                          {version.id === currentVersion.id && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Current</span>
                          )}
                          {version.isApproved && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Approved</span>
                          )}
                          {version.lockedForOrders && (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Locked</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatDate(version.versionDate)} by {version.createdBy.name}
                        </div>
                        {version.versionReason && (
                          <div className="text-sm text-gray-700 mt-2 italic">{version.versionReason}</div>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 ml-4">
                        {version.costVariancePercent !== null && (
                          <div className={`text-sm font-semibold ${getVarianceColor(version.costVariancePercent)}`}>
                            {getVarianceIcon(version.costVariancePercent)}
                            {Math.abs(version.costVariancePercent).toFixed(2)}%
                          </div>
                        )}
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">{formatCurrency(version.totalCost)}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {version.id !== currentVersion.id && (
                            <>
                              {onSelectVersion && (
                                <button
                                  onClick={() => onSelectVersion(version.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  View
                                </button>
                              )}
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name="compareVersion"
                                  checked={compareVersionId === version.id}
                                  onChange={() => setCompareVersionId(version.id)}
                                  className="h-4 w-4 text-blue-600 border-gray-300"
                                />
                                <span className="ml-1 text-xs text-gray-600">Compare</span>
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Compare Button */}
              {compareVersionId && onCompareVersions && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleCompare}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    Compare with Version {currentVersion.version}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-sm text-gray-600">Total Versions</div>
          <div className="text-2xl font-bold text-gray-900">{sortedVersions.length}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-green-600">{sortedVersions.filter((v) => v.isApproved).length}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600">Locked</div>
          <div className="text-2xl font-bold text-orange-600">
            {sortedVersions.filter((v) => v.lockedForOrders).length}
          </div>
        </div>
      </div>
    </div>
  );
}
