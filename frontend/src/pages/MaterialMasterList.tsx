import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { materialMasterService } from '../services/materialMaster.service';
import { MaterialType, MaterialTypeLabels, MaterialTypeCategories } from '../types/material-master.types';
import type { MaterialMaster } from '../types/material-master.types';

export default function MaterialMasterList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [materials, setMaterials] = useState<MaterialMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const selectedType = (searchParams.get('type') as MaterialType) || null;
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [activeOnly, setActiveOnly] = useState(searchParams.get('active') !== 'false');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, activeOnly]);

  const loadMaterials = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await materialMasterService.getAll({
        type: selectedType || undefined,
        // 'Active Only' → active=true; 'All Status' → omit the param so the backend
        // applies no isActive filter (returns both active and inactive materials).
        active: activeOnly ? true : undefined,
        search: searchTerm || undefined,
      });
      setMaterials(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
      console.error('Error loading materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (selectedType) params.type = selectedType;
    if (searchTerm) params.search = searchTerm;
    if (!activeOnly) params.active = 'false';
    setSearchParams(params);
    loadMaterials();
  };

  const handleTypeChange = (type: MaterialType | null) => {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    if (searchTerm) params.search = searchTerm;
    if (!activeOnly) params.active = 'false';
    setSearchParams(params);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    if (category === 'all') {
      handleTypeChange(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will set it as inactive.`)) {
      return;
    }

    try {
      await materialMasterService.delete(id);
      loadMaterials();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete material');
    }
  };

  const formatPrice = (material: MaterialMaster) => {
    const currency = material.currency?.symbol || '₹';
    if (material.pricePerMeter) {
      return `${currency}${material.pricePerMeter}/m`;
    }
    if (material.pricePerPiece) {
      return `${currency}${material.pricePerPiece}/pc`;
    }
    if (material.pricePerKg) {
      return `${currency}${material.pricePerKg}/kg`;
    }
    if (material.pricePerGross) {
      return `${currency}${material.pricePerGross}/gross`;
    }
    if (material.pricePerUnit) {
      return `${currency}${material.pricePerUnit}/${material.unit || 'unit'}`;
    }
    return '-';
  };

  // Get material types for current category
  const getTypesForCategory = () => {
    if (selectedCategory === 'all') {
      return Object.values(MaterialType);
    }
    return MaterialTypeCategories[selectedCategory as keyof typeof MaterialTypeCategories] || [];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Layers className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-display font-medium text-foreground">Material Masters</h1>
            <p className="text-sm text-muted-foreground">Unified management for all material types</p>
          </div>
        </div>
        <Button onClick={() => navigate('/material-master/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Material
        </Button>
      </div>

      {/* Category Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={selectedCategory} onValueChange={handleCategoryChange}>
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              {Object.keys(MaterialTypeCategories).map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Type Filter Chips */}
      {selectedCategory !== 'all' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={!selectedType ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleTypeChange(null)}
              >
                All
              </Badge>
              {getTypesForCategory().map((type) => (
                <Badge
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleTypeChange(type)}
                >
                  {MaterialTypeLabels[type]}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search materials by code, name, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <Select
                value={activeOnly ? 'active' : 'all'}
                onValueChange={(value) => setActiveOnly(value === 'active')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button onClick={handleSearch} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Showing {materials.length} material{materials.length !== 1 ? 's' : ''}
            {selectedType && ` (${MaterialTypeLabels[selectedType]})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No materials found. Try adjusting your filters or create a new material.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Specifications</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Suppliers</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">{material.code}</TableCell>

                      <TableCell>
                        <div>
                          <div className="font-medium">{material.name}</div>
                          {material.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {material.description.substring(0, 50)}
                              {material.description.length > 50 && '...'}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{MaterialTypeLabels[material.materialType]}</Badge>
                      </TableCell>

                      <TableCell>{formatPrice(material)}</TableCell>

                      <TableCell>
                        {material.specifications && Object.keys(material.specifications).length > 0 ? (
                          <div className="text-sm text-muted-foreground">
                            {Object.entries(material.specifications)
                              .slice(0, 2)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(', ')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant={material.isActive ? 'default' : 'secondary'}>
                          {material.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>

                      <TableCell>{material.suppliers?.length || 0}</TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/material-master/${material.id}/edit`)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(material.id, material.name)}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
  );
}
