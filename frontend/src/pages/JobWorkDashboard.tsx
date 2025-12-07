// Job Work Dashboard - Overview of all job work processing
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function JobWorkDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Job Work Dashboard
        </h2>
        <p className="text-gray-600">
          Overview of materials at processors
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Active Batches</div>
          <div className="text-2xl font-bold">0</div>
          <p className="text-xs text-gray-500 mt-1">Currently being processed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Quantity In Process</div>
          <div className="text-2xl font-bold">0</div>
          <p className="text-xs text-gray-500 mt-1">At processors</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Quantity In Transit</div>
          <div className="text-2xl font-bold">0</div>
          <p className="text-xs text-gray-500 mt-1">Being transported</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Cost</div>
          <div className="text-2xl font-bold">₹0</div>
          <p className="text-xs text-gray-500 mt-1">Incurred so far</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Active Processing Batches</h3>
            <button
              onClick={() => navigate('/processing/batches')}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              View All Batches
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center text-gray-500 py-8">
            No active processing batches
          </div>
        </div>
      </div>
    </div>
  );
}
