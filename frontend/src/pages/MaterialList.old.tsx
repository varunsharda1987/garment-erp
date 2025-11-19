import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { getAllMaterials, deleteMaterial, getAllCategories } from '../services/material.service';
import { UnitLabels } from '../types/material.types';
import type { Material, MaterialCategory } from '../types/material.types';
import ExportButton from '../components/ExportButton';
import ImportButton from '../components/ImportButton';

export default function MaterialList() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const limit = 10;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [unitFilter, setUnitFilter] = useState<string>('');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [currentPage, searchQuery, categoryFilter, unitFilter]);

  const fetchCategories = async () => {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchMaterials = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllMaterials({
        page: currentPage,
        limit,
        search: searchQuery || undefined,
        categoryId: categoryFilter || undefined,
        unit: unitFilter || undefined,
      });
      setMaterials(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalMaterials(response.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch materials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCategoryFilter = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const handleUnitFilter = (value: string) => {
    setUnitFilter(value);
    setCurrentPage(1);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete material "${name}"?`)) {
      try {
        await deleteMaterial(id);
        fetchMaterials();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to delete material');
      }
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isLoading && materials.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading materials...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Raw Materials</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="materials"
                filters={{
                  categoryId: categoryFilter || undefined,
                  unit: unitFilter || undefined,
                }}
              />
              <ImportButton
                module="materials"
                onSuccess={fetchMaterials}
              />
              <Button onClick={() => navigate('/materials/new')}>
                + Add New Material
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by code, name, or description..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="w-64">
              <select
                className="w-full h-10 px-3 border border-gray-300 rounded-md"
                value={categoryFilter}
                onChange={(e) => handleCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parent
                      ? `${category.parent.name} > ${category.name}`
                      : category.name
                    }
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <select
                className="w-full h-10 px-3 border border-gray-300 rounded-md"
                value={unitFilter}
                onChange={(e) => handleUnitFilter(e.target.value)}
              >
                <option value="">All Units</option>
                {Object.entries(UnitLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Materials Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">
                    Material Code
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">
                    Material Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">
                    Cost Price
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No materials found
                    </td>
                  </tr>
                ) : (
                  materials.map((material) => (
                    <tr
                      key={material.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{material.code}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{material.name}</div>
                        {material.description && (
                          <div className="text-sm text-gray-500">{material.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-700">
                          {material.category ? (
                            material.category.parent ? (
                              `${material.category.parent.name} > ${material.category.name}`
                            ) : (
                              material.category.name
                            )
                          ) : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-700">
                          {UnitLabels[material.unit]}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-700">
                          ₹{Number(material.costPrice).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-700">
                          {material.supplier?.name || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/materials/${material.id}/edit`)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(material.id, material.name)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {materials.length} of {totalMaterials} materials
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
