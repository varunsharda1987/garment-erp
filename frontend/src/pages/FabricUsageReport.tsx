import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  getFabricStyles,
  getFabricStockHistory,
  type FabricStyleUsage,
  type FabricStockHistoryEntry,
} from '../services/style-stock.service';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { logError } from '../lib/logger';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface Fabric {
  id: string;
  fabricCode: string;
  fabricName: string;
  styleReference?: string;
  componentType?: string;
  actualWidth: number;
}

interface FabricWithUsage extends Fabric {
  styles?: FabricStyleUsage[];
  stockHistory?: FabricStockHistoryEntry[];
  isExpanded: boolean;
  isLoading: boolean;
}

export default function FabricUsageReport() {
  const [fabrics, setFabrics] = useState<FabricWithUsage[]>([]);
  const [filteredFabrics, setFilteredFabrics] = useState<FabricWithUsage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByStyle, setFilterByStyle] = useState('');

  useEffect(() => {
    loadFabrics();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterByStyle, fabrics]);

  const loadFabrics = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/fabric-management/fabric`);
      const fabricsData = response.data.data.map((fabric: Fabric) => ({
        ...fabric,
        isExpanded: false,
        isLoading: false,
      }));
      setFabrics(fabricsData);
    } catch (err) {
      logError('Failed to load fabrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...fabrics];

    if (searchTerm) {
      filtered = filtered.filter(
        (fabric) =>
          fabric.fabricCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fabric.fabricName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterByStyle) {
      filtered = filtered.filter((fabric) =>
        fabric.styleReference?.toLowerCase().includes(filterByStyle.toLowerCase())
      );
    }

    setFilteredFabrics(filtered);
  };

  const toggleExpand = async (fabricId: string) => {
    const updatedFabrics = fabrics.map((fabric) => {
      if (fabric.id === fabricId) {
        if (!fabric.isExpanded && !fabric.styles) {
          loadFabricData(fabricId);
        }
        return { ...fabric, isExpanded: !fabric.isExpanded };
      }
      return fabric;
    });
    setFabrics(updatedFabrics);
  };

  const loadFabricData = async (fabricId: string) => {
    try {
      setFabrics((prev) => prev.map((f) => (f.id === fabricId ? { ...f, isLoading: true } : f)));

      const [stylesData, stockHistoryData] = await Promise.all([
        getFabricStyles(fabricId),
        getFabricStockHistory(fabricId),
      ]);

      setFabrics((prev) =>
        prev.map((f) =>
          f.id === fabricId ? { ...f, styles: stylesData, stockHistory: stockHistoryData, isLoading: false } : f
        )
      );
    } catch (err) {
      logError('Failed to load fabric data:', err);
      setFabrics((prev) => prev.map((f) => (f.id === fabricId ? { ...f, isLoading: false } : f)));
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Fabric Usage Report</CardTitle>
          <p className="text-sm text-gray-500 mt-2">View which styles use each fabric and stock allocation details</p>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search fabrics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Input
              type="text"
              placeholder="Filter by style reference..."
              value={filterByStyle}
              onChange={(e) => setFilterByStyle(e.target.value)}
            />
          </div>

          {/* Fabrics List */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg">Loading fabrics...</div>
            </div>
          ) : filteredFabrics.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-gray-500">
              No fabrics found matching the filters
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFabrics.map((fabric) => (
                <div key={fabric.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Fabric Header */}
                  <div
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => toggleExpand(fabric.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {fabric.isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}

                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{fabric.fabricCode}</h3>
                        <p className="text-sm text-gray-600">{fabric.fabricName}</p>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          {fabric.styleReference && <span>Style: {fabric.styleReference}</span>}
                          {fabric.componentType && <span>Component: {fabric.componentType}</span>}
                          <span>Width: {fabric.actualWidth}"</span>
                        </div>
                      </div>

                      {fabric.styles && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">{fabric.styles.length}</div>
                          <div className="text-xs text-gray-500">Styles</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {fabric.isExpanded && (
                    <div className="p-4 bg-white border-t">
                      {fabric.isLoading ? (
                        <div className="text-center py-4 text-gray-500">Loading usage data...</div>
                      ) : (
                        <div className="space-y-6">
                          {/* Styles Using This Fabric */}
                          {fabric.styles && fabric.styles.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">
                                Used in {fabric.styles.length} Style(s)
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Style Code
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Style Name
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Component
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        CAD (meters)
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Allocated
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Consumed
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {fabric.styles.map((style, index) => (
                                      <tr key={index}>
                                        <td className="px-4 py-3 text-sm text-gray-900">{style.styleCode}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{style.styleName}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{style.componentName}</td>
                                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                                          {(style.quantityPerGarment ?? 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-blue-600">-</td>
                                        <td className="px-4 py-3 text-sm text-right text-green-600">-</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Stock History */}
                          {fabric.stockHistory && fabric.stockHistory.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">
                                Stock History ({fabric.stockHistory.length} Records)
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        ID
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Quantity
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Width
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Roll Numbers
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Warehouse
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Cost
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Received
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {fabric.stockHistory.map((stock, index) => (
                                      <tr key={index}>
                                        <td className="px-4 py-3 text-sm text-gray-900">{stock.id.slice(0, 8)}...</td>
                                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                                          {stock.quantity.toFixed(2)}m
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-gray-600">{stock.width}"</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{stock.rollNumbers || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                          {stock.warehouseLocation || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-green-600">
                                          {stock.purchaseCost ? `₹${stock.purchaseCost.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                          {stock.receivedDate
                                            ? new Date(stock.receivedDate).toLocaleDateString()
                                            : 'N/A'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {(!fabric.styles || fabric.styles.length === 0) &&
                            (!fabric.stockHistory || fabric.stockHistory.length === 0) && (
                              <div className="text-center py-4 text-gray-500">
                                No usage data available for this fabric
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
