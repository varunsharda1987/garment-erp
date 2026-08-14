// BUG-DASH4 fix: corrected route path - Unified Job Work Order Detail Page
// Route: /manufacturing/processing/job-work/:id
// Fetches the Job Work Order to determine its type, then redirects to dyeing or printing detail
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { dyeProcessPOService } from '@/services/dyeing.service';

export default function UnifiedProcessPODetail() {
  const { id } = useParams<{ id: string }>();

  // Try to fetch from dyeing first - if it exists, it's a dyeing PO
  const { data: dyePO, isLoading } = useQuery({
    queryKey: ['unified-process-po-check', id],
    queryFn: async () => {
      if (!id) throw new Error('No ID');
      try {
        // Try dyeing first
        return { type: 'DYEING', po: await dyeProcessPOService.getById(id) };
      } catch {
        // If not found in dyeing, it must be printing
        return { type: 'PRINTING', po: null };
      }
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect to the appropriate type-specific detail page
  if (dyePO?.type === 'DYEING' && dyePO.po) {
    return <Navigate to={`/manufacturing/dyeing/job-work/${id}`} replace />;
  } else {
    return <Navigate to={`/manufacturing/printing/job-work/${id}`} replace />;
  }
}
