"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = void 0;
const export_service_1 = __importDefault(require("../services/export.service"));
const template_service_1 = __importDefault(require("../services/template.service"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
/**
 * Export data from a module
 * POST /api/export/:module
 * Body: { format: 'csv' | 'excel' | 'pdf', templateId?: string, filters?: object }
 */
const exportData = async (req, res) => {
    try {
        const { module } = req.params;
        const { format = 'csv', templateId, filters = {} } = req.body;
        // Get template (either provided or default)
        let template;
        let columnConfig;
        if (templateId) {
            template = await template_service_1.default.getTemplateById(templateId);
            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }
            columnConfig = template.columnConfig;
        }
        else {
            template = await template_service_1.default.getDefaultTemplate(module);
            if (template) {
                columnConfig = template.columnConfig;
            }
            else {
                // Use default columns from template service if no template exists
                const availableColumns = template_service_1.default.getAvailableColumns(module);
                if (availableColumns.length === 0) {
                    return res.status(400).json({
                        error: `No default columns configured for module '${module}'. Please create an export template.`
                    });
                }
                columnConfig = availableColumns.map(col => ({
                    fieldName: col.fieldName,
                    displayName: col.displayName
                }));
            }
        }
        // Fetch data from database based on module
        const data = await fetchModuleData(module, filters);
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No data found to export' });
        }
        const exportOptions = {
            columns: columnConfig,
            data,
            filename: `${module}_export_${new Date().toISOString().split('T')[0]}`,
            title: template?.templateName || `${module} Export`
        };
        // Generate export based on format
        let result;
        let contentType;
        let fileExtension;
        switch (format.toLowerCase()) {
            case 'csv':
                result = await export_service_1.default.exportToCSV(exportOptions);
                contentType = 'text/csv';
                fileExtension = 'csv';
                break;
            case 'excel':
            case 'xlsx':
                result = await export_service_1.default.exportToExcel(exportOptions);
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                fileExtension = 'xlsx';
                break;
            case 'pdf':
                result = await export_service_1.default.exportToPDF(exportOptions);
                contentType = 'application/pdf';
                fileExtension = 'pdf';
                break;
            default:
                return res.status(400).json({ error: 'Invalid format. Use csv, excel, or pdf.' });
        }
        // Set response headers for download
        const filename = `${exportOptions.filename}.${fileExtension}`;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        // Send file
        if (typeof result === 'string') {
            res.send(result);
        }
        else {
            res.send(result);
        }
    }
    catch (error) {
        (0, logger_1.logError)('Export error:', error);
        res.status(500).json({
            error: 'Export failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.exportData = exportData;
/**
 * Fetch data from database based on module
 */
async function fetchModuleData(moduleName, filters = {}) {
    // Build where clause from filters
    const where = { isActive: true, ...filters };
    let result;
    switch (moduleName) {
        case 'customers':
            result = await database_1.default.customers.findMany({ where });
            break;
        case 'suppliers':
            result = await database_1.default.suppliers.findMany({ where });
            break;
        case 'materials':
            result = await database_1.default.materials.findMany({ where });
            break;
        case 'styles':
            result = await database_1.default.styles.findMany({ where });
            break;
        case 'orders':
            result = await database_1.default.orders.findMany({
                where,
                include: {
                    customers: true,
                    users_orders_createdByIdTousers: {
                        select: { firstName: true, lastName: true }
                    }
                }
            });
            break;
        case 'bom':
            result = await database_1.default.bill_of_materials.findMany({
                where,
                include: {
                    styles: true,
                    bom_items: {
                        include: {
                            materials: true
                        }
                    }
                }
            });
            break;
        case 'chart_of_accounts':
            result = await database_1.default.chart_of_accounts.findMany({ where });
            break;
        case 'tax_masters':
            result = await database_1.default.tax_masters.findMany({ where });
            break;
        case 'payment_terms':
            result = await database_1.default.payment_terms.findMany({ where });
            break;
        case 'currencies':
            result = await database_1.default.currencies.findMany({ where });
            break;
        case 'cost_centers':
            result = await database_1.default.cost_centers.findMany({ where });
            break;
        case 'expense_types':
            result = await database_1.default.expense_types.findMany({ where });
            break;
        case 'bank_accounts':
            result = await database_1.default.bank_accounts.findMany({ where });
            break;
        default:
            throw new Error(`Module '${moduleName}' not supported for export`);
    }
    return result;
}
