// Job Work Dashboard - Overview of all job work processing
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function JobWorkDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

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
        <h2 className="text-3xl font-display font-medium text-foreground mb-2">Job Work Dashboard</h2>
        <p className="text-muted-foreground">Overview of materials at processors</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Active Batches</div>
          <div className="text-2xl font-bold">0</div>
          <p className="text-xs text-muted-foreground mt-1">Currently being processed</p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Quantity In Process</div>
          <div className="text-2xl font-bold">0</div>
          <p className="text-xs text-muted-foreground mt-1">At processors</p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Quantity In Transit</div>
          <div className="text-2xl font-bold">0</div>
          <p className="text-xs text-muted-foreground mt-1">Being transported</p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Total Cost</div>
          <div className="text-2xl font-bold">₹0</div>
          <p className="text-xs text-muted-foreground mt-1">Incurred so far</p>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Active Processing Batches</h3>
            <button
              onClick={() => navigate('/processing/batches')}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary"
            >
              View All Batches
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center text-muted-foreground py-8">No active processing batches</div>
        </div>
      </div>
    </div>
  );
}
