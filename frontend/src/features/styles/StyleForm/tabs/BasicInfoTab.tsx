/**
 * BasicInfoTab Component
 * Tab 1: Basic Information + Additional Details (expandable)
 */

import React from 'react';
import { useStyleForm } from '../StyleFormContext';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Badge } from '../../../../components/ui/badge';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { getUploadUrl } from '../../../../config/api.config';
import SeasonSelector from '../../../../components/SeasonSelector';
import type { SeasonSearchResult } from '../../../../types/season.types';

interface BasicInfoTabProps {
  onNext: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteImage: () => void;
  generateSKUs: () => void;
}

export function BasicInfoTab({ onNext, onImageUpload, onDeleteImage, generateSKUs }: BasicInfoTabProps) {
  const { state, dispatch, toggleAdditionalDetails, setBasicInfo } = useStyleForm();

  const {
    styleCode,
    styleName,
    selectedCustomerId,
    customers,
    availableBrands,
    availableCategories,
    brandName,
    brandCategoryId,
    seasonId,
    numberOfComponents,
    componentCategories,
    componentMasters,
    selectedComponents,
    showAdditionalDetails,
    imageUrl,
    uploadingImage,
    costPrice,
    sellingPrice,
    hsnCode,
    productTaxRule,
    accountingSKU,
    accountingUnit,
    skuVariants,
    description,
    bulletPoints,
    remarks,
    styleId,
  } = state;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Style Code *</Label>
            <Input
              value={styleCode}
              onChange={(e) => setBasicInfo({ styleCode: e.target.value })}
              placeholder="ST-001"
              required
            />
          </div>
          <div>
            <Label>Style Name</Label>
            <Input
              value={styleName}
              onChange={(e) => setBasicInfo({ styleName: e.target.value })}
              placeholder="Summer Dress"
            />
          </div>
          <div>
            <Label>Customer/Buyer *</Label>
            <Select
              value={selectedCustomerId}
              onValueChange={(value) => dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Brand</Label>
            <Select
              value={brandName}
              onValueChange={(value) => setBasicInfo({ brandName: value })}
              disabled={!availableBrands.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={availableBrands.length > 0 ? 'Select brand...' : 'No brands available'} />
              </SelectTrigger>
              <SelectContent>
                {availableBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!availableBrands.length && selectedCustomerId && (
              <p className="text-xs text-gray-500 mt-1">Select a customer with configured brands</p>
            )}
          </div>
          <div>
            <Label>Brand Category</Label>
            <Select
              value={brandCategoryId}
              onValueChange={(value) => {
                const selectedBrandCategory = availableCategories.find((bc) => bc.id === value);
                setBasicInfo({
                  brandCategoryId: value,
                  category: selectedBrandCategory?.category || '',
                });
              }}
              disabled={!availableCategories.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={availableCategories.length > 0 ? 'Select category...' : 'Select brand first'}
                />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((bc) => (
                  <SelectItem key={bc.id} value={bc.id}>
                    {bc.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!availableCategories.length && brandName && (
              <p className="text-xs text-gray-500 mt-1">No categories available for this brand</p>
            )}
          </div>
          <div>
            <SeasonSelector
              value={seasonId}
              onChange={(newSeasonId: string | null, selectedSeason?: SeasonSearchResult) => {
                setBasicInfo({
                  seasonId: newSeasonId,
                  season: selectedSeason ? selectedSeason.name : '',
                });
              }}
              label="Season"
              placeholder="Select a season"
            />
          </div>
          <div>
            <Label>Number of Components</Label>
            <Input
              type="number"
              min="1"
              value={numberOfComponents}
              onChange={(e) => setBasicInfo({ numberOfComponents: parseInt(e.target.value) || 1 })}
              placeholder="1"
            />
          </div>
        </div>

        {/* Component Names Section */}
        {numberOfComponents > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Label className="text-base font-semibold mb-3 block">Component Selection</Label>
            <p className="text-xs text-gray-600 mb-3">
              Select component category and specific component for each part of the garment. Manage components in{' '}
              <a href="/component-masters" className="text-blue-600 hover:underline">
                Component Masters
              </a>
              .
            </p>
            <div className="grid grid-cols-1 gap-4">
              {Array.from({ length: numberOfComponents }, (_, index) => {
                const currentComponent = selectedComponents[index] || { category: '', componentId: '' };
                const filteredComponents = currentComponent.category
                  ? componentMasters.filter((c) => c.componentCategory === currentComponent.category)
                  : componentMasters;

                return (
                  <div key={index} className="grid grid-cols-2 gap-3 p-3 bg-white rounded-md border">
                    <div>
                      <Label className="text-sm">Component {index + 1} - Category</Label>
                      <Select
                        value={currentComponent.category}
                        onValueChange={(value) => {
                          dispatch({
                            type: 'UPDATE_SELECTED_COMPONENT',
                            payload: { index, component: { category: value, componentId: '' } },
                          });
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {componentCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Component Name</Label>
                      <Select
                        value={currentComponent.componentId}
                        onValueChange={(value) => {
                          dispatch({
                            type: 'UPDATE_SELECTED_COMPONENT',
                            payload: {
                              index,
                              component: { category: currentComponent.category, componentId: value },
                            },
                          });
                        }}
                        disabled={!currentComponent.category}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue
                            placeholder={currentComponent.category ? 'Select component...' : 'Select category first'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredComponents.map((component) => (
                            <SelectItem key={component.id} value={component.id}>
                              {component.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expandable Additional Details */}
        <button
          type="button"
          onClick={toggleAdditionalDetails}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mt-4"
        >
          {showAdditionalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Additional Details (Optional)
        </button>

        {showAdditionalDetails && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-6">
            {/* Image Upload */}
            <div>
              <Label className="text-base font-semibold">Product Image</Label>
              <div className="mt-2 space-y-3">
                {imageUrl && (
                  <div className="relative inline-block">
                    <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                      <img
                        src={getUploadUrl(imageUrl)}
                        alt="Style preview"
                        className="max-w-md max-h-64 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+';
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={onDeleteImage}
                      disabled={uploadingImage}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                )}

                <Input
                  value={imageUrl}
                  onChange={(e) => setBasicInfo({ imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg or paste image URL"
                  disabled={uploadingImage}
                />

                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={onImageUpload}
                    disabled={uploadingImage || !styleId}
                    className="flex-1"
                  />
                  {uploadingImage && <span className="text-sm text-gray-500">Uploading...</span>}
                </div>

                {!styleId && (
                  <p className="text-xs text-amber-600">Note: Image upload is available after creating the style</p>
                )}
                <p className="text-xs text-gray-500">Supported formats: JPG, PNG (Max size: 5MB)</p>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Pricing</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cost (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setBasicInfo({ costPrice: parseFloat(e.target.value) || '' })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>MRP (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(e) => setBasicInfo({ sellingPrice: parseFloat(e.target.value) || '' })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Accounting Information */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Accounting Information</Label>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label>HSN Code (6-8 digits)</Label>
                  <Input
                    value={hsnCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 8) {
                        setBasicInfo({ hsnCode: value });
                      }
                    }}
                    placeholder="6-8 digit HSN/SAC code"
                    maxLength={8}
                  />
                  {hsnCode && (hsnCode.length < 6 || hsnCode.length > 8) && (
                    <p className="text-xs text-red-600 mt-1">HSN code must be 6-8 digits</p>
                  )}
                </div>
                <div>
                  <Label>Tax Rate (2 digits %)</Label>
                  <Input
                    value={productTaxRule}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 2) {
                        setBasicInfo({ productTaxRule: value });
                      }
                    }}
                    placeholder="e.g., 12 (for 12%)"
                    maxLength={2}
                  />
                  {productTaxRule && productTaxRule.length !== 2 && (
                    <p className="text-xs text-red-600 mt-1">Tax rate must be 2 digits</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Accounting Style Code</Label>
                  <Input
                    value={accountingSKU}
                    onChange={(e) => setBasicInfo({ accountingSKU: e.target.value })}
                    placeholder="Style code for accounting"
                  />
                </div>
                <div>
                  <Label>Accounting Unit</Label>
                  <Input
                    value={accountingUnit}
                    onChange={(e) => setBasicInfo({ accountingUnit: e.target.value })}
                    placeholder="e.g., PCS, DOZEN"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-gray-500">Accounting SKU will be mapped to each size variant below</p>
                </div>
              </div>
            </div>

            {/* Size Variants & SKUs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Size Variants & SKUs</Label>
                <Button type="button" variant="outline" size="sm" onClick={generateSKUs}>
                  Auto-Generate SKUs
                </Button>
              </div>

              <div className="space-y-3">
                {skuVariants.map((variant, index) => (
                  <div key={variant.size} className="grid grid-cols-12 gap-3 items-center p-3 border rounded bg-white">
                    <div className="col-span-1 flex items-center">
                      <Checkbox
                        checked={variant.isActive}
                        onCheckedChange={(checked) => {
                          dispatch({
                            type: 'UPDATE_SKU_VARIANT',
                            payload: { index, variant: { ...variant, isActive: !!checked } },
                          });
                        }}
                      />
                    </div>
                    <div className="col-span-1">
                      <Badge variant="outline">{variant.size}</Badge>
                    </div>
                    <div className="col-span-3">
                      <Input
                        placeholder="SKU Code"
                        value={variant.sku}
                        onChange={(e) => {
                          dispatch({
                            type: 'UPDATE_SKU_VARIANT',
                            payload: { index, variant: { ...variant, sku: e.target.value } },
                          });
                        }}
                        disabled={!variant.isActive}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        placeholder="Accounting SKU"
                        value={variant.accountingSKU || ''}
                        onChange={(e) => {
                          dispatch({
                            type: 'UPDATE_SKU_VARIANT',
                            payload: { index, variant: { ...variant, accountingSKU: e.target.value } },
                          });
                        }}
                        disabled={!variant.isActive}
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        placeholder="Barcode (Optional)"
                        value={variant.barcode || ''}
                        onChange={(e) => {
                          dispatch({
                            type: 'UPDATE_SKU_VARIANT',
                            payload: { index, variant: { ...variant, barcode: e.target.value } },
                          });
                        }}
                        disabled={!variant.isActive}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Uncheck sizes you don't need. SKUs are required for active sizes.
              </p>
            </div>

            {/* Marketing & Remarks */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Marketing & Remarks</Label>
              <div className="space-y-4">
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setBasicInfo({ description: e.target.value })}
                    placeholder="Style description..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bullet Points</Label>
                    <Textarea
                      value={bulletPoints}
                      onChange={(e) => setBasicInfo({ bulletPoints: e.target.value })}
                      placeholder="Marketing bullet points (one per line)..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Remarks</Label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setBasicInfo({ remarks: e.target.value })}
                      placeholder="Additional remarks or notes..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={onNext}>
          Next: Fabrics & Trims
        </Button>
      </div>
    </div>
  );
}
