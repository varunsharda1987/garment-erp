/**
 * Fabric Costing Row Component
 * Displays fabric details with sourcing strategy and cost breakdown
 */

import React, { useState } from 'react';
import type { FabricCostCalculationResult } from '../../types/fabricCosting.types';
import SourcingStrategySelector from './SourcingStrategySelector';

interface FabricCostingRowProps {
  fabricId: string;
  fabricName: string;
  cadMeters: number;
  width: number;
  orderQuantity?: number;
  styleId?: string;
  currentStrategy?: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
  currentCost?: number;
  onStrategyChange: (strategy: {
    sourcingStrategy: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
    cost: number;
    stockLotId?: string;
    processorId?: string;
    rateCardId?: string;
    procurementId?: string;
    greigeCost?: number;
    processingCost?: number;
    isManualOverride?: boolean;
    overrideReason?: string;
  }) => void;
  onRemove?: () => void;
  index: number;
}

export default function FabricCostingRow({
  fabricId,
  fabricName,
  cadMeters,
  width,
  orderQuantity,
  styleId,
  currentStrategy,
  currentCost,
  onStrategyChange,
  onRemove,
  index,
}: FabricCostingRowProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fabricCostData, setFabricCostData] = useState<FabricCostCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenModal = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Dynamically import the service to avoid circular dependencies
      const { fabricCostingService } = await import('../../services/fabricCosting.service');

      const result = await fabricCostingService.calculateFabricCost({
        fabricId,
        cadMeters,
        width,
        orderQuantity,
        styleId,
      });

      setFabricCostData(result);
      setIsModalOpen(true);
    } catch (err: any) {
      console.error('Error calculating fabric cost:', err);
      setError(err.response?.data?.error || 'Failed to calculate fabric cost');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectStrategy = (strategy: any) => {
    onStrategyChange(strategy);
    setIsModalOpen(false);
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return `₹${amount.toFixed(2)}`;
  };

  const getStrategyBadgeColor = (strategy?: string) => {
    switch (strategy) {
      case 'STOCK_REUSE':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'READY_FABRIC':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'GREIGE_PROCESSED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStrategyLabel = (strategy?: string) => {
    switch (strategy) {
      case 'STOCK_REUSE':
        return 'Stock Reuse';
      case 'READY_FABRIC':
        return 'Ready Fabric';
      case 'GREIGE_PROCESSED':
        return 'Greige + Processing';
      default:
        return 'Not Selected';
    }
  };

  // Check if fabric is properly linked (has a valid fabricId)
  const isFabricLinked = fabricId && fabricId.length > 10 && !fabricId.includes('temp');
  // Check if all required fields are present for cost breakdown
  const hasRequiredFields = isFabricLinked && cadMeters > 0 && width > 0;

  // Helper to get button tooltip
  const getButtonTooltip = () => {
    if (!isFabricLinked) {
      return 'Fabric not linked - Link this fabric in the Style Form to enable sourcing options';
    }
    if (cadMeters <= 0 || width <= 0) {
      return 'Missing CAD/width data - Complete CAD planning to enable cost breakdown';
    }
    return 'Compare sourcing options: Stock Reuse, Ready Fabric, or Greige + Processing';
  };

  return (
    <>
      <tr className="border-b hover:bg-gray-50">
        {/* Index */}
        <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>

        {/* Fabric Name */}
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-gray-900">{fabricName}</div>
          {fabricId && (
            <div className="text-xs text-gray-500">ID: {fabricId.slice(0, 8)}...</div>
          )}
        </td>

        {/* CAD Meters */}
        <td className="px-4 py-3 text-sm text-gray-900 text-center">
          {cadMeters.toFixed(2)}m
        </td>

        {/* Width */}
        <td className="px-4 py-3 text-sm text-gray-900 text-center">
          {width}"
        </td>

        {/* Sourcing Strategy */}
        <td className="px-4 py-3">
          {currentStrategy ? (
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStrategyBadgeColor(
                  currentStrategy
                )}`}
              >
                {getStrategyLabel(currentStrategy)}
              </span>
              <button
                onClick={handleOpenModal}
                disabled={isLoading || !hasRequiredFields}
                className="text-blue-600 hover:text-blue-800 text-xs underline disabled:opacity-50"
                title={getButtonTooltip()}
              >
                {isLoading ? 'Loading...' : 'Change'}
              </button>
            </div>
          ) : !isFabricLinked ? (
            <div className="flex flex-col">
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Not Linked
              </span>
              <span className="text-xs text-orange-600 mt-1">
                Link fabric in Style Form
              </span>
            </div>
          ) : !hasRequiredFields ? (
            <div className="flex flex-col">
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Missing Data
              </span>
              <span className="text-xs text-amber-600 mt-1">
                {cadMeters <= 0 ? 'No CAD data' : 'No width data'}
              </span>
            </div>
          ) : (
            <button
              onClick={handleOpenModal}
              disabled={isLoading || !hasRequiredFields}
              className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
              title={getButtonTooltip()}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-blue-700"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Choose Sourcing
                </>
              )}
            </button>
          )}
        </td>

        {/* Cost */}
        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
          {formatCurrency(currentCost)}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={handleOpenModal}
              disabled={isLoading}
              className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
              title="View cost breakdown"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                className="text-red-600 hover:text-red-800"
                title="Remove fabric"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Error Row */}
      {error && (
        <tr>
          <td colSpan={7} className="px-4 py-2 bg-red-50">
            <div className="flex items-center text-red-700 text-sm">
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          </td>
        </tr>
      )}

      {/* Modal */}
      {fabricCostData && (
        <SourcingStrategySelector
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          fabricCostData={fabricCostData}
          onSelectStrategy={handleSelectStrategy}
        />
      )}
    </>
  );
}
