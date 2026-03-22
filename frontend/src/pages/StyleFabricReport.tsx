import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getStyleStock } from '../services/style-stock.service';
import type { StyleStockAvailability } from '../types/style-stock.types';
import { getAllStyles } from '../services/style.service';
import { ChevronDown, ChevronRight, Search, Package } from 'lucide-react';
import { logError } from '../lib/logger';

interface Style {
  id: string;
  styleCode: string;
  styleName: string;
  customerName?: string;
  season?: string | null;
  projectGroup?: string;
}

interface StyleWithStock extends Style {
  stockData?: StyleStockAvailability;
  isExpanded: boolean;
  isLoading: boolean;
}

export default function StyleFabricReport() {
  const navigate = useNavigate();
  const [styles, setStyles] = useState<StyleWithStock[]>([]);
  const [filteredStyles, setFilteredStyles] = useState<StyleWithStock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBuyer, setFilterBuyer] = useState('all');
  const [filterSeason, setFilterSeason] = useState('all');
  const [filterStockStatus, setFilterStockStatus] = useState('all');

  useEffect(() => {
    loadStyles();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterBuyer, filterSeason, filterStockStatus, styles]);

  const loadStyles = async () => {
    try {
      setIsLoading(true);
      const response = await getAllStyles(1, 100, undefined, undefined, undefined, undefined, 'ACTIVE');
      const stylesData = response.data.map((style: Style) => ({
        ...style,
        isExpanded: false,
        isLoading: false,
      }));
      setStyles(stylesData);
    } catch (err) {
      logError('Failed to load styles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...styles];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (style) =>
          style.styleCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          style.styleName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Buyer filter
    if (filterBuyer && filterBuyer !== 'all') {
      filtered = filtered.filter((style) => style.customerName === filterBuyer);
    }

    // Season filter
    if (filterSeason && filterSeason !== 'all') {
      filtered = filtered.filter((style) => style.season === filterSeason);
    }

    // Stock status filter
    if (filterStockStatus !== 'all') {
      filtered = filtered.filter((style) => {
        if (!style.stockData) return filterStockStatus === 'no-stock';

        const hasStock = style.stockData.canMakeGarments > 0;
        const isLowStock = style.stockData.canMakeGarments > 0 && style.stockData.canMakeGarments < 50;

        if (filterStockStatus === 'has-stock') return hasStock;
        if (filterStockStatus === 'low-stock') return isLowStock;
        if (filterStockStatus === 'no-stock') return !hasStock;

        return true;
      });
    }

    setFilteredStyles(filtered);
  };

  const toggleExpand = async (styleId: string) => {
    const updatedStyles = styles.map((style) => {
      if (style.id === styleId) {
        if (!style.isExpanded && !style.stockData) {
          // Load stock data
          loadStockData(styleId);
        }
        return { ...style, isExpanded: !style.isExpanded };
      }
      return style;
    });
    setStyles(updatedStyles);
  };

  const loadStockData = async (styleId: string) => {
    try {
      setStyles((prev) => prev.map((s) => (s.id === styleId ? { ...s, isLoading: true } : s)));

      const stockData = await getStyleStock(styleId);

      setStyles((prev) => prev.map((s) => (s.id === styleId ? { ...s, stockData, isLoading: false } : s)));
    } catch (err) {
      logError('Failed to load stock data:', err);
      setStyles((prev) => prev.map((s) => (s.id === styleId ? { ...s, isLoading: false } : s)));
    }
  };

  const uniqueBuyers = Array.from(new Set(styles.map((s) => s.customerName).filter(Boolean)));
  const uniqueSeasons = Array.from(new Set(styles.map((s) => s.season).filter(Boolean)));

  const getStockStatusBadge = (style: StyleWithStock) => {
    if (!style.stockData) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Unknown</span>;
    }

    const canMake = style.stockData.canMakeGarments;

    if (canMake === 0) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">No Stock</span>;
    } else if (canMake < 50) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Low Stock</span>;
    } else {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">In Stock</span>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Style Fabric Report</CardTitle>
              <p className="text-sm text-gray-500 mt-2">View fabric usage and stock availability for all styles</p>
            </div>
            <Button onClick={() => navigate('/styles/import')}>Import Styles</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search styles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterBuyer} onValueChange={setFilterBuyer}>
              <SelectTrigger>
                <SelectValue placeholder="All Buyers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buyers</SelectItem>
                {uniqueBuyers.map((buyer) => (
                  <SelectItem key={buyer} value={buyer || ''}>
                    {buyer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSeason} onValueChange={setFilterSeason}>
              <SelectTrigger>
                <SelectValue placeholder="All Seasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {uniqueSeasons.map((season) => (
                  <SelectItem key={season} value={season || ''}>
                    {season}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStockStatus} onValueChange={setFilterStockStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="has-stock">Has Stock</SelectItem>
                <SelectItem value="low-stock">Low Stock</SelectItem>
                <SelectItem value="no-stock">No Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Styles List */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg">Loading styles...</div>
            </div>
          ) : filteredStyles.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-gray-500">
              No styles found matching the filters
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStyles.map((style) => (
                <div key={style.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Style Header */}
                  <div
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => toggleExpand(style.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {style.isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}

                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900">{style.styleCode}</h3>
                          {getStockStatusBadge(style)}
                        </div>
                        <p className="text-sm text-gray-600">{style.styleName}</p>
                        {(style.customerName || style.season || style.projectGroup) && (
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            {style.customerName && <span>Buyer: {style.customerName}</span>}
                            {style.season && <span>Season: {style.season}</span>}
                            {style.projectGroup && <span>Project: {style.projectGroup}</span>}
                          </div>
                        )}
                      </div>

                      {style.stockData && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">{style.stockData.canMakeGarments}</div>
                          <div className="text-xs text-gray-500">Can Make</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {style.isExpanded && (
                    <div className="p-4 bg-white border-t">
                      {style.isLoading ? (
                        <div className="text-center py-4 text-gray-500">Loading stock data...</div>
                      ) : style.stockData ? (
                        <div className="space-y-4">
                          {/* Fabric Stock Table */}
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Component
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Fabric Code
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Fabric Name
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Req/Garment
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Available
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Reserved
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Can Make
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {style.stockData.fabricStocks.map((fabric) => (
                                  <tr key={fabric.fabricId}>
                                    <td className="px-4 py-3 text-sm text-gray-900">{fabric.componentName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{fabric.fabricCode}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{fabric.fabricName}</td>
                                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                                      {fabric.requiredPerGarment.toFixed(2)}m
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                      <span className="text-green-600 font-medium">
                                        {fabric.availableStock.toFixed(2)}m
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                      <span className="text-yellow-600">{fabric.reservedStock.toFixed(2)}m</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                      <span
                                        className={`font-semibold ${
                                          fabric.canMakeGarments === style.stockData!.canMakeGarments
                                            ? 'text-red-600'
                                            : 'text-gray-900'
                                        }`}
                                      >
                                        {fabric.canMakeGarments}
                                        {fabric.canMakeGarments === style.stockData!.canMakeGarments && (
                                          <span className="ml-1 text-xs">(Bottleneck)</span>
                                        )}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 justify-end pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/styles/${style.id}/stock-entry`);
                              }}
                            >
                              <Package className="h-4 w-4 mr-1" />
                              Add Fabric Stock
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/styles/${style.id}`);
                              }}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">No stock data available</div>
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
