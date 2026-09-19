/**
 * Test Requirement Forms — list.
 *
 * Every TRF ever raised, newest first, with the print button. Printing from here rather than
 * only from the form matters: the common action is reprinting a sheet that was lost or needs
 * to go with a second sample, not editing one.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, Printer, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buyerTrfService } from '@/services/buyerTrf.service';
import { openPDF } from '@/lib/document-utils';
import { handleApiError } from '@/lib/api-error-handler';
import type { BuyerTrf, TrfStatus } from '@/types/buyerTrf.types';

const STATUS_VARIANT: Record<TrfStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  ISSUED: 'secondary',
  SENT_TO_LAB: 'default',
  CLOSED: 'secondary',
};

const STATUS_LABEL: Record<TrfStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  SENT_TO_LAB: 'Sent to lab',
  CLOSED: 'Closed',
};

export default function BuyerTrfList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['buyer-trfs', { page, search }],
    queryFn: () => buyerTrfService.getAll({ page, limit: 20, search: search || undefined }),
  });

  const handlePrint = async (trf: BuyerTrf) => {
    setPrintingId(trf.id);
    try {
      await openPDF(`/documents/buyer-trfs/${trf.id}/pdf`);
    } catch (error) {
      handleApiError(error, 'Could not open the form');
    } finally {
      setPrintingId(null);
    }
  };

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileText className="h-6 w-6" />
            Test Requirement Forms
          </h1>
          <p className="text-sm text-muted-foreground">
            The sheet that goes to the lab with a garment sample. Raise one, print it, keep the record.
          </p>
        </div>
        <Button onClick={() => navigate('/test-requirement-forms/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New TRF
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All forms</CardTitle>
          <CardDescription>Search by TRF number, style, buyer order number or colour.</CardDescription>
          <div className="relative mt-2 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search forms…"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? 'No forms match that search.' : 'No test requirement forms yet.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TRF No.</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Order No.</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Linked to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((trf) => (
                  <TableRow
                    key={trf.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/test-requirement-forms/${trf.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{trf.trfNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{trf.styleNo ?? trf.style?.styleCode ?? '—'}</div>
                      {trf.style?.styleName && (
                        <div className="text-xs text-muted-foreground">{trf.style.styleName}</div>
                      )}
                    </TableCell>
                    <TableCell>{trf.customer?.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{trf.orderNumber ?? '—'}</TableCell>
                    <TableCell>{trf.sampleStage === 'PP' ? 'PP' : 'Shipment'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {trf.saleOrder
                        ? `SO ${trf.saleOrder.saleOrderNumber}`
                        : trf.workOrder
                          ? `WO ${trf.workOrder.workOrderNumber}`
                          : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[trf.status]}>{STATUS_LABEL[trf.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={printingId === trf.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePrint(trf);
                        }}
                      >
                        {printingId === trf.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="mr-2 h-4 w-4" />
                        )}
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm">
              <span className="text-muted-foreground">
                Showing {rows.length} of {pagination.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
