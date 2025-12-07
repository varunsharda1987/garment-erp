// Processing Batch List - View all job work processing batches
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProcessingBatchList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Processing Batches
        </h2>
        <p className="text-gray-600">
          View and manage all job work processing batches
        </p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">All Batches</h3>
            <button
              onClick={() => navigate('/processing/job-work')}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center text-gray-500 py-8">
            No processing batches found
          </div>
        </div>
      </div>
    </div>
  );
}
