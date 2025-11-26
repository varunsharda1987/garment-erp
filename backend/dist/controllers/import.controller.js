"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadTemplate = exports.executeImport = exports.previewImport = void 0;
const import_service_1 = __importDefault(require("../services/import.service"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
/**
 * Preview import data (first 100 rows with validation)
 * POST /api/import/:module/preview
 * Requires file upload (multipart/form-data)
 */
const previewImport = async (req, res) => {
    try {
        const { module } = req.params;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Get column configuration for this module
        const columns = getModuleColumns(module);
        const result = await import_service_1.default.previewImport({
            columns,
            file: file
        });
        res.json({
            success: true,
            preview: result
        });
    }
    catch (error) {
        (0, logger_1.logError)('Import preview error:', error);
        res.status(500).json({
            error: 'Import preview failed',
            message: error.message
        });
    }
};
exports.previewImport = previewImport;
/**
 * Execute import (bulk insert with transaction)
 * POST /api/import/:module/execute
 * Requires file upload (multipart/form-data)
 */
const executeImport = async (req, res) => {
    try {
        const { module } = req.params;
        const file = req.file;
        const userId = req.user?.userId; // From auth middleware
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Get column configuration for this module
        const columns = getModuleColumns(module);
        // Parse and validate file
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        let result;
        if (fileExtension === 'csv') {
            result = await import_service_1.default.importFromCSV({ columns, file: file });
        }
        else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            result = await import_service_1.default.importFromExcel({ columns, file: file });
        }
        else {
            return res.status(400).json({ error: 'Unsupported file format. Use CSV or Excel files.' });
        }
        // If there are errors, return them without importing
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors found. Please fix and try again.',
                errors: result.errors,
                summary: {
                    totalRows: result.totalRows,
                    validRows: result.validRows,
                    invalidRows: result.invalidRows
                }
            });
        }
        // Execute import using transaction
        const importResult = await executeModuleImport(module, result.data, userId);
        res.json({
            success: true,
            message: `Successfully imported ${importResult.count} records`,
            summary: {
                totalRows: result.totalRows,
                validRows: result.validRows,
                invalidRows: result.invalidRows,
                importedRows: importResult.count
            }
        });
    }
    catch (error) {
        (0, logger_1.logError)('Import execution error:', error);
        res.status(500).json({
            error: 'Import execution failed',
            message: error.message
        });
    }
};
exports.executeImport = executeImport;
/**
 * Download import template
 * GET /api/import/:module/template?format=csv|excel
 */
const downloadTemplate = async (req, res) => {
    try {
        const { module } = req.params;
        const { format = 'excel' } = req.query;
        // Get column configuration for this module
        const columns = getModuleColumns(module);
        let result;
        let contentType;
        let fileExtension;
        if (format === 'csv') {
            result = import_service_1.default.generateTemplate(columns);
            contentType = 'text/csv';
            fileExtension = 'csv';
        }
        else {
            result = await import_service_1.default.generateExcelTemplate(columns, module);
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileExtension = 'xlsx';
        }
        const filename = `${module}_import_template.${fileExtension}`;
        // Set proper headers for file download
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(result));
        res.setHeader('Cache-Control', 'no-cache');
        res.send(result);
    }
    catch (error) {
        (0, logger_1.logError)('Template download error:', error);
        res.status(500).json({
            error: 'Template download failed',
            message: error.message
        });
    }
};
exports.downloadTemplate = downloadTemplate;
/**
 * Get column configuration for a module
 */
