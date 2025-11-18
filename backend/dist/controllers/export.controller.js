"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = void 0;
const export_service_1 = __importDefault(require("../services/export.service"));
const template_service_1 = __importDefault(require("../services/template.service"));
const database_1 = __importDefault(require("../config/database"));
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
        if (templateId) {
            template = await template_service_1.default.getTemplateById(templateId);
            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }
        }
        else {
            template = await template_service_1.default.getDefaultTemplate(module);
            if (!template) {
                return res.status(400).json({
                    error: 'No default template found. Please specify a template ID or create a default template.'
                });
            }
        }
        const columnConfig = template.columnConfig;
        // Fetch data from database based on module
        const data = await fetchModuleData(module, filters);
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No data found to export' });
        }
        const exportOptions = {
            columns: columnConfig,
            data,
            filename: `${module}_export_${new Date().toISOString().split('T')[0]}`,
            title: template.templateName || `${module} Export`
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
        console.error('Export error:', error);
        res.status(500).json({
            error: 'Export failed',
            message: error.message
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
    switch (moduleName) {
        case 'customers':
            return await database_1.default.customers.findMany({ where });
        case 'suppliers':
            return await database_1.default.suppliers.findMany({ where });
        case 'materials':
            return await database_1.default.materials.findMany({ where });
        case 'styles':
            return await database_1.default.styles.findMany({ where });
        case 'orders':
            return await database_1.default.orders.findMany({
                where,
                include: {
                    customers: true,
                    users_orders_createdByIdTousers: {
                        select: { firstName: true, lastName: true }
                    }
                }
            });
        case 'bom':
            return await database_1.default.bill_of_materials.findMany({
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
        case 'chart_of_accounts':
            return await database_1.default.chart_of_accounts.findMany({ where });
        case 'tax_masters':
            return await database_1.default.tax_masters.findMany({ where });
        case 'payment_terms':
            return await database_1.default.payment_terms.findMany({ where });
        case 'currencies':
            return await database_1.default.currencies.findMany({ where });
        case 'cost_centers':
            return await database_1.default.cost_centers.findMany({ where });
        case 'expense_types':
            return await database_1.default.expense_types.findMany({ where });
        case 'bank_accounts':
            return await database_1.default.bank_accounts.findMany({ where });
        default:
            throw new Error(`Module '${moduleName}' not supported for export`);
    }
}
