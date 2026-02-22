/**
 * Catalogue Generator Page
 *
 * Allows users to generate PDF catalogues from styles with:
 * - Style selection (multi-select)
 * - Category, season, and price filters
 * - Price display options (B2B, B2R, both, none)
 * - Fabric details and size range toggles
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BookImage, Download, Loader2, Filter, X, Image as ImageIcon } from 'lucide-react';
import { styleService } from '@/services/style.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import api from '@/lib/api';

interface Style {
  id: string;
  styleCode: string;
  styleName: string;
  image?: string;
  imageUrl?: string;
  costPrice?: number;
  sellingPrice?: number;
  season?: string;
  brandCategories?: { id: string; category: string };
  productCategories?: { id: string; categoryName: string };
}

interface Season {
  id: string;
  name: string;
  code: string;
}

interface ProductCategory {
  id: string;
  categoryName: string;
}

type PriceDisplay = 'b2b' | 'b2r' | 'both' | 'none';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function CatalogueGenerator() {
  // State for styles
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<string>>(new Set());
  const [isLoadingStyles, setIsLoadingStyles] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // State for filters
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  // State for options
  const [catalogueName, setCatalogueName] = useState('Product Catalogue');
  const [priceDisplay, setPriceDisplay] = useState<PriceDisplay>('b2b');
  const [showFabricDetails, setShowFabricDetails] = useState(false);
  const [showSizeRange, setShowSizeRange] = useState(true);

  // State for generation
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch styles
  useEffect(() => {
    const fetchStyles = async () => {
      try {
        setIsLoadingStyles(true);
        const response = await styleService.getAllStyles(1, 500); // Get up to 500 styles
        setStyles(response.data || []);
      } catch (error) {
        handleApiError(error, 'Failed to load styles');
      } finally {
        setIsLoadingStyles(false);
      }
    };

    fetchStyles();
  }, []);

  // Fetch seasons and categories
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        // Fetch seasons
        const seasonsRes = await api.get('/seasons');
        setSeasons(seasonsRes.data.data || []);

        // Fetch product categories
        const categoriesRes = await api.get('/product-categories');
        setProductCategories(categoriesRes.data.data || []);
      } catch (error) {
        console.error('Failed to load filters:', error);
      }
    };

    fetchFilters();
  }, []);

  // Filter styles based on search and filters
  const filteredStyles = useMemo(() => {
    return styles.filter(style => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          style.styleCode?.toLowerCase().includes(search) ||
          style.styleName?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Season filter
      if (selectedSeason && style.season !== selectedSeason) {
        return false;
      }

      // Category filter
      if (selectedCategory && style.productCategories?.id !== selectedCategory) {
        return false;
      }

      // Price range filter
      const price = style.sellingPrice || style.costPrice || 0;
      if (minPrice && price < parseFloat(minPrice)) {
        return false;
      }
      if (maxPrice && price > parseFloat(maxPrice)) {
        return false;
      }

      return true;
    });
  }, [styles, searchTerm, selectedSeason, selectedCategory, minPrice, maxPrice]);

  // Toggle style selection
  const toggleStyleSelection = (styleId: string) => {
    setSelectedStyleIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(styleId)) {
        newSet.delete(styleId);
      } else {
        newSet.add(styleId);
      }
      return newSet;
    });
  };

  // Select all visible styles
  const selectAllVisible = () => {
    const allVisibleIds = new Set(filteredStyles.map(s => s.id));
    setSelectedStyleIds(allVisibleIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedStyleIds(new Set());
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSeason('');
    setSelectedCategory('');
    setMinPrice('');
    setMaxPrice('');
  };

  // Generate catalogue
  const handleGenerate = async () => {
    if (selectedStyleIds.size === 0) {
      handleApiError(new Error('Please select at least one style'), 'No Styles Selected');
      return;
    }

    try {
      setIsGenerating(true);

      const requestBody = {
        styleIds: Array.from(selectedStyleIds),
        seasons: selectedSeason ? [selectedSeason] : undefined,
        categoryIds: selectedCategory ? [selectedCategory] : undefined,
        priceRange: (minPrice || maxPrice) ? {
          min: minPrice ? parseFloat(minPrice) : undefined,
          max: maxPrice ? parseFloat(maxPrice) : undefined,
        } : undefined,
        priceDisplay,
        showFabricDetails,
        showSizeRange,
        catalogueName,
      };

      const response = await fetch(`${API_BASE}/documents/catalogue/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate catalogue');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${catalogueName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      handleApiSuccess(
        'Catalogue Generated',
        `Successfully generated catalogue with ${selectedStyleIds.size} styles.`
      );
    } catch (error) {
      handleApiError(error, 'Failed to generate catalogue');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasActiveFilters = searchTerm || selectedSeason || selectedCategory || minPrice || maxPrice;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <BookImage className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catalogue Generator</h1>
            <p className="text-sm text-gray-500">Create PDF catalogues from your styles</p>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || selectedStyleIds.size === 0}
          className="gap-2 bg-purple-600 hover:bg-purple-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Generate PDF ({selectedStyleIds.size})
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel - Filters & Options */}
        <div className="space-y-4">
          {/* Catalogue Options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Catalogue Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="catalogueName">Catalogue Name</Label>
                <Input
                  id="catalogueName"
                  value={catalogueName}
                  onChange={(e) => setCatalogueName(e.target.value)}
                  placeholder="Enter catalogue name"
                />
              </div>

              <div className="space-y-2">
                <Label>Price Display</Label>
                <RadioGroup value={priceDisplay} onValueChange={(v) => setPriceDisplay(v as PriceDisplay)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="b2b" id="b2b" />
                    <Label htmlFor="b2b" className="font-normal">B2B (Cost Price)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="b2r" id="b2r" />
                    <Label htmlFor="b2r" className="font-normal">B2R (MRP)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both" className="font-normal">Both Prices</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="none" />
                    <Label htmlFor="none" className="font-normal">No Prices</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fabricDetails"
                    checked={showFabricDetails}
                    onCheckedChange={(checked) => setShowFabricDetails(checked as boolean)}
                  />
                  <Label htmlFor="fabricDetails" className="font-normal">Show Fabric Details</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sizeRange"
                    checked={showSizeRange}
                    onCheckedChange={(checked) => setShowSizeRange(checked as boolean)}
                  />
                  <Label htmlFor="sizeRange" className="font-normal">Show Size Range</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Style code or name..."
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={selectedCategory || '_all'}
                  onValueChange={(v) => setSelectedCategory(v === '_all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Categories</SelectItem>
                    {productCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Season</Label>
                <Select
                  value={selectedSeason || '_all'}
                  onValueChange={(v) => setSelectedSeason(v === '_all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Seasons" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Seasons</SelectItem>
                    {seasons.map((season) => (
                      <SelectItem key={season.id} value={season.name}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Price Range</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Min"
                    className="w-full"
                  />
                  <span className="text-gray-400">-</span>
                  <Input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max"
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Style Selection */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Select Styles ({filteredStyles.length} available)
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedStyleIds.size} selected
                  </Badge>
                  <Button variant="outline" size="sm" onClick={selectAllVisible}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingStyles ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : filteredStyles.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No styles found matching your filters.
                </div>
              ) : (
                <div className="overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={filteredStyles.length > 0 && filteredStyles.every(s => selectedStyleIds.has(s.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                selectAllVisible();
                              } else {
                                clearSelection();
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="w-16">Image</TableHead>
                        <TableHead>Style Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Season</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStyles.map((style) => (
                        <TableRow
                          key={style.id}
                          className={`cursor-pointer ${selectedStyleIds.has(style.id) ? 'bg-purple-50' : ''}`}
                          onClick={() => toggleStyleSelection(style.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedStyleIds.has(style.id)}
                              onCheckedChange={() => toggleStyleSelection(style.id)}
                            />
                          </TableCell>
                          <TableCell>
                            {style.image || style.imageUrl ? (
                              <img
                                src={style.imageUrl || `/uploads/${style.image}`}
                                alt={style.styleCode}
                                className="w-12 h-12 object-cover rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '';
                                  (e.target as HTMLImageElement).className = 'hidden';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{style.styleCode}</TableCell>
                          <TableCell>{style.styleName || '-'}</TableCell>
                          <TableCell>
                            {style.productCategories?.categoryName ||
                             style.brandCategories?.category || '-'}
                          </TableCell>
                          <TableCell>{style.season || '-'}</TableCell>
                          <TableCell className="text-right">
                            {style.sellingPrice ? formatCurrency(style.sellingPrice) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
