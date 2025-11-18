"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Template Service - Manages export templates
const database_1 = __importDefault(require("../config/database"));
class TemplateService {
    /**
     * Create a new export template
     */
    async createTemplate(data) {
        const { moduleName, templateName, description, columnConfig, isDefault, createdById } = data;
        // If setting as default, unset other default templates for this module
        if (isDefault) {
            await database_1.default.export_templates.updateMany({
                where: {
                    moduleName,
                    isDefault: true
                },
                data: {
                    isDefault: false
                }
            });
        }
        const template = await database_1.default.export_templates.create({
            data: {
                moduleName,
                templateName,
                description,
                columnConfig: columnConfig, // Prisma JSON type
                isDefault: isDefault || false,
                createdById
            },
            include: {
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
        return template;
    }
    /**
     * Get all templates for a module
     */
    async getTemplatesByModule(moduleName) {
        const templates = await database_1.default.export_templates.findMany({
            where: {
                moduleName,
                isActive: true
            },
            include: {
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        return templates;
    }
    /**
     * Get default template for a module
     */
    async getDefaultTemplate(moduleName) {
        const template = await database_1.default.export_templates.findFirst({
            where: {
                moduleName,
                isDefault: true,
                isActive: true
            }
        });
        return template;
    }
    /**
     * Get template by ID
     */
    async getTemplateById(id) {
        const template = await database_1.default.export_templates.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
        return template;
    }
    /**
     * Update a template
     */
    async updateTemplate(id, data) {
        const template = await database_1.default.export_templates.findUnique({ where: { id } });
        if (!template) {
            throw new Error('Template not found');
        }
        // If setting as default, unset other default templates for this module
        if (data.isDefault) {
            await database_1.default.export_templates.updateMany({
                where: {
                    moduleName: template.moduleName,
                    isDefault: true,
                    id: { not: id }
                },
                data: {
                    isDefault: false
                }
            });
        }
        const updated = await database_1.default.export_templates.update({
            where: { id },
            data: {
                ...(data.templateName && { templateName: data.templateName }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.columnConfig && { columnConfig: data.columnConfig }),
                ...(data.isDefault !== undefined && { isDefault: data.isDefault })
            },
            include: {
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
        return updated;
    }
    /**
     * Delete a template (soft delete)
     */
    async deleteTemplate(id) {
        const template = await database_1.default.export_templates.update({
            where: { id },
            data: {
                isActive: false
            }
        });
        return template;
    }
    /**
     * Get all available modules (hardcoded list based on our system)
     */
    getAvailableModules() {
        return [
            { value: 'users', label: 'Users' },
            { value: 'customers', label: 'Customers' },
            { value: 'suppliers', label: 'Suppliers' },
            { value: 'materials', label: 'Materials' },
            { value: 'styles', label: 'Styles' },
            { value: 'orders', label: 'Orders' },
            { value: 'bom', label: 'Bill of Materials' },
            { value: 'cost_sheets', label: 'Cost Sheets' },
            { value: 'chart_of_accounts', label: 'Chart of Accounts' },
            { value: 'tax_masters', label: 'Tax Masters' },
            { value: 'payment_terms', label: 'Payment Terms' },
            { value: 'currencies', label: 'Currencies' },
            { value: 'cost_centers', label: 'Cost Centers' },
            { value: 'expense_types', label: 'Expense Types' },
            { value: 'bank_accounts', label: 'Bank Accounts' }
        ];
    }
    /**
     * Get available columns for a module (based on Prisma schema)
     * This is a simplified version - in production, you'd dynamically read from Prisma schema
     */
    getAvailableColumns(moduleName) {
        const moduleColumns = {
            customers: [
                { fieldName: 'code', displayName: 'Customer Code', type: 'text' },
                { fieldName: 'name', displayName: 'Customer Name', type: 'text' },
                { fieldName: 'type', displayName: 'Type', type: 'text' },
                { fieldName: 'category', displayName: 'Category', type: 'text' },
                { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
                { fieldName: 'email', displayName: 'Email', type: 'text' },
                { fieldName: 'phone', displayName: 'Phone', type: 'text' },
                { fieldName: 'billingAddress', displayName: 'Billing Address', type: 'text' },
                { fieldName: 'shippingAddress', displayName: 'Shipping Address', type: 'text' },
                { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
                { fieldName: 'creditLimit', displayName: 'Credit Limit', type: 'currency' },
                { fieldName: 'creditDays', displayName: 'Credit Days', type: 'number' },
                { fieldName: 'isActive', displayName: 'Status', type: 'text' },
                { fieldName: 'createdAt', displayName: 'Created Date', type: 'date' }
            ],
            suppliers: [
                { fieldName: 'code', displayName: 'Supplier Code', type: 'text' },
                { fieldName: 'name', displayName: 'Supplier Name', type: 'text' },
                { fieldName: 'supplierCategory', displayName: 'Category', type: 'text' },
                { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
                { fieldName: 'email', displayName: 'Email', type: 'text' },
                { fieldName: 'phone', displayName: 'Phone', type: 'text' },
                { fieldName: 'address', displayName: 'Address', type: 'text' },
                { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
                { fieldName: 'paymentTerms', displayName: 'Payment Terms', type: 'text' },
                { fieldName: 'rating', displayName: 'Rating', type: 'number' },
                { fieldName: 'isActive', displayName: 'Status', type: 'text' },
                { fieldName: 'createdAt', displayName: 'Created Date', type: 'date' }
            ],
            materials: [
                { fieldName: 'code', displayName: 'Material Code', type: 'text' },
                { fieldName: 'name', displayName: 'Material Name', type: 'text' },
                { fieldName: 'category', displayName: 'Category', type: 'text' },
                { fieldName: 'description', displayName: 'Description', type: 'text' },
                { fieldName: 'unit', displayName: 'Unit', type: 'text' },
                { fieldName: 'costPerUnit', displayName: 'Cost Per Unit', type: 'currency' },
                { fieldName: 'reorderLevel', displayName: 'Reorder Level', type: 'number' },
                { fieldName: 'isActive', displayName: 'Status', type: 'text' },
                { fieldName: 'createdAt', displayName: 'Created Date', type: 'date' }
            ],
            chart_of_accounts: [
                { fieldName: 'accountCode', displayName: 'Account Code', type: 'text' },
                { fieldName: 'accountName', displayName: 'Account Name', type: 'text' },
                { fieldName: 'accountType', displayName: 'Account Type', type: 'text' },
                { fieldName: 'accountGroup', displayName: 'Account Group', type: 'text' },
                { fieldName: 'description', displayName: 'Description', type: 'text' },
                { fieldName: 'isSystemAccount', displayName: 'System Account', type: 'text' },
                { fieldName: 'isActive', displayName: 'Status', type: 'text' },
                { fieldName: 'createdAt', displayName: 'Created Date', type: 'date' }
            ],
            // Add more modules as needed...
        };
        return moduleColumns[moduleName] || [];
    }
}
exports.default = new TemplateService();
