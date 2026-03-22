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
          className="mb-4 text-indigo-600 hover:text-indigo-800 flex items-center gap-2"
        >
          ← Back to Batches
        </button>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Processing Batch Details</h2>
        <p className="text-gray-600">Batch ID: {id}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500 py-8">Loading batch details...</div>
      </div>
    </div>
  );
}