function getModuleColumns(moduleName) {
    const moduleColumns = {
        customers: [
            { fieldName: 'code', displayName: 'Customer Code (Auto-generated if empty)', required: false, type: 'text' },
            { fieldName: 'name', displayName: 'Customer Name', required: true, type: 'text' },
            { fieldName: 'type', displayName: 'Type (BUYER if empty)', required: false, type: 'text' },
            { fieldName: 'category', displayName: 'Category (DOMESTIC if empty)', required: false, type: 'text' },
            { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
            { fieldName: 'email', displayName: 'Email', type: 'email' },
            { fieldName: 'phone', displayName: 'Phone', type: 'text' },
            { fieldName: 'billingAddress', displayName: 'Billing Address', type: 'text' },
            { fieldName: 'shippingAddress', displayName: 'Shipping Address', type: 'text' },
            { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
            { fieldName: 'creditLimit', displayName: 'Credit Limit', type: 'number' },
            { fieldName: 'creditDays', displayName: 'Credit Days', type: 'number' }
        ],
        suppliers: [
            { fieldName: 'code', displayName: 'Supplier Code (Auto-generated if empty)', required: false, type: 'text' },
            { fieldName: 'name', displayName: 'Supplier Name', required: true, type: 'text' },
            { fieldName: 'supplierCategory', displayName: 'Category', required: true, type: 'text' },
            { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
            { fieldName: 'email', displayName: 'Email', type: 'email' },
            { fieldName: 'phone', displayName: 'Phone', type: 'text' },
            { fieldName: 'address', displayName: 'Address', type: 'text' },
            { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
            { fieldName: 'paymentTerms', displayName: 'Payment Terms', type: 'text' },
            { fieldName: 'rating', displayName: 'Rating', type: 'number' }
        ],
        materials: [
            { fieldName: 'code', displayName: 'Material Code', required: true, type: 'text' },
            { fieldName: 'name', displayName: 'Material Name', required: true, type: 'text' },
            { fieldName: 'category', displayName: 'Category', required: true, type: 'text' },
            { fieldName: 'description', displayName: 'Description', type: 'text' },
            { fieldName: 'unit', displayName: 'Unit', required: true, type: 'text' },
            { fieldName: 'costPerUnit', displayName: 'Cost Per Unit', type: 'number' },
            { fieldName: 'reorderLevel', displayName: 'Reorder Level', type: 'number' }
        ],
        lace: [
            { fieldName: 'laceCode', displayName: 'Lace Code (Auto-generated if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'laceName', displayName: 'Lace Name (Auto-generated from attributes if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
            { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
            { fieldName: 'width', displayName: 'Width (cm)', type: 'number' },
            { fieldName: 'design', displayName: 'Design', type: 'text' },
            { fieldName: 'color', displayName: 'Color', type: 'text' },
            { fieldName: 'composition', displayName: 'Composition', type: 'text' },
            { fieldName: 'pricePerMeter', displayName: 'Price Per Meter', type: 'number' },
            { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
            { fieldName: 'description', displayName: 'Description', type: 'text' }
        ],
        buttons: [
            { fieldName: 'buttonCode', displayName: 'Button Code (Auto-generated if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'buttonName', displayName: 'Button Name (Auto-generated from attributes if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
            { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
            { fieldName: 'size', displayName: 'Size', type: 'text' },
            { fieldName: 'holes', displayName: 'Holes', type: 'number' },
            { fieldName: 'color', displayName: 'Color', type: 'text' },
            { fieldName: 'material', displayName: 'Material', type: 'text' },
            { fieldName: 'shape', displayName: 'Shape', type: 'text' },
            { fieldName: 'pricePerPiece', displayName: 'Price Per Piece', type: 'number' },
            { fieldName: 'pricePerGross', displayName: 'Price Per Gross', type: 'number' },
            { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
            { fieldName: 'description', displayName: 'Description', type: 'text' }
        ],
        threads: [
            { fieldName: 'threadCode', displayName: 'Thread Code (Auto-generated if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'threadName', displayName: 'Thread Name (Auto-generated from attributes if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
            { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
            { fieldName: 'threadCount', displayName: 'Thread Count', type: 'text' },
            { fieldName: 'color', displayName: 'Color', type: 'text' },
            { fieldName: 'colorCode', displayName: 'Color Code', type: 'text' },
            { fieldName: 'composition', displayName: 'Composition', type: 'text' },
            { fieldName: 'threadType', displayName: 'Thread Type', type: 'text' },
            { fieldName: 'coneSize', displayName: 'Cone Size', type: 'text' },
            { fieldName: 'pricePerCone', displayName: 'Price Per Cone', type: 'number' },
            { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
            { fieldName: 'description', displayName: 'Description', type: 'text' }
        ],
        zippers: [
            { fieldName: 'zipperCode', displayName: 'Zipper Code (Auto-generated if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'zipperName', displayName: 'Zipper Name (Auto-generated from attributes if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
            { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
            { fieldName: 'length', displayName: 'Length (inches)', type: 'number' },
            { fieldName: 'teethType', displayName: 'Teeth Type (Metal/Plastic/Nylon/Invisible)', type: 'text' },
            { fieldName: 'color', displayName: 'Color', type: 'text' },
            { fieldName: 'brand', displayName: 'Brand', type: 'text' },
            { fieldName: 'sliderType', displayName: 'Slider Type', type: 'text' },
            { fieldName: 'tapeWidth', displayName: 'Tape Width (mm)', type: 'number' },
            { fieldName: 'pricePerPiece', displayName: 'Price Per Piece', type: 'number' },
            { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
            { fieldName: 'description', displayName: 'Description', type: 'text' }
        ],
        elastic: [
            { fieldName: 'elasticCode', displayName: 'Elastic Code (Auto-generated if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'elasticName', displayName: 'Elastic Name (Auto-generated from attributes if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
            { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
            { fieldName: 'width', displayName: 'Width (mm)', type: 'number' },
            { fieldName: 'stretchPercent', displayName: 'Stretch Percentage', type: 'number' },
            { fieldName: 'color', displayName: 'Color', type: 'text' },
            { fieldName: 'composition', displayName: 'Composition', type: 'text' },
            { fieldName: 'elasticType', displayName: 'Elastic Type (Woven/Knitted/Braided)', type: 'text' },
            { fieldName: 'pricePerMeter', displayName: 'Price Per Meter', type: 'number' },
            { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
            { fieldName: 'description', displayName: 'Description', type: 'text' }
        ],
        labels: [
            { fieldName: 'labelCode', displayName: 'Label Code (Auto-generated if empty)', required: false, type: 'text', autoGenerated: true },
            { fieldName: 'labelName', displayName: 'Label Name (Auto-generated from attributes if empty)', required: false, type: 'text', autoGenerated: true },
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
            { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
            { fieldName: 'description', displayName: 'Description', type: 'text' }
        ]
        // NOTE: Greige, Fabric, and Style have dedicated bulk import endpoints:
        // - Greige: Use /fabric-greige/bulk-import pages (GreigeBulkImport.tsx)
        // - Fabric: Use /fabric-greige/bulk-import pages (FabricBulkImport.tsx)
        // - Style: Use /api/styles/import (StyleBulkImport.tsx) - comprehensive template with fabrics
    };
    const columns = moduleColumns[moduleName];
    if (!columns) {
        throw new Error(`Module '${moduleName}' not supported for import`);
    }
    return columns;
}
/**
 * Helper: Generate auto-incremented code
 */
async function generateNextCode(tx, table, codeField, prefix) {
    const latest = await tx[table].findFirst({
        where: {
            [codeField]: {
                startsWith: prefix
            }
        },
        orderBy: { [codeField]: 'desc' },
        select: { [codeField]: true }
    });
    let nextNumber = 1;
    if (latest && latest[codeField]) {
        const match = latest[codeField].match(new RegExp(`${prefix}(\\d+)`));
        if (match) {
            nextNumber = parseInt(match[1]) + 1;
        }
    }
    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
}
/**
 * Execute import for a specific module
 */
async function executeModuleImport(moduleName, data, userId) {
    // Use transaction to ensure all-or-nothing import
    return await database_1.default.$transaction(async (tx) => {
        let count = 0;
        switch (moduleName) {
            case 'customers':
                for (const row of data) {
                    // Auto-generate code if not provided
                    let code = row.code;
                    if (!code || code.trim() === '') {
                        // Get latest customer to generate next code
                        const latestCustomer = await tx.customers.findFirst({
                            where: {
                                code: {
                                    startsWith: 'CUST-'
                                }
                            },
                            orderBy: { code: 'desc' },
                            select: { code: true }
                        });
                        let nextNumber = 1;
                        if (latestCustomer && latestCustomer.code) {
                            const match = latestCustomer.code.match(/CUST-(\d+)/);
                            if (match) {
                                nextNumber = parseInt(match[1]) + 1;
                            }
                        }
                        code = `CUST-${nextNumber.toString().padStart(4, '0')}`;
                    }
                    // Set defaults for type and category if not provided
                    const type = row.type && row.type.trim() !== '' ? row.type : 'BUYER';
                    const category = row.category && row.category.trim() !== '' ? row.category : 'DOMESTIC';
                    // Remove id from row to let Prisma auto-generate it
                    const { id, ...rowData } = row;
                    await tx.customers.create({
                        data: {
                            ...rowData,
                            code,
                            type,
                            category,
                            businessType: row.businessType || 'B2B',
                            market: row.market || 'DOMESTIC',
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            case 'suppliers':
                for (const row of data) {
                    // Auto-generate code if not provided
                    let code = row.code;
                    if (!code || code.trim() === '') {
                        // Get latest supplier to generate next code
                        const latestSupplier = await tx.suppliers.findFirst({
                            orderBy: { createdAt: 'desc' },
                            select: { code: true }
                        });
                        let nextNumber = 1;
                        if (latestSupplier && latestSupplier.code) {
                            const match = latestSupplier.code.match(/SUP(\d+)/);
                            if (match) {
                                nextNumber = parseInt(match[1]) + 1;
                            }
                        }
                        code = `SUP${nextNumber.toString().padStart(6, '0')}`;
                    }
                    // Remove id from row to let Prisma auto-generate it
                    const { id, ...rowData } = row;
                    await tx.suppliers.create({
                        data: {
                            ...rowData,
                            code,
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            case 'materials':
                for (const row of data) {
                    // Remove id from row to let Prisma auto-generate it
                    const { id, ...rowData } = row;
                    await tx.materials.create({
                        data: {
                            ...rowData,
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            case 'lace':
                for (const row of data) {
                    const { id, ...rowData } = row;
                    // Auto-generate laceCode if not provided
                    let laceCode = rowData.laceCode;
                    if (!laceCode || laceCode.trim() === '') {
                        const latestLace = await tx.lace_master.findFirst({
                            where: {
                                laceCode: {
                                    startsWith: 'LACE-'
                                }
                            },
                            orderBy: { laceCode: 'desc' },
                            select: { laceCode: true }
                        });
                        let nextNumber = 1;
                        if (latestLace && latestLace.laceCode) {
                            const match = latestLace.laceCode.match(/LACE-(\d+)/);
                            if (match) {
                                nextNumber = parseInt(match[1]) + 1;
                            }
                        }
                        laceCode = `LACE-${nextNumber.toString().padStart(6, '0')}`;
                    }
                    // Auto-generate laceName from attributes if not provided
                    let laceName = rowData.laceName;
                    if (!laceName || laceName.trim() === '') {
                        const parts = [];
                        // Add buyer/style code first if present
                        if (rowData.buyerCode)
                            parts.push(`[${rowData.buyerCode}]`);
                        if (rowData.color)
                            parts.push(rowData.color);
                        if (rowData.design)
                            parts.push(rowData.design);
                        if (rowData.composition)
                            parts.push(rowData.composition);
                        parts.push('Lace');
                        if (rowData.width)
                            parts.push(`${rowData.width}cm`);
                        laceName = parts.join(' ').trim() || `Lace ${laceCode}`;
                    }
                    await tx.lace_master.create({
                        data: {
                            ...rowData,
                            laceCode,
                            laceName,
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            case 'buttons':
                for (const row of data) {
                    const { id, ...rowData } = row;
                    // Auto-generate buttonCode if not provided
                    let buttonCode = rowData.buttonCode;
                    if (!buttonCode || buttonCode.trim() === '') {
                        const latestButton = await tx.button_master.findFirst({
                            where: {
                                buttonCode: {
                                    startsWith: 'BTN-'
                                }
                            },
                            orderBy: { buttonCode: 'desc' },
                            select: { buttonCode: true }
                        });
                        let nextNumber = 1;
                        if (latestButton && latestButton.buttonCode) {
                            const match = latestButton.buttonCode.match(/BTN-(\d+)/);
                            if (match) {
                                nextNumber = parseInt(match[1]) + 1;
                            }
                        }
                        buttonCode = `BTN-${nextNumber.toString().padStart(6, '0')}`;
                    }
                    // Auto-generate buttonName from attributes if not provided
                    let buttonName = rowData.buttonName;
                    if (!buttonName || buttonName.trim() === '') {
                        const parts = [];
                        // Add buyer/style code first if present
                        if (rowData.buyerCode)
                            parts.push(`[${rowData.buyerCode}]`);
                        if (rowData.color)
                            parts.push(rowData.color);
                        if (rowData.material)
                            parts.push(rowData.material);
                        if (rowData.holes)
                            parts.push(`${rowData.holes}-Hole`);
                        parts.push('Button');
                        if (rowData.size)
                            parts.push(rowData.size);
                        buttonName = parts.join(' ').trim() || `Button ${buttonCode}`;
                    }
                    await tx.button_master.create({
                        data: {
                            ...rowData,
                            buttonCode,
                            buttonName,
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            case 'threads':
                for (const row of data) {
                    const { id, ...rowData } = row;
                    // Auto-generate threadCode if not provided
                    let threadCode = rowData.threadCode;
                    if (!threadCode || threadCode.trim() === '') {
                        const latestThread = await tx.thread_master.findFirst({
                            where: {
                                threadCode: {
                                    startsWith: 'THD-'
                                }
                            },
                            orderBy: { threadCode: 'desc' },
                            select: { threadCode: true }
                        });
                        let nextNumber = 1;
                        if (latestThread && latestThread.threadCode) {
                            const match = latestThread.threadCode.match(/THD-(\d+)/);
                            if (match) {
                                nextNumber = parseInt(match[1]) + 1;
                            }
                        }
                        threadCode = `THD-${nextNumber.toString().padStart(6, '0')}`;
                    }
                    // Auto-generate threadName from attributes if not provided
                    let threadName = rowData.threadName;
                    if (!threadName || threadName.trim() === '') {
                        const parts = [];
                        // Add buyer/style code first if present
                        if (rowData.buyerCode)
                            parts.push(`[${rowData.buyerCode}]`);
                        if (rowData.color)
                            parts.push(rowData.color);
                        if (rowData.threadType)
                            parts.push(rowData.threadType);
                        parts.push('Thread');
                        if (rowData.threadCount)
                            parts.push(rowData.threadCount);
                        if (rowData.composition)
                            parts.push(rowData.composition);
                        threadName = parts.join(' ').trim() || `Thread ${threadCode}`;
                    }
                    await tx.thread_master.create({
                        data: {
                            ...rowData,
                            threadCode,
                            threadName,
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            case 'zippers':
                for (const row of data) {
                    const { id, ...rowData } = row;
                    // Auto-generate zipperCode if not provided
                    let zipperCode = rowData.zipperCode;
                    if (!zipperCode || zipperCode.trim() === '') {
                        const latestZipper = await tx.zipper_master.findFirst({
                            where: {
                                zipperCode: {
                                    startsWith: 'ZIP-'
                                }
                            },
                            orderBy: { zipperCode: 'desc' },
                            select: { zipperCode: true }
                        });
                        let nextNumber = 1;
                        if (latestZipper && latestZipper.zipperCode) {
                            const match = latestZipper.zipperCode.match(/ZIP-(\d+)/);
                            if (match) {
                                nextNumber = parseInt(match[1]) + 1;
                            }
                        }
                        zipperCode = `ZIP-${nextNumber.toString().padStart(6, '0')}`;
                    }
                    // Auto-generate zipperName from attributes if not provided
                    let zipperName = rowData.zipperName;
                    if (!zipperName || zipperName.trim() === '') {
                        const parts = [];
                        // Add buyer/style code first if present
                        if (rowData.buyerCode)
                            parts.push(`[${rowData.buyerCode}]`);
                        if (rowData.color)
                            parts.push(rowData.color);
                        if (rowData.teethType)
                            parts.push(rowData.teethType);
                        parts.push('Zipper');
                        if (rowData.length)
                            parts.push(`${rowData.length}"`);
                        if (rowData.brand)
                            parts.push(rowData.brand);
                        zipperName = parts.join(' ').trim() || `Zipper ${zipperCode}`;
                    }
                    await tx.zipper_master.create({
                        data: {
                            ...rowData,
                            zipperCode,
                            zipperName,
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            case 'elastic':
                for (const row of data) {
                    const { id, ...rowData } = row;
                    // Auto-generate elasticCode if not provided
                    let elasticCode = rowData.elasticCode;
                    if (!elasticCode || elasticCode.trim() === '') {
                        const latestElastic = await tx.elastic_master.findFirst({
                            where: {
                                elasticCode: {
                                    startsWith: 'ELS-'
                                }
                            },
                            orderBy: { elasticCode: 'desc' },
                            select: { elasticCode: true }
                        });
                        let nextNumber = 1;
                        if (latestElastic && latestElastic.elasticCode) {
                            const match = latestElastic.elasticCode.match(/ELS-(\d+)/);
                            if (match) {
                                nextNumber = parseInt(match[1]) + 1;
                            }
                        }
                        elasticCode = `ELS-${nextNumber.toString().padStart(6, '0')}`;
                    }
                    // Auto-generate elasticName from attributes if not provided
                    let elasticName = rowData.elasticName;
                    if (!elasticName || elasticName.trim() === '') {
                        const parts = [];
                        // Add buyer/style code first if present
                        if (rowData.buyerCode)
                            parts.push(`[${rowData.buyerCode}]`);
                        if (rowData.color)
                            parts.push(rowData.color);
                        if (rowData.elasticType)
                            parts.push(rowData.elasticType);
                        parts.push('Elastic');
                        if (rowData.width)
                            parts.push(`${rowData.width}mm`);
                        if (rowData.composition)
                            parts.push(rowData.composition);
                        elasticName = parts.join(' ').trim() || `Elastic ${elasticCode}`;
                    }
                    await tx.elastic_master.create({
                        data: {
                            ...rowData,
                            elasticCode,
                            elasticName,
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            case 'labels':
                for (const row of data) {
                    const { id, ...rowData } = row;
                    // Auto-generate labelCode if not provided
                    let labelCode = rowData.labelCode;
                    if (!labelCode || labelCode.trim() === '') {
                        const latestLabel = await tx.label_master.findFirst({
                            where: {
                                labelCode: {
                                    startsWith: 'LBL-'
                                }
                            },
                            orderBy: { labelCode: 'desc' },
                            select: { labelCode: true }
                        });
                        let nextNumber = 1;
                        if (latestLabel && latestLabel.labelCode) {
                            const match = latestLabel.labelCode.match(/LBL-(\d+)/);
                            if (match) {
                                nextNumber = parseInt(match[1]) + 1;
                            }
                        }
                        labelCode = `LBL-${nextNumber.toString().padStart(6, '0')}`;
                    }
                    // Auto-generate labelName from attributes if not provided
                    let labelName = rowData.labelName;
                    if (!labelName || labelName.trim() === '') {
                        const parts = [];
                        // Add buyer/style code first if present
                        if (rowData.buyerCode)
                            parts.push(`[${rowData.buyerCode}]`);
                        if (rowData.labelType)
                            parts.push(rowData.labelType);
                        if (rowData.color)
                            parts.push(rowData.color);
                        parts.push('Label');
                        if (rowData.material)
                            parts.push(rowData.material);
                        if (rowData.size)
                            parts.push(rowData.size);
                        labelName = parts.join(' ').trim() || `Label ${labelCode}`;
                    }
                    await tx.label_master.create({
                        data: {
                            ...rowData,
                            labelCode,
                            labelName,
                            createdById: userId,
                            isActive: true
                        }
                    });
                    count++;
                }
                break;
            default:
                throw new Error(`Module '${moduleName}' not supported for import. Use dedicated endpoints for Greige/Fabric/Style imports.`);
        }
        return { count };
    });
}
