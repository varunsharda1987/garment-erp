// Template Service - Manages export templates
import prisma from '../config/database';
import { ExportColumn } from './export.service';
import { NotFoundError } from '../errors';

export interface CreateTemplateDTO {
  moduleName: string;
  templateName: string;
  description?: string;
  columnConfig: ExportColumn[];
  isDefault?: boolean;
  createdById: string;
}

export interface UpdateTemplateDTO {
  templateName?: string;
  description?: string;
  columnConfig?: ExportColumn[];
  isDefault?: boolean;
}

class TemplateService {
  /**
   * Create a new export template
   */
  async createTemplate(data: CreateTemplateDTO) {
    const { moduleName, templateName, description, columnConfig, isDefault, createdById } = data;

    // If setting as default, unset other default templates for this module
    if (isDefault) {
      await prisma.export_templates.updateMany({
        where: {
          moduleName,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const template = await prisma.export_templates.create({
      data: {
        moduleName,
        templateName,
        description,
        columnConfig: columnConfig as any, // Prisma JSON type
        isDefault: isDefault || false,
        createdById,
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return template;
  }

  /**
   * Get all templates for a module
   */
  async getTemplatesByModule(moduleName: string) {
    const templates = await prisma.export_templates.findMany({
      where: {
        moduleName,
        isActive: true,
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return templates;
  }

  /**
   * Get default template for a module
   */
  async getDefaultTemplate(moduleName: string) {
    const template = await prisma.export_templates.findFirst({
      where: {
        moduleName,
        isDefault: true,
        isActive: true,
      },
    });

    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string) {
    const template = await prisma.export_templates.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, data: UpdateTemplateDTO) {
    const template = await prisma.export_templates.findUnique({ where: { id } });

    // BUG-ET7 fix: Use NotFoundError for proper 404 status instead of generic Error
    if (!template) {
      throw new NotFoundError('Template', id);
    }

    // If setting as default, unset other default templates for this module
    if (data.isDefault) {
      await prisma.export_templates.updateMany({
        where: {
          moduleName: template.moduleName,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updated = await prisma.export_templates.update({
      where: { id },
      data: {
        ...(data.templateName && { templateName: data.templateName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.columnConfig && { columnConfig: data.columnConfig as any }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete a template (soft delete)
   */
  async deleteTemplate(id: string) {
    const template = await prisma.export_templates.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return template;
  }

  /**
   * Get all available modules (hardcoded list based on our system)
   */
  getAvailableModules() {
    // BUG-ET4 fix: Only modules with fetchModuleData() handlers in export.controller.ts should be listed here.
    // 'users' was removed because it's not implemented in export controller (would throw "Module not supported").
    return [
      { value: 'customers', label: 'Customers' },
      { value: 'suppliers', label: 'Suppliers' },
      { value: 'materials', label: 'Materials' },
      { value: 'styles', label: 'Styles' },
      { value: 'style_import', label: 'Style Import (Bulk with SKUs)' },
      { value: 'orders', label: 'Orders' },
      { value: 'bom', label: 'Bill of Materials' },
      { value: 'cost_sheets', label: 'Cost Sheets' },
      { value: 'chart_of_accounts', label: 'Chart of Accounts' },
      { value: 'tax_masters', label: 'Tax Masters' },
      { value: 'payment_terms', label: 'Payment Terms' },
      { value: 'currencies', label: 'Currencies' },
      { value: 'cost_centers', label: 'Cost Centers' },
      { value: 'expense_types', label: 'Expense Types' },
      { value: 'bank_accounts', label: 'Bank Accounts' },
    ];
  }

  /**
   * Get available columns for a module (based on Prisma schema)
   * This is a simplified version - in production, you'd dynamically read from Prisma schema
   */
  getAvailableColumns(moduleName: string): { fieldName: string; displayName: string; type: string }[] {
    // These columns match the import template columns exactly (from import.controller.ts)
    // so that exported data can be re-imported
    const moduleColumns: Record<string, any[]> = {
      // Column display names match import.controller.ts exactly for re-import compatibility
      customers: [
        { fieldName: 'code', displayName: 'Customer Code (Auto-generated if empty)', type: 'text' },
        { fieldName: 'name', displayName: 'Customer Name', type: 'text' },
        { fieldName: 'type', displayName: 'Type (BUYER if empty)', type: 'text' },
        { fieldName: 'category', displayName: 'Category (DOMESTIC if empty)', type: 'text' },
        { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
        { fieldName: 'email', displayName: 'Email', type: 'text' },
        { fieldName: 'phone', displayName: 'Phone', type: 'text' },
        { fieldName: 'billingAddress', displayName: 'Billing Address', type: 'text' },
        { fieldName: 'shippingAddress', displayName: 'Shipping Address', type: 'text' },
        { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
        { fieldName: 'creditLimit', displayName: 'Credit Limit', type: 'number' },
        { fieldName: 'creditDays', displayName: 'Credit Days', type: 'number' },
      ],
      suppliers: [
        { fieldName: 'code', displayName: 'Supplier Code (Auto-generated if empty)', type: 'text' },
        { fieldName: 'name', displayName: 'Supplier Name', type: 'text' },
        { fieldName: 'supplierCategories', displayName: 'Categories (comma-separated)', type: 'text' },
        { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
        { fieldName: 'email', displayName: 'Email', type: 'text' },
        { fieldName: 'phone', displayName: 'Phone', type: 'text' },
        { fieldName: 'address', displayName: 'Address', type: 'text' },
        { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
        { fieldName: 'paymentTerms', displayName: 'Payment Terms', type: 'text' },
        { fieldName: 'rating', displayName: 'Rating', type: 'number' },
        { fieldName: 'bankName', displayName: 'Bank Name', type: 'text' },
        { fieldName: 'bankAccountNumber', displayName: 'Bank Account Number', type: 'text' },
        { fieldName: 'ifscCode', displayName: 'IFSC Code', type: 'text' },
      ],
      materials: [
        { fieldName: 'code', displayName: 'Material Code', type: 'text' },
        { fieldName: 'name', displayName: 'Material Name', type: 'text' },
        { fieldName: 'category', displayName: 'Category', type: 'text' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
        { fieldName: 'unit', displayName: 'Unit', type: 'text' },
        { fieldName: 'costPerUnit', displayName: 'Cost Per Unit', type: 'number' },
        { fieldName: 'reorderLevel', displayName: 'Reorder Level', type: 'number' },
      ],
      lace: [
        { fieldName: 'laceCode', displayName: 'Lace Code (Auto-generated if empty)', type: 'text' },
        { fieldName: 'laceName', displayName: 'Lace Name (Auto-generated from attributes if empty)', type: 'text' },
        { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
        { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
        { fieldName: 'width', displayName: 'Width (cm)', type: 'number' },
        { fieldName: 'design', displayName: 'Design', type: 'text' },
        { fieldName: 'color', displayName: 'Color', type: 'text' },
        { fieldName: 'composition', displayName: 'Composition', type: 'text' },
        { fieldName: 'pricePerMeter', displayName: 'Price Per Meter', type: 'number' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      buttons: [
        { fieldName: 'buttonCode', displayName: 'Button Code (Auto-generated if empty)', type: 'text' },
        { fieldName: 'buttonName', displayName: 'Button Name (Auto-generated from attributes if empty)', type: 'text' },
        { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
        { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
        { fieldName: 'size', displayName: 'Size', type: 'text' },
        { fieldName: 'holes', displayName: 'Holes', type: 'number' },
        { fieldName: 'color', displayName: 'Color', type: 'text' },
        { fieldName: 'material', displayName: 'Material', type: 'text' },
        { fieldName: 'shape', displayName: 'Shape', type: 'text' },
        { fieldName: 'pricePerPiece', displayName: 'Price Per Piece', type: 'number' },
        { fieldName: 'pricePerGross', displayName: 'Price Per Gross', type: 'number' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      threads: [
        { fieldName: 'threadCode', displayName: 'Thread Code (Auto-generated if empty)', type: 'text' },
        { fieldName: 'threadName', displayName: 'Thread Name (Auto-generated from attributes if empty)', type: 'text' },
        { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
        { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
        { fieldName: 'threadCount', displayName: 'Thread Count', type: 'text' },
        { fieldName: 'color', displayName: 'Color', type: 'text' },
        { fieldName: 'colorCode', displayName: 'Color Code', type: 'text' },
        { fieldName: 'composition', displayName: 'Composition', type: 'text' },
        { fieldName: 'threadType', displayName: 'Thread Type', type: 'text' },
        { fieldName: 'coneSize', displayName: 'Cone Size', type: 'text' },
        { fieldName: 'pricePerCone', displayName: 'Price Per Cone', type: 'number' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      zippers: [
        { fieldName: 'zipperCode', displayName: 'Zipper Code (Auto-generated if empty)', type: 'text' },
        { fieldName: 'zipperName', displayName: 'Zipper Name (Auto-generated from attributes if empty)', type: 'text' },
        { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
        { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
        { fieldName: 'length', displayName: 'Length (inches)', type: 'number' },
        { fieldName: 'teethType', displayName: 'Teeth Type (Metal/Plastic/Nylon/Invisible)', type: 'text' },
        { fieldName: 'color', displayName: 'Color', type: 'text' },
        { fieldName: 'brand', displayName: 'Brand', type: 'text' },
        { fieldName: 'sliderType', displayName: 'Slider Type', type: 'text' },
        { fieldName: 'tapeWidth', displayName: 'Tape Width (mm)', type: 'number' },
        { fieldName: 'pricePerPiece', displayName: 'Price Per Piece', type: 'number' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      elastic: [
        { fieldName: 'elasticCode', displayName: 'Elastic Code (Auto-generated if empty)', type: 'text' },
        {
          fieldName: 'elasticName',
          displayName: 'Elastic Name (Auto-generated from attributes if empty)',
          type: 'text',
        },
        { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
        { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
        { fieldName: 'width', displayName: 'Width (mm)', type: 'number' },
        { fieldName: 'stretchPercent', displayName: 'Stretch Percentage', type: 'number' },
        { fieldName: 'color', displayName: 'Color', type: 'text' },
        { fieldName: 'composition', displayName: 'Composition', type: 'text' },
        { fieldName: 'elasticType', displayName: 'Elastic Type (Woven/Knitted/Braided)', type: 'text' },
        { fieldName: 'pricePerMeter', displayName: 'Price Per Meter', type: 'number' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      labels: [
        { fieldName: 'labelCode', displayName: 'Label Code (Auto-generated if empty)', type: 'text' },
        { fieldName: 'labelName', displayName: 'Label Name (Auto-generated from attributes if empty)', type: 'text' },
        { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
        { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
        { fieldName: 'labelType', displayName: 'Label Type (Woven/Printed/Care/Size/Hangtag)', type: 'text' },
        { fieldName: 'size', displayName: 'Size/Dimensions', type: 'text' },
        { fieldName: 'content', displayName: 'Content/Text', type: 'text' },
        { fieldName: 'printMethod', displayName: 'Print Method (Screen/Digital/Woven/Embossed)', type: 'text' },
        { fieldName: 'material', displayName: 'Material (Satin/Taffeta/Paper)', type: 'text' },
        { fieldName: 'color', displayName: 'Color', type: 'text' },
        { fieldName: 'pricePerPiece', displayName: 'Price Per Piece', type: 'number' },
        { fieldName: 'pricePerHundred', displayName: 'Price Per Hundred', type: 'number' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      chart_of_accounts: [
        { fieldName: 'accountCode', displayName: 'Account Code', type: 'text' },
        { fieldName: 'accountName', displayName: 'Account Name', type: 'text' },
        { fieldName: 'accountType', displayName: 'Account Type', type: 'text' },
        { fieldName: 'accountGroup', displayName: 'Account Group', type: 'text' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
        { fieldName: 'isSystemAccount', displayName: 'System Account', type: 'text' },
        { fieldName: 'isActive', displayName: 'Status', type: 'text' },
      ],
      tax_masters: [
        { fieldName: 'taxCode', displayName: 'Tax Code', type: 'text' },
        { fieldName: 'taxName', displayName: 'Tax Name', type: 'text' },
        { fieldName: 'taxRate', displayName: 'Tax Rate', type: 'number' },
        { fieldName: 'taxType', displayName: 'Tax Type', type: 'text' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      payment_terms: [
        { fieldName: 'code', displayName: 'Code', type: 'text' },
        { fieldName: 'name', displayName: 'Name', type: 'text' },
        { fieldName: 'days', displayName: 'Days', type: 'number' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      currencies: [
        { fieldName: 'code', displayName: 'Currency Code', type: 'text' },
        { fieldName: 'name', displayName: 'Currency Name', type: 'text' },
        { fieldName: 'symbol', displayName: 'Symbol', type: 'text' },
        { fieldName: 'exchangeRate', displayName: 'Exchange Rate', type: 'number' },
      ],
      cost_centers: [
        { fieldName: 'code', displayName: 'Code', type: 'text' },
        { fieldName: 'name', displayName: 'Name', type: 'text' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      expense_types: [
        { fieldName: 'code', displayName: 'Code', type: 'text' },
        { fieldName: 'name', displayName: 'Name', type: 'text' },
        { fieldName: 'category', displayName: 'Category', type: 'text' },
        { fieldName: 'description', displayName: 'Description', type: 'text' },
      ],
      bank_accounts: [
        { fieldName: 'accountName', displayName: 'Account Name', type: 'text' },
        { fieldName: 'accountNumber', displayName: 'Account Number', type: 'text' },
        { fieldName: 'bankName', displayName: 'Bank Name', type: 'text' },
        { fieldName: 'branchName', displayName: 'Branch Name', type: 'text' },
        { fieldName: 'ifscCode', displayName: 'IFSC Code', type: 'text' },
        { fieldName: 'accountType', displayName: 'Account Type', type: 'text' },
        { fieldName: 'openingBalance', displayName: 'Opening Balance', type: 'number' },
      ],
      styles: [
        // Required fields
        { fieldName: 'styleCode', displayName: 'Style Code (Required)', type: 'text' },
        { fieldName: 'customerName', displayName: 'Customer Name (Required - must exist in master)', type: 'text' },
        { fieldName: 'brandName', displayName: 'Brand Name (Required)', type: 'text' },
        { fieldName: 'size', displayName: 'Size (Required - one row per size)', type: 'text' },
        // Optional fields
        { fieldName: 'styleName', displayName: 'Style Name (Optional - defaults to Style Code)', type: 'text' },
        { fieldName: 'buyerStyleRef', displayName: 'Buyer Style Code (Optional)', type: 'text' },
        { fieldName: 'season', displayName: 'Season (Optional)', type: 'text' },
        { fieldName: 'gender', displayName: 'Gender (Optional - MEN/WOMEN/KIDS/UNISEX)', type: 'text' },
        { fieldName: 'buyerCategory', displayName: 'Buyer Category (Optional)', type: 'text' },
        { fieldName: 'buyerSubCategory', displayName: 'Buyer Sub-Category (Optional)', type: 'text' },
        { fieldName: 'buyerSubSubCategory', displayName: 'Buyer Sub-Sub-Category (Optional)', type: 'text' },
        { fieldName: 'internalCategory', displayName: 'Internal Category (Optional)', type: 'text' },
      ],
      // Add a new module for style import specifically
      style_import: [
        // Required fields
        { fieldName: 'styleCode', displayName: 'Style Code (Required)', type: 'text' },
        { fieldName: 'customerName', displayName: 'Customer Name (Required - must exist in master)', type: 'text' },
        { fieldName: 'brandName', displayName: 'Brand Name (Required)', type: 'text' },
        { fieldName: 'size', displayName: 'Size (Required - one row per size)', type: 'text' },
        // Optional fields
        { fieldName: 'styleName', displayName: 'Style Name (Optional - defaults to Style Code)', type: 'text' },
        { fieldName: 'buyerStyleRef', displayName: 'Buyer Style Code (Optional)', type: 'text' },
        { fieldName: 'season', displayName: 'Season (Optional)', type: 'text' },
        { fieldName: 'gender', displayName: 'Gender (Optional - MEN/WOMEN/KIDS/UNISEX)', type: 'text' },
        { fieldName: 'buyerCategory', displayName: 'Buyer Category (Optional)', type: 'text' },
        { fieldName: 'buyerSubCategory', displayName: 'Buyer Sub-Category (Optional)', type: 'text' },
        { fieldName: 'buyerSubSubCategory', displayName: 'Buyer Sub-Sub-Category (Optional)', type: 'text' },
        { fieldName: 'internalCategory', displayName: 'Internal Category (Optional)', type: 'text' },
      ],
      orders: [
        { fieldName: 'orderNumber', displayName: 'Order Number', type: 'text' },
        { fieldName: 'orderDate', displayName: 'Order Date', type: 'date' },
        { fieldName: 'customerName', displayName: 'Customer Name', type: 'text' },
        { fieldName: 'status', displayName: 'Status', type: 'text' },
        { fieldName: 'totalAmount', displayName: 'Total Amount', type: 'number' },
        { fieldName: 'deliveryDate', displayName: 'Delivery Date', type: 'date' },
      ],
      bom: [
        { fieldName: 'bomCode', displayName: 'BOM Code', type: 'text' },
        { fieldName: 'styleName', displayName: 'Style Name', type: 'text' },
        { fieldName: 'version', displayName: 'Version', type: 'text' },
        { fieldName: 'status', displayName: 'Status', type: 'text' },
        { fieldName: 'totalCost', displayName: 'Total Cost', type: 'number' },
      ],
      // Cost sheets export (style_costing table). Nested style fields resolve via getNestedValue.
      style_costing: [
        { fieldName: 'styles.styleCode', displayName: 'Style Code', type: 'text' },
        { fieldName: 'styles.buyerStyleRef', displayName: 'Buyer Style Code', type: 'text' },
        { fieldName: 'styles.styleName', displayName: 'Style Name', type: 'text' },
        { fieldName: 'version', displayName: 'Version', type: 'number' },
        { fieldName: 'approvalStatus', displayName: 'Approval Status', type: 'text' },
        { fieldName: 'totalMaterialCost', displayName: 'Total Material Cost', type: 'number' },
        { fieldName: 'totalProductionCost', displayName: 'Total Production Cost', type: 'number' },
        { fieldName: 'totalProductCost', displayName: 'Total Product Cost', type: 'number' },
        { fieldName: 'totalCostPerPiece', displayName: 'Cost Per Piece', type: 'number' },
        { fieldName: 'sellingPricePerPiece', displayName: 'Selling Price Per Piece', type: 'number' },
        { fieldName: 'closedCost', displayName: 'Closed Cost', type: 'number' },
        { fieldName: 'createdAt', displayName: 'Created At', type: 'date' },
      ],
    };
    // cost_sheets is an alias of style_costing (see getAvailableModules)
    moduleColumns.cost_sheets = moduleColumns.style_costing;

    return moduleColumns[moduleName] || [];
  }
}

export default new TemplateService();
