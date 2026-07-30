// Credit Note Detail - View credit note with items and actions
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Receipt,
  Package,
  IndianRupee,
  Percent,
  FileCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import ConfirmDialog from '@/components/ConfirmDialog';
import { creditNoteService } from '@/services/creditNote.service';
import { CreditNoteReasonLabels, DocumentStatusLabels, DocumentStatusColors } from '@/types/creditNote.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { useState } from 'react';

export default function CreditNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch credit note
  const {
    data: creditNote,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['credit-note', id],
    queryFn: () => creditNoteService.getById(id!),
    enabled: !!id,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: () => creditNoteService.approve(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-note', id] });
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      handleApiSuccess('Credit note approved');
      setApproveDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to approve credit note'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => creditNoteService.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-note', id] });
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      handleApiSuccess('Credit note cancelled');
      setCancelDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to cancel credit note'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => creditNoteService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      handleApiSuccess('Credit note deleted');
      navigate('/financial/credit-notes');
    },
    onError: (err) => handleApiError(err, 'Failed to delete credit note'),
  });

  // Helpers
  const formatDate = (value: string | Date | undefined) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !creditNote) {
    return (
      <div className="container mx-auto py-6">
        <Button variant="ghost" onClick={() => navigate('/financial/credit-notes')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Credit Notes
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">{error ? 'Failed to load credit note' : 'Credit note not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/financial/credit-notes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-display font-medium">{creditNote.creditNoteNumber}</h1>
              <Badge className={`${DocumentStatusColors[creditNote.status]} border`}>
                {DocumentStatusLabels[creditNote.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {CreditNoteReasonLabels[creditNote.reason] || creditNote.reason}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {creditNote.status === 'DRAFT' && (
            <>
              <Button onClick={() => setApproveDialogOpen(true)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{creditNote.customer?.billingName || creditNote.customer?.name || '-'}</p>
                <p className="text-xs text-muted-foreground font-mono">{creditNote.customer?.code}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Against Invoice</p>
                <Link
                  to={`/financial/invoices/${creditNote.invoiceId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {creditNote.invoice?.invoiceNumber || creditNote.invoiceId}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(creditNote.creditNoteDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <IndianRupee className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg">{formatCurrency(creditNote.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Line Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!creditNote.items || creditNote.items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No items</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>HSN Code</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">GST %</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNote.items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="font-mono text-sm">{item.hsnCode || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-mono">{item.gstRate ? `${item.gstRate}%` : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.taxAmount || 0)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(item.totalPrice + (item.taxAmount || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(creditNote.subtotal)}</span>
            </div>

            {creditNote.isInterstate ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IGST</span>
                <span className="font-mono">{formatCurrency(creditNote.igstAmount)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST</span>
                  <span className="font-mono">{formatCurrency(creditNote.cgstAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST</span>
                  <span className="font-mono">{formatCurrency(creditNote.sgstAmount)}</span>
                </div>
              </>
            )}

            <Separator />

            <div className="flex justify-between font-medium">
              <span>Total Amount</span>
              <span className="font-mono text-lg">{formatCurrency(creditNote.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remarks */}
      {creditNote.remarks && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{creditNote.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Audit Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Document Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created By</p>
              <p className="font-medium">
                {creditNote.createdBy ? `${creditNote.createdBy.firstName} ${creditNote.createdBy.lastName}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Created At</p>
              <p className="font-medium">{formatDate(creditNote.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Supply Type</p>
              <p className="font-medium">{creditNote.isInterstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="font-medium">{formatDate(creditNote.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve Credit Note"
        description={`Approving this credit note (${creditNote.creditNoteNumber}) will mark it as finalized. The customer's account will be credited with ${formatCurrency(creditNote.totalAmount)}.`}
        confirmText="Approve"
        onConfirm={() => approveMutation.mutate()}
        isLoading={approveMutation.isPending}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Credit Note"
        description="Are you sure you want to cancel this credit note? This action cannot be undone."
        confirmText="Cancel Credit Note"
        variant="destructive"
        onConfirm={() => cancelMutation.mutate()}
        isLoading={cancelMutation.isPending}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Credit Note"
        description="Are you sure you want to permanently delete this credit note? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
