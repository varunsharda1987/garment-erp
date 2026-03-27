import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { getGenericGreigeStock } from '../services/style-stock.service';
import type { GenericGreigeStock } from '../types/style-stock.types';
import { Search, Package2, Plus, ArrowLeft } from 'lucide-react';
import { logError } from '../lib/logger';

export default function GreigeAvailableStock() {
  const navigate = useNavigate();
  const [greigeStock, setGreigeStock] = useState<GenericGreigeStock[]>([]);
  const [filteredStock, setFilteredStock] = useState<GenericGreigeStock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadGreigeStock();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, greigeStock]);

  const loadGreigeStock = async () => {
    try {
      setIsLoading(true);
      const data = await getGenericGreigeStock();
      setGreigeStock(data);
    } catch (err) {
      logError('Failed to load greige stock:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...greigeStock];

    if (searchTerm) {
      filtered = filtered.filter(
        (stock) =>
          stock.greigeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.greigeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.composition?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // showAgedOnly filter not applicable for GenericGreigeStock (no aging data)
    setFilteredStock(filtered);
  };

  const getTotalStock = () => {
    return filteredStock.reduce((sum, stock) => sum + (stock.totalStock || 0), 0);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-600">
        <Link to="/" className="hover:text-blue-600">
          Home
        </Link>
        {' > '}
        <Link to="/greige" className="hover:text-blue-600">
          Greige Master
        </Link>
        {' > '}
        <span className="font-medium text-gray-900">Stock View</span>
      </div>

      {/* Back Button */}
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/greige')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Greige Master
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package2 className="h-6 w-6 text-blue-600" />
                Generic Greige Stock
              </CardTitle>
              <p className="text-sm text-gray-500 mt-2">
                Available greige fabric stock that can be allocated to any future style
              </p>
            </div>
            <Button onClick={() => navigate('/greige-stock-entry')}>
              <Plus className="h-4 w-4 mr-1" />
              Add Greige Stock
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Total Greige Types</div>
              <div className="text-2xl font-bold text-blue-900">{filteredStock.length}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-medium">Total Stock</div>
              <div className="text-2xl font-bold text-green-900">{getTotalStock().toFixed(2)}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search greige..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Greige Stock List */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg">Loading greige stock...</div>
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 text-gray-500">
              <Package2 className="h-16 w-16 text-gray-300 mb-4" />
              <p>No greige stock found</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/greige-stock-entry')}>
                Add First Greige Stock
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Greige Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Composition</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStock.map((stock) => (
                    <tr key={stock.greigeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">
                        <Link
                          to={`/greige/${stock.greigeId}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {stock.greigeCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{stock.greigeName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{stock.composition}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="font-semibold text-green-600">{(stock.totalStock || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{stock.unit || 'meters'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Info Panel */}
          {filteredStock.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">About Generic Greige Stock</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• This greige is not allocated to any specific style</li>
                <li>• Can be processed (dyed/printed) when you receive orders for new styles</li>
                <li>• Monitor aged stock (6+ months) and consider using it soon</li>
                <li>• Remaining greige after style allocation stays in generic pool</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
