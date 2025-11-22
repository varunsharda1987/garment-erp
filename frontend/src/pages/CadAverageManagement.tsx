import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CadAverageInput } from '../components/CadAverageInput';
import { styleService } from '../services/style.service';
import type { Style } from '../types/style.types';
import type { CadAverageFormData } from '../types/cad-types';
import { toast } from 'react-hot-toast';
import { Search, Edit, Plus } from 'lucide-react';
import { logError } from '../lib/logger';

export default function CadAverageManagement() {
  const navigate = useNavigate();
  const [styles, setStyles] = useState<Style[]>([]);
  const [filteredStyles, setFilteredStyles] = useState<Style[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Load all styles
  useEffect(() => {
    const loadStyles = async () => {
      try {
        const response = await styleService.getAllStyles({ page: 1, limit: 1000 });
        setStyles(response.data);
        setFilteredStyles(response.data);
      } catch (error) {
        logError('Failed to load styles:', error);
        toast.error('Failed to load styles');
      }
    };
    loadStyles();
  }, []);

  // Filter styles based on search
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStyles(styles);
    } else {
      const filtered = styles.filter(
        (style) =>
          style.styleCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          style.styleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          style.buyerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStyles(filtered);
    }
  }, [searchTerm, styles]);

  // Load selected style
  const handleStyleSelect = async (styleId: string) => {
    setSelectedStyleId(styleId);
    if (!styleId) {
      setSelectedStyle(null);
      return;
    }

    try {
      setLoading(true);
      const style = await styleService.getStyleById(styleId);
      setSelectedStyle(style);
    } catch (error) {
      logError('Failed to load style:', error);
      toast.error('Failed to load style details');
    } finally {
      setLoading(false);
    }
  };

  // Update CAD averages for a fabric
  const handleUpdateCadAverages = async (
    componentIndex: number,
    fabricIndex: number,
    cadAverages: CadAverageFormData[]
  ) => {
    if (!selectedStyle) return;

    try {
      setLoading(true);

      // Create updated style data
      const updatedComponents = [...selectedStyle.components];
      const updatedFabrics = [...updatedComponents[componentIndex].fabrics];
      updatedFabrics[fabricIndex] = {
        ...updatedFabrics[fabricIndex],
        cadAverages,
      };
      updatedComponents[componentIndex] = {
        ...updatedComponents[componentIndex],
        fabrics: updatedFabrics,
      };

      // Update via API
      await styleService.updateStyle(selectedStyle.id, {
        components: updatedComponents.map((comp) => ({
          componentName: comp.componentName,
          componentType: comp.componentType,
          sortOrder: comp.sortOrder,
          fabrics: comp.fabrics.map((fab) => ({
            fabricName: fab.fabricName,
            fabricType: fab.fabricType,
            fabricColor: fab.fabricColor || undefined,
            fabricGSM: fab.fabricGSM || undefined,
            fabricWidth: fab.fabricWidth || undefined,
            cadAverageMeters: fab.cadAverageMeters || undefined,
            cadAverageYards: fab.cadAverageYards || undefined,
            supplierName: fab.supplierName || undefined,
            unitPrice: fab.unitPrice || undefined,
            greigeName: fab.greigeName || undefined,
            cadAverages: fab.cadAverages || [],
          })),
          accessories: comp.accessories.map((acc) => ({
            accessoryName: acc.accessoryName,
            accessoryType: acc.accessoryType,
            quantityPerPiece: acc.quantityPerPiece,
            unit: acc.unit,
            supplierName: acc.supplierName || undefined,
            unitPrice: acc.unitPrice || undefined,
          })),
        })),
      });

      // Reload style to get updated data
      const updatedStyle = await styleService.getStyleById(selectedStyle.id);
      setSelectedStyle(updatedStyle);

      toast.success('CAD averages updated successfully');
    } catch (error) {
      logError('Failed to update CAD averages:', error);
      toast.error('Failed to update CAD averages');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">CAD Average Management</h1>
          <p className="text-gray-600 mt-1">
            Manage fabric CAD consumption for different widths
          </p>
        </div>
        <Button onClick={() => navigate('/styles/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Style
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Style Selection Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Select Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search styles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Style Dropdown */}
              <div>
                <Label>Style</Label>
                <Select value={selectedStyleId} onValueChange={handleStyleSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a style" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStyles.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No styles found
                      </div>
                    ) : (
                      filteredStyles.map((style) => (
                        <SelectItem key={style.id} value={style.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{style.styleCode}</span>
                            <span className="text-xs text-gray-600">
                              {style.styleName}
                              {style.buyerName && ` - ${style.buyerName}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Style Info */}
              {selectedStyle && (
                <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                  <div className="font-medium text-blue-900">{selectedStyle.styleCode}</div>
                  <div className="text-sm text-blue-700">{selectedStyle.styleName}</div>
                  {selectedStyle.buyerName && (
                    <div className="text-xs text-blue-600 mt-1">
                      Buyer: {selectedStyle.buyerName}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => navigate(`/styles/${selectedStyle.id}`)}
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    Edit Full Style
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CAD Average Management Panel */}
        <div className="lg:col-span-2">
          {!selectedStyle ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select a style to manage CAD averages</p>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p>Loading style details...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {selectedStyle.components.map((component, compIndex) => (
                <Card key={component.id || compIndex}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {component.componentName} - {component.componentType}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {component.fabrics.length === 0 ? (
                      <p className="text-gray-500 text-sm">
                        No fabrics in this component
                      </p>
                    ) : (
                      component.fabrics.map((fabric, fabIndex) => (
                        <div
                          key={fabric.id || fabIndex}
                          className="p-4 border rounded-lg space-y-4"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">
                                {fabric.fabricName}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {fabric.fabricType}
                                {fabric.fabricColor && ` - ${fabric.fabricColor}`}
                                {fabric.fabricGSM && ` - ${fabric.fabricGSM} GSM`}
                              </p>
                            </div>
                          </div>

                          <CadAverageInput
                            value={fabric.cadAverages || []}
                            onChange={(cadAverages) =>
                              handleUpdateCadAverages(compIndex, fabIndex, cadAverages)
                            }
                            fabricName={fabric.fabricName}
                          />
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}

              {selectedStyle.components.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    <p>No components found in this style</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate(`/styles/${selectedStyle.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Style to Add Components
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
