/**
 * Style-Specific Fabric Costing Options Page
 * Focused view showing all costing options for a single style
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Trash2, Loader2, X, ArrowRight, Lock, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fabricCostingService } from '../services/fabricCosting.service';
import { styleService } from '../services/style.service';
import type { CostingOption, GroupedCostingByStyle } from '../types/fabricCosting.types';
import type { Style } from '../types/style.types';
import { notify } from '../lib/notify';

export default function StyleFabricCostingOptionsPage() {
  const navigate = useNavigate();
  const { styleId } = useParams<{ styleId: string }>();

  // Data state
  const [style, setStyle] = useState<Style | null>(null);
  const [components, setComponents] = useState<Record<string, CostingOption[]>>({});

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [unapprovingId, setUnapprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [optionToDelete, setOptionToDelete] = useState<{ id: string; componentName: string } | null>(null);

  // Fetch style info
  useEffect(() => {
    const fetchStyle = async () => {
      if (!styleId) return;
      try {
        const styleData = await styleService.getStyleById(styleId);
        setStyle(styleData);
      } catch (error) {
        notify.error('Failed to load style info');
      }
    };
    fetchStyle();
  }, [styleId]);

  // Fetch costing options - all modes (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)
  const fetchCostingOptions = useCallback(async () => {
    if (!styleId) return;

    setIsLoading(true);
    try {
      // Fetch all options for this style without purpose filter (shows all modes)
      const response = await fabricCostingService.getCostingOptions({
        styleId,
        purpose: 'ALL',
        status: 'ALL',
        page: 1,
        limit: 1000, // Get all options for this style
      });
      const data = response.data as Record<string, GroupedCostingByStyle>;

      // Extract components for this style
      if (data[styleId]) {
        setComponents(data[styleId].components);
      } else {
        setComponents({});
      }
    } catch (error) {
      notify.error('Failed to load costing options');
    } finally {
      setIsLoading(false);
    }
  }, [styleId]);

  useEffect(() => {
    fetchCostingOptions();
  }, [fetchCostingOptions]);

  // Handle approve
  const handleApprove = async (optionId: string) => {
    setApprovingId(optionId);
    try {
      await fabricCostingService.approveCostingOption(optionId);
      notify.success('Option approved');
      fetchCostingOptions();
    } catch (error) {
      notify.error('Failed to approve option');
    } finally {
      setApprovingId(null);
    }
  };

  // Handle unapprove
  const handleUnapprove = async (optionId: string) => {
    setUnapprovingId(optionId);
    try {
      await fabricCostingService.unapproveCostingOption(optionId);
      notify.success('Option unapproved');
      fetchCostingOptions();
    } catch (error) {
      notify.error('Failed to unapprove option');
    } finally {
      setUnapprovingId(null);
    }
  };

  // Handle delete click
  const handleDeleteClick = (optionId: string, componentName: string) => {
    setOptionToDelete({ id: optionId, componentName });
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!optionToDelete) return;

    setDeletingId(optionToDelete.id);
    try {
      await fabricCostingService.deleteCostingOption(optionToDelete.id);
      notify.success('Option deleted');
      fetchCostingOptions();
    } catch (error) {
      notify.error('Failed to delete option');
    } finally {
      setDeletingId(null);
      setOptionToDelete(null);
    }
  };

  // Handle promote
  const handlePromote = async (optionId: string, targetPurpose: 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION') => {
    setPromotingId(optionId);
    try {
      await fabricCostingService.promoteCostingOption(optionId, targetPurpose);
      const label = targetPurpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Material Calculation' : 'Production';
      notify.success(`Promoted to ${label}`);
      fetchCostingOptions();
    } catch (error) {
      notify.error('Failed to promote option');
    } finally {
      setPromotingId(null);
    }
  };

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `₹${value.toFixed(2)}`;
  };

  // Get purpose badge variant
  const getPurposeBadgeVariant = (purpose: string | null) => {
    switch (purpose) {
      case 'PRODUCTION': return 'default';
      case 'RAW_MATERIAL_CALCULATION': return 'secondary';
      case 'COSTING': return 'outline';
      default: return 'outline';
    }
  };

  const componentEntries = Object.entries(components);
  const totalOptions = componentEntries.reduce((sum, [, opts]) => sum + opts.length, 0);
  const approvedCount = componentEntries.reduce(
    (sum, [, opts]) => sum + opts.filter(o => o.approvalStatus === 'APPROVED').length,
    0
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(`/fabric-costing?styleId=${styleId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Costing
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {style ? `${style.styleCode} - ${style.styleName}` : 'Loading...'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {style?.customer?.name || 'No Customer'} | {componentEntries.length} components | {totalOptions} options | {approvedCount} approved
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/fabric-costing?styleId=${styleId}`)}
          >
            Edit Costing
          </Button>
          {approvedCount > 0 && (
            <Button
              onClick={() => navigate(`/cost-sheets/new?styleId=${styleId}`)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Cost Sheet
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : componentEntries.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No costing options saved for this style.</p>
          <Button className="mt-4" onClick={() => navigate(`/fabric-costing?styleId=${styleId}`)}>
            Create Costing
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {componentEntries.map(([componentName, options]) => {
            const hasApproved = options.some(o => o.approvalStatus === 'APPROVED');

            return (
              <Card key={componentName} className="overflow-hidden">
                <div className="p-4 bg-muted/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{componentName}</h3>
                    <Badge variant="secondary">{options.length} options</Badge>
                    {hasApproved && (
                      <Badge variant="default" className="bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Approved
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Greige</TableHead>
                        <TableHead className="text-center">Width</TableHead>
                        <TableHead>Processor</TableHead>
                        <TableHead className="text-center">Qty (pcs)</TableHead>
                        <TableHead className="text-center">Greige (₹)</TableHead>
                        <TableHead className="text-center">Transport (₹)</TableHead>
                        <TableHead className="text-center">Process (₹)</TableHead>
                        <TableHead className="text-center">Shrink (₹)</TableHead>
                        <TableHead className="text-center">Screen (₹)</TableHead>
                        <TableHead className="text-center font-semibold">Total (₹/m)</TableHead>
                        <TableHead className="text-center">Mode</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-[180px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {options.map((option, idx) => (
                        <TableRow
                          key={option.id}
                          className={option.approvalStatus === 'APPROVED' ? 'bg-green-50' : ''}
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">
                            {option.greigeName || option.greigeCode || '-'}
                          </TableCell>
                          <TableCell className="text-center">{option.cutableWidth}"</TableCell>
                          <TableCell>
                            {option.processorName || option.processorCode || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {option.orderQuantityPcs?.toLocaleString() || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatCurrency(option.greigeCostPerMeter)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatCurrency(option.transportCostPerMeter)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatCurrency(option.processingPricePerMeter)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatCurrency(option.shrinkageCostPerMeter)}
                            {option.shrinkagePercent && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({option.shrinkagePercent}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatCurrency(option.screenCostPerMeter)}
                            {option.numberOfColors && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({option.numberOfColors}c)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {formatCurrency(option.totalCostPerMeter)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={getPurposeBadgeVariant(option.purpose)}
                              className={option.purpose === 'PRODUCTION' ? 'bg-blue-600' : ''}
                            >
                              {option.isLocked && <Lock className="h-3 w-3 mr-1" />}
                              {option.purpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Mat' : (option.purpose || 'Costing')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {option.approvalStatus === 'APPROVED' ? (
                              <Badge variant="default" className="bg-green-600">
                                <Check className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {/* Approve button */}
                              {option.approvalStatus !== 'APPROVED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApprove(option.id)}
                                  disabled={approvingId === option.id}
                                  title="Approve"
                                >
                                  {approvingId === option.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </Button>
                              )}

                              {/* Unapprove button */}
                              {option.approvalStatus === 'APPROVED' && !option.isLocked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnapprove(option.id)}
                                  disabled={unapprovingId === option.id}
                                  title="Unapprove"
                                  className="text-amber-600 hover:text-amber-700"
                                >
                                  {unapprovingId === option.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </Button>
                              )}

                              {/* Promote to Raw Material */}
                              {option.purpose === 'COSTING' && option.approvalStatus === 'APPROVED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePromote(option.id, 'RAW_MATERIAL_CALCULATION')}
                                  disabled={promotingId === option.id}
                                  className="text-amber-600 hover:text-amber-700"
                                  title="Promote to Raw Material Calculation"
                                >
                                  {promotingId === option.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <ArrowRight className="h-3 w-3 mr-1" />
                                      Raw Mat
                                    </>
                                  )}
                                </Button>
                              )}

                              {/* Promote to Production */}
                              {option.purpose === 'RAW_MATERIAL_CALCULATION' && option.approvalStatus === 'APPROVED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePromote(option.id, 'PRODUCTION')}
                                  disabled={promotingId === option.id}
                                  className="text-green-600 hover:text-green-700"
                                  title="Promote to Production"
                                >
                                  {promotingId === option.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <ArrowRight className="h-3 w-3 mr-1" />
                                      Prod
                                    </>
                                  )}
                                </Button>
                              )}

                              {/* Lock indicator */}
                              {option.purpose === 'PRODUCTION' && (
                                <span className="text-muted-foreground text-xs" title="Production records are locked">
                                  <Lock className="h-3 w-3" />
                                </span>
                              )}

                              {/* Delete button */}
                              {!(option.purpose === 'PRODUCTION' && option.isLocked) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  disabled={deletingId === option.id}
                                  onClick={() => handleDeleteClick(option.id, componentName)}
                                >
                                  {deletingId === option.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Costing Option?"
        description={`This will permanently delete this costing option for ${optionToDelete?.componentName || 'this component'}. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
