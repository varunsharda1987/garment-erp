/**
 * ProcessorRateCardSummary
 * Summary dashboard showing all processor rate card configurations
 */

import { useState, useEffect, useMemo } from 'react';
import { processorRateCardV2Service } from '../../services/processorRateCardV2.service';
import type {
  ProcessorRateCardSummary as SummaryType,
  ProcessorSummary,
  ProcessorTypeStats,
  ProcessingTypeV2,
} from '../../types/processorRateCardV2.types';

interface ProcessorRateCardSummaryProps {
  onSelectProcessor: (processorId: string, processingType: ProcessingTypeV2) => void;
}

type SortOption = 'name' | 'status' | 'coverage';
type StatusFilter = 'ALL' | 'NOT_CONFIGURED' | 'PARTIAL' | 'COMPLETE';

export function ProcessorRateCardSummary({ onSelectProcessor }: ProcessorRateCardSummaryProps) {
  const [summary, setSummary] = useState<SummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProcessingTypeV2>('DYEING');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await processorRateCardV2Service.getSummary();
      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort processors
  const filteredProcessors = useMemo(() => {
    if (!summary) return [];

    let processors = summary.processors;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      processors = processors.filter((p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term));
    }

    // Filter by status
    if (statusFilter !== 'ALL') {
      processors = processors.filter((p) => p.status === statusFilter);
    }

    // Sort
    processors = [...processors].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status': {
          const statusOrder = { COMPLETE: 0, PARTIAL: 1, NOT_CONFIGURED: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        case 'coverage': {
          const getStats = (p: ProcessorSummary) => (activeTab === 'DYEING' ? p.dyeing : p.printing);
          return getStats(b).coverage - getStats(a).coverage;
        }
        default:
          return 0;
      }
    });

    return processors;
  }, [summary, searchTerm, sortBy, statusFilter, activeTab]);

  // Get status badge styling
  const getStatusBadge = (status: ProcessorSummary['status']) => {
    switch (status) {
      case 'COMPLETE':
        return {
          bg: 'bg-success-muted',
          text: 'text-success',
          label: 'Complete',
        };
      case 'PARTIAL':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          label: 'Partial',
        };
      case 'NOT_CONFIGURED':
        return {
          bg: 'bg-muted',
          text: 'text-muted-foreground',
          label: 'Not Configured',
        };
    }
  };

  // Get coverage bar color
  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'bg-success-muted';
    if (coverage >= 50) return 'bg-warning-muted';
    if (coverage > 0) return 'bg-primary/100';
    return 'bg-gray-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-info"></div>
        <span className="ml-3 text-muted-foreground">Loading summary...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
        <p className="font-medium">Failed to load summary</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={loadSummary} className="mt-2 text-sm text-destructive hover:text-destructive underline">
          Try again
        </button>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const typeSummary = summary.processingTypeSummary?.[activeTab] || {
    totalSlabs: 0,
    totalRates: 0,
    processorsConfigured: 0,
    averageCoverage: 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg shadow p-4 border-l-4 border-l-info">
          <div className="text-3xl font-bold text-info">{summary.totals?.totalProcessors || 0}</div>
          <div className="text-sm text-muted-foreground">Total Processors</div>
        </div>
        <div className="bg-card rounded-lg shadow p-4 border-l-4 border-l-warning">
          <div className="text-3xl font-bold text-warning">{summary.totals?.configuredProcessors || 0}</div>
          <div className="text-sm text-muted-foreground">Configured</div>
        </div>
        <div className="bg-card rounded-lg shadow p-4 border-l-4 border-l-success">
          <div className="text-3xl font-bold text-success">{summary.totals?.completeProcessors || 0}</div>
          <div className="text-sm text-muted-foreground">Complete</div>
        </div>
        <div className="bg-card rounded-lg shadow p-4 border-l-4 border-l-accent">
          <div className="text-3xl font-bold text-accent">{summary.totals?.totalGreigeCount || 0}</div>
          <div className="text-sm text-muted-foreground">Total Greiges</div>
        </div>
      </div>

      {/* Processing Type Tabs */}
      <div className="bg-card rounded-lg shadow">
        <div className="border-b border-border">
          <div className="flex justify-between items-center px-4">
            <div className="flex">
              {(['DYEING', 'PRINTING'] as ProcessingTypeV2[]).map((type) => {
                const stats = summary.processingTypeSummary?.[type];
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === type
                        ? 'border-info text-info'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {type} ({stats?.processorsConfigured || 0})
                  </button>
                );
              })}
            </div>

            {/* Search and Filter */}
            <div className="flex items-center gap-4 py-2">
              <input
                type="text"
                placeholder="Search processors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-border rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-info"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="border border-border rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-info"
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETE">Complete</option>
                <option value="PARTIAL">Partial</option>
                <option value="NOT_CONFIGURED">Not Configured</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="border border-border rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-info"
              >
                <option value="name">Sort: Name</option>
                <option value="status">Sort: Status</option>
                <option value="coverage">Sort: Coverage</option>
              </select>
            </div>
          </div>
        </div>

        {/* Type Summary Bar */}
        <div className="px-4 py-3 bg-muted text-sm text-muted-foreground border-b border-border">
          <span className="font-medium">{activeTab}:</span>
          <span className="ml-4">Configured: {typeSummary.processorsConfigured}</span>
          <span className="mx-2">|</span>
          <span>Slabs: {typeSummary.totalSlabs}</span>
          <span className="mx-2">|</span>
          <span>Rates: {typeSummary.totalRates}</span>
          <span className="mx-2">|</span>
          <span>Avg Coverage: {typeSummary.averageCoverage}%</span>
        </div>

        {/* Processor Cards Grid */}
        <div className="p-4">
          {filteredProcessors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No processors found matching your criteria</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProcessors.map((processor) => {
                const stats: ProcessorTypeStats = activeTab === 'DYEING' ? processor.dyeing : processor.printing;
                const statusBadge = getStatusBadge(processor.status);

                return (
                  <div
                    key={processor.id}
                    onClick={() => onSelectProcessor(processor.id, activeTab)}
                    className="bg-card border border-border rounded-lg p-4 hover:shadow-md hover:border-info/30 cursor-pointer transition-all"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-foreground truncate" title={processor.name}>
                          {processor.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">{processor.code}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>

                    {stats.slabCount > 0 ? (
                      <>
                        {/* Slab Ranges */}
                        <div className="mb-3">
                          <div className="text-xs text-muted-foreground mb-1">Slabs: {stats.slabCount}</div>
                          {stats.slabRanges && stats.slabRanges.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {stats.slabRanges.slice(0, 3).map((range, idx) => (
                                <span key={idx} className="text-xs bg-muted text-foreground px-2 py-0.5 rounded">
                                  {range}
                                </span>
                              ))}
                              {stats.slabRanges.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{stats.slabRanges.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex justify-between">
                            <span>Greiges:</span>
                            <span className="font-medium">{stats.greigeCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Rates:</span>
                            <span className="font-medium">{stats.totalRateCount}</span>
                          </div>
                        </div>

                        {/* Coverage Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Coverage</span>
                            <span className="font-medium">{stats.coverage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getCoverageColor(stats.coverage)}`}
                              style={{ width: `${Math.min(stats.coverage, 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Rate Range */}
                        {stats.minRate !== undefined && stats.maxRate !== undefined && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Rate range:{' '}
                            <span className="font-medium">
                              Rs.{stats.minRate}-{stats.maxRate}/m
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground mb-2">
                          No {activeTab.toLowerCase()} rates configured
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProcessor(processor.id, activeTab);
                          }}
                          className="text-sm text-info hover:text-info font-medium"
                        >
                          Configure Now
                        </button>
                      </div>
                    )}

                    {/* Last Updated */}
                    {processor.lastUpdatedAt && (
                      <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-muted-foreground">
                        Updated: {new Date(processor.lastUpdatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProcessorRateCardSummary;
