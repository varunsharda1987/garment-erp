// Processing Batch Detail - View batch details
import { useParams, useNavigate } from 'react-router-dom';

export default function ProcessingBatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <button
          onClick={() => navigate('/processing/batches')}
          className="mb-4 text-primary hover:text-primary flex items-center gap-2"
        >
          ← Back to Batches
        </button>
        <h2 className="text-3xl font-display font-medium text-foreground mb-2">Processing Batch Details</h2>
        <p className="text-muted-foreground">Batch ID: {id}</p>
      </div>

      <div className="bg-card rounded-lg shadow p-6">
        <div className="text-center text-muted-foreground py-8">Loading batch details...</div>
      </div>
    </div>
  );
}
