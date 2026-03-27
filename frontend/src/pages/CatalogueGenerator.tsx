/**
 * Catalogue Generator Page
 *
 * Allows users to generate PDF catalogues from styles with:
 * - Style selection (multi-select + bulk paste)
 * - Category, season, brand category, and price filters
 * - Price display options (B2B, B2R, both, none)
 * - Layout options (1-4 columns per page)
 * - Fabric details, size range, and index toggles
 * - WhatsApp sharing capability
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  BookImage,
  Download,
  Loader2,
  Filter,
  X,
  Image as ImageIcon,
  Clipboard,
  Plus,
  FileText,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { styleService } from '@/services/style.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import api from '@/lib/api';

interface CatalogueStyle {
  id: string;
  styleCode: string;
  styleName: string;
  image?: string;
  imageUrl?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  season?: string;
  sizeRange?: string;
  brandCategories?: { id: string; category: string };
  productCategory?: { id: string; name: string; code?: string };
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

// Constants for pagination
const PAGE_SIZE = 50;
const DISPLAY_PAGE_SIZE = 20;

// Available sizes for filter
const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'];

export default function CatalogueGenerator() {
  // State for styles
  const [styles, setStyles] = useState<CatalogueStyle[]>([]);
  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<string>>(new Set());
  const [isLoadingStyles, setIsLoadingStyles] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [totalStyles, setTotalStyles] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [displayPage, setDisplayPage] = useState(1);

  // State for filters
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedBrandCategory, setSelectedBrandCategory] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  // State for bulk paste
  const [bulkStyleCodes, setBulkStyleCodes] = useState('');
  const [bulkParseError, setBulkParseError] = useState<string | null>(null);

  // State for options
  const [catalogueName, setCatalogueName] = useState('Product Catalogue');
  const [priceDisplay, setPriceDisplay] = useState<PriceDisplay>('b2b');
  const [showFabricDetails, setShowFabricDetails] = useState(false);
  const [showSizeRange, setShowSizeRange] = useState(true);
  const [includeIndex, setIncludeIndex] = useState(false);
  const [columnsPerPage, setColumnsPerPage] = useState<number>(2);

  // State for generation
  const [isGenerating, setIsGenerating] = useState(false);

  // State for WhatsApp sharing
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [storedCatalogueId, setStoredCatalogueId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Fetch styles with pagination
  const fetchStyles = async (page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingStyles(true);
      }

      const response = await styleService.getAllStyles(
        page,
        PAGE_SIZE,
        undefined,
        undefined,
        undefined,
        undefined,
        'ACTIVE'
      );
      const newStyles = (response.data || []).map((style: Record<string, unknown>) => ({
        id: style.id as string,
        styleCode: style.styleCode as string,
        styleName: (style.styleName as string) || '',
        image: style.image as string | undefined,
        imageUrl: style.imageUrl as string | null | undefined,
        costPrice: style.costPrice as number | undefined,
        sellingPrice: style.sellingPrice as number | undefined,
        season: style.season as string | undefined,
        sizeRange: style.sizeRange as string | undefined,
        brandCategories: style.brandCategories as { id: string; category: string } | undefined,
        productCategory: style.productCategory as { id: string; name: string; code?: string } | undefined,
      })) as CatalogueStyle[];

      if (append) {
        setStyles((prev) => [...prev, ...newStyles]);
      } else {
        setStyles(newStyles);
      }

      setTotalStyles(response.pagination?.total || newStyles.length);
      setCurrentPage(page);
    } catch (error) {
      handleApiError(error, 'Failed to load styles');
    } finally {
      setIsLoadingStyles(false);
      setIsLoadingMore(false);
    }
  };

  // Load more styles
  const loadMoreStyles = () => {
    if (!isLoadingMore && styles.length < totalStyles) {
      fetchStyles(currentPage + 1, true);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStyles(1);
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

  // Extract unique brand categories from loaded styles
  const uniqueBrandCategories = useMemo(() => {
    const categories = new Map<string, { id: string; category: string }>();
    styles.forEach((style) => {
      if (style.brandCategories?.id && style.brandCategories?.category) {
        categories.set(style.brandCategories.id, {
          id: style.brandCategories.id,
          category: style.brandCategories.category,
        });
      }
    });
    return Array.from(categories.values()).sort((a, b) => a.category.localeCompare(b.category));
  }, [styles]);

  // Filter styles based on search and filters
  const filteredStyles = useMemo(() => {
    return styles.filter((style) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          style.styleCode?.toLowerCase().includes(search) || style.styleName?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Season filter
      if (selectedSeason && style.season !== selectedSeason) {
        return false;
      }

      // Category filter - use productCategory (camelCase from serializer)
      if (selectedCategory && style.productCategory?.id !== selectedCategory) {
        return false;
      }

      // Brand category filter
      if (selectedBrandCategory && style.brandCategories?.id !== selectedBrandCategory) {
        return false;
      }

      // Size availability filter
      if (selectedSizes.length > 0) {
        const sizeRange = (style.sizeRange || '').toUpperCase();
        if (!selectedSizes.some((size) => sizeRange.includes(size.toUpperCase()))) {
          return false;
        }
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
  }, [styles, searchTerm, selectedSeason, selectedCategory, selectedBrandCategory, selectedSizes, minPrice, maxPrice]);

  // Paginate filtered styles for display
  const paginatedFilteredStyles = useMemo(() => {
    const start = (displayPage - 1) * DISPLAY_PAGE_SIZE;
    return filteredStyles.slice(start, start + DISPLAY_PAGE_SIZE);
  }, [filteredStyles, displayPage]);

  // Total pages for display pagination
  const totalDisplayPages = Math.ceil(filteredStyles.length / DISPLAY_PAGE_SIZE);

  // Reset display page when filters change
  useEffect(() => {
    setDisplayPage(1);
  }, [searchTerm, selectedSeason, selectedCategory, selectedBrandCategory, selectedSizes, minPrice, maxPrice]);

  // Toggle style selection
  const toggleStyleSelection = (styleId: string) => {
    setSelectedStyleIds((prev) => {
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
    const allVisibleIds = new Set(filteredStyles.map((s) => s.id));
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
    setSelectedBrandCategory('');
    setSelectedSizes([]);
    setMinPrice('');
    setMaxPrice('');
  };

  // Toggle size selection
  const toggleSize = (size: string) => {
    setSelectedSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  };

  // Parse bulk style codes
  const parseBulkStyleCodes = (input: string): string[] => {
    // Split by comma, newline, tab, or multiple spaces
    return input
      .split(/[,\n\t]+/)
      .map((code) => code.trim())
      .filter((code) => code.length > 0);
  };

  // Handle bulk paste
  const handleBulkPaste = () => {
    const codes = parseBulkStyleCodes(bulkStyleCodes);
    if (codes.length === 0) {
      setBulkParseError('No valid style codes found');
      return;
    }

    // Find matching styles by styleCode (case-insensitive)
    const matchingStyles = styles.filter((s) => codes.some((code) => s.styleCode.toLowerCase() === code.toLowerCase()));

    if (matchingStyles.length === 0) {
      setBulkParseError(`No styles found matching: ${codes.slice(0, 5).join(', ')}${codes.length > 5 ? '...' : ''}`);
      return;
    }

    // Add to selection
    const newIds = new Set([...selectedStyleIds, ...matchingStyles.map((s) => s.id)]);
    setSelectedStyleIds(newIds);
    setBulkStyleCodes('');
    setBulkParseError(null);

    const notFound = codes.length - matchingStyles.length;
    handleApiSuccess(
      'Styles Added',
      `Added ${matchingStyles.length} styles.${notFound > 0 ? ` ${notFound} not found.` : ''}`
    );
  };

  // Build request body for API calls
  const buildRequestBody = () => ({
    styleIds: Array.from(selectedStyleIds),
    seasons: selectedSeason ? [selectedSeason] : undefined,
    categoryIds: selectedCategory ? [selectedCategory] : undefined,
    brandCategoryIds: selectedBrandCategory ? [selectedBrandCategory] : undefined,
    priceRange:
      minPrice || maxPrice
        ? {
            min: minPrice ? parseFloat(minPrice) : undefined,
            max: maxPrice ? parseFloat(maxPrice) : undefined,
          }
        : undefined,
    priceDisplay,
    showFabricDetails,
    showSizeRange,
    includeIndex,
    columnsPerPage,
    catalogueName,
  });

  // Generate catalogue (download PDF)
  const handleGenerate = async () => {
    if (selectedStyleIds.size === 0) {
      handleApiError(new Error('Please select at least one style'), 'No Styles Selected');
      return;
    }

    try {
      setIsGenerating(true);

      const requestBody = buildRequestBody();

      // Use api.post with blob response type for proper authentication
      const response = await api.post('/documents/catalogue/generate', requestBody, {
        responseType: 'blob',
      });

      // Check if response is an error (JSON content type)
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        const text = await (response.data as Blob).text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || 'Failed to generate catalogue');
      }

      // Download the PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${catalogueName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      handleApiSuccess('Catalogue Generated', `Successfully generated catalogue with ${selectedStyleIds.size} styles.`);
    } catch (error) {
      handleApiError(error, 'Failed to generate catalogue');
    } finally {
      setIsGenerating(false);
    }
  };

  // Prepare catalogue for WhatsApp sharing
  const handlePrepareWhatsApp = async () => {
    if (selectedStyleIds.size === 0) {
      handleApiError(new Error('Please select at least one style'), 'No Styles Selected');
      return;
    }

    try {
      setIsSharing(true);
      const requestBody = buildRequestBody();

      const response = await api.post('/documents/catalogue/store', requestBody);
      setStoredCatalogueId(response.data.data.catalogueId);
      setWhatsappDialogOpen(true);
    } catch (error) {
      handleApiError(error, 'Failed to prepare catalogue for sharing');
    } finally {
      setIsSharing(false);
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = async () => {
    if (!storedCatalogueId || !phoneNumber.trim()) return;

    const cleanPhone = phoneNumber.replace(/[\s\-()]/g, '');
    if (cleanPhone.length < 10) {
      handleApiError(new Error('Please enter a valid phone number'), 'Invalid Phone');
      return;
    }

    try {
      setIsSharing(true);
      const response = await api.get(`/documents/catalogue/${storedCatalogueId}/whatsapp-link`, {
        params: { phone: cleanPhone, catalogueName },
      });

      window.open(response.data.data.whatsappUrl, '_blank');
      setWhatsappDialogOpen(false);
      handleApiSuccess('WhatsApp Opened', 'Click send to share the catalogue.');
    } catch (error) {
      handleApiError(error, 'Failed to generate WhatsApp link');
    } finally {
      setIsSharing(false);
    }
  };

  const hasActiveFilters =
    searchTerm ||
    selectedSeason ||
    selectedCategory ||
    selectedBrandCategory ||
    selectedSizes.length > 0 ||
    minPrice ||
    maxPrice;

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={isGenerating || isSharing || selectedStyleIds.size === 0}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating || isSharing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download ({selectedStyleIds.size})
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleGenerate} className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handlePrepareWhatsApp} className="cursor-pointer">
              <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
              Share via WhatsApp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                <Label>Layout</Label>
                <Select value={columnsPerPage.toString()} onValueChange={(v) => setColumnsPerPage(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Columns per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Column (Large images)</SelectItem>
                    <SelectItem value="2">2 Columns (Default)</SelectItem>
                    <SelectItem value="3">3 Columns (Compact)</SelectItem>
                    <SelectItem value="4">4 Columns (Grid)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Price Display</Label>
                <RadioGroup value={priceDisplay} onValueChange={(v) => setPriceDisplay(v as PriceDisplay)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="b2b" id="b2b" />
                    <Label htmlFor="b2b" className="font-normal">
                      B2B (Cost Price)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="b2r" id="b2r" />
                    <Label htmlFor="b2r" className="font-normal">
                      B2R (MRP)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both" className="font-normal">
                      Both Prices
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="none" />
                    <Label htmlFor="none" className="font-normal">
                      No Prices
                    </Label>
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
                  <Label htmlFor="fabricDetails" className="font-normal">
                    Show Fabric Details
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sizeRange"
                    checked={showSizeRange}
                    onCheckedChange={(checked) => setShowSizeRange(checked as boolean)}
                  />
                  <Label htmlFor="sizeRange" className="font-normal">
                    Show Size Range
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeIndex"
                    checked={includeIndex}
                    onCheckedChange={(checked) => setIncludeIndex(checked as boolean)}
                  />
                  <Label htmlFor="includeIndex" className="font-normal">
                    Include Index Page
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Style Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clipboard className="h-4 w-4" />
                Bulk Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Paste Style Codes</Label>
                <Textarea
                  value={bulkStyleCodes}
                  onChange={(e) => {
                    setBulkStyleCodes(e.target.value);
                    setBulkParseError(null);
                  }}
                  placeholder={'Paste style codes separated by comma or newline:\nKF-001, KF-002\nKF-003'}
                  className="h-24 font-mono text-sm"
                />
                <p className="text-xs text-gray-500">Separate codes with commas, newlines, or tabs</p>
              </div>
              {bulkParseError && <p className="text-xs text-red-600">{bulkParseError}</p>}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkPaste}
                disabled={!bulkStyleCodes.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Styles
              </Button>
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
                <Label>Brand Category</Label>
                <Select
                  value={selectedBrandCategory || '_all'}
                  onValueChange={(v) => setSelectedBrandCategory(v === '_all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Brand Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Brand Categories</SelectItem>
                    {uniqueBrandCategories.map((bc) => (
                      <SelectItem key={bc.id} value={bc.id}>
                        {bc.category}
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
                <Label>Size Availability</Label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_SIZES.map((size) => (
                    <Badge
                      key={size}
                      variant={selectedSizes.includes(size) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs px-2 py-0.5 hover:bg-purple-100"
                      onClick={() => toggleSize(size)}
                    >
                      {size}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Filter by size availability</p>
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
                <CardTitle className="text-base">Select Styles ({filteredStyles.length} available)</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedStyleIds.size} selected</Badge>
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
                <div className="text-center py-12 text-gray-500">No styles found matching your filters.</div>
              ) : (
                <>
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={
                                paginatedFilteredStyles.length > 0 &&
                                paginatedFilteredStyles.every((s) => selectedStyleIds.has(s.id))
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  // Select all on current page
                                  const pageIds = new Set([
                                    ...selectedStyleIds,
                                    ...paginatedFilteredStyles.map((s) => s.id),
                                  ]);
                                  setSelectedStyleIds(pageIds);
                                } else {
                                  // Deselect current page
                                  const pageIdSet = new Set(paginatedFilteredStyles.map((s) => s.id));
                                  setSelectedStyleIds(
                                    new Set([...selectedStyleIds].filter((id) => !pageIdSet.has(id)))
                                  );
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
                        {paginatedFilteredStyles.map((style) => (
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
                                  loading="lazy"
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
                              {style.productCategory?.name || style.brandCategories?.category || '-'}
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

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <div className="text-sm text-gray-500">
                      Showing {(displayPage - 1) * DISPLAY_PAGE_SIZE + 1}-
                      {Math.min(displayPage * DISPLAY_PAGE_SIZE, filteredStyles.length)} of {filteredStyles.length}{' '}
                      styles
                      {totalStyles > styles.length && (
                        <span className="ml-2 text-purple-600">
                          ({styles.length} loaded of {totalStyles} total)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDisplayPage((p) => Math.max(1, p - 1))}
                        disabled={displayPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {displayPage} of {totalDisplayPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDisplayPage((p) => Math.min(totalDisplayPages, p + 1))}
                        disabled={displayPage >= totalDisplayPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  {/* Load More Button */}
                  {totalStyles > styles.length && (
                    <div className="flex justify-center pt-4">
                      <Button variant="outline" onClick={loadMoreStyles} disabled={isLoadingMore}>
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Load More Styles ({styles.length} of {totalStyles})
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* WhatsApp Share Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Share via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Share "{catalogueName}" via WhatsApp. The recipient will receive a download link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter phone number (e.g., 9876543210)"
              />
              <p className="text-xs text-gray-500">Include country code without + (e.g., 919876543210 for India)</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappDialogOpen(false)} disabled={isSharing}>
              Cancel
            </Button>
            <Button
              onClick={handleShareWhatsApp}
              disabled={isSharing || !phoneNumber.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSharing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Open WhatsApp
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
