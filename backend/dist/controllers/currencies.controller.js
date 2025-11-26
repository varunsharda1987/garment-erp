"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestExchangeRate = exports.getExchangeRates = exports.addExchangeRate = exports.deleteCurrency = exports.updateCurrency = exports.getCurrencyByCode = exports.getAllCurrencies = exports.createCurrency = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
/**
 * Create new currency
 * POST /api/currencies
 */
const createCurrency = async (req, res) => {
    try {
        const { currencyCode, currencyName, currencySymbol, isBaseCurrency, decimalPlaces, } = req.body;
        // Check if currency code already exists
        const existingCurrency = await database_1.default.currencies.findUnique({
            where: { currencyCode },
        });
        if (existingCurrency) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Currency code already exists',
            });
            return;
        }
        // If setting as base currency, unset existing base
        if (isBaseCurrency) {
            await database_1.default.currencies.updateMany({
                where: { isBaseCurrency: true },
                data: { isBaseCurrency: false },
            });
        }
        const currency = await database_1.default.currencies.create({
            data: {
                currencyCode: currencyCode.toUpperCase(),
                currencyName,
                currencySymbol,
                isBaseCurrency: isBaseCurrency || false,
                decimalPlaces: decimalPlaces || 2,
                isActive: true,
            },
        });
        res.status(201).json({
            data: currency,
            message: 'Currency created successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create currency error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create currency',
        });
    }
};
exports.createCurrency = createCurrency;
/**
 * Get all currencies
 * GET /api/currencies
 */
const getAllCurrencies = async (req, res) => {
    try {
        const { activeOnly = 'true' } = req.query;
        const where = {};
        if (activeOnly === 'true') {
            where.isActive = true;
        }
        const currencies = await database_1.default.currencies.findMany({
            where,
            orderBy: { currencyCode: 'asc' },
            include: {
                _count: {
                    select: {
                        customers: true,
                        suppliers: true,
                        exchange_rates: true,
                    },
                },
            },
        });
        res.json({
            data: currencies,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get currencies error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch currencies',
        });
    }
};
exports.getAllCurrencies = getAllCurrencies;
/**
 * Get currency by code
 * GET /api/currencies/:code
 */
const getCurrencyByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const currency = await database_1.default.currencies.findUnique({
            where: { currencyCode: code.toUpperCase() },
            include: {
                exchange_rates: {
                    orderBy: { effectiveDate: 'desc' },
                    take: 10,
                },
                _count: {
                    select: {
                        customers: true,
                        suppliers: true,
                    },
                },
            },
        });
        if (!currency) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Currency not found',
            });
            return;
        }
        res.json({ data: currency });
    }
    catch (error) {
        (0, logger_1.logError)('Get currency error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch currency',
        });
    }
};
exports.getCurrencyByCode = getCurrencyByCode;
/**
 * Update currency
 * PUT /api/currencies/:code
 */
const updateCurrency = async (req, res) => {
    try {
        const { code } = req.params;
        const { currencyName, currencySymbol, isBaseCurrency, decimalPlaces } = req.body;
        const existingCurrency = await database_1.default.currencies.findUnique({
            where: { currencyCode: code.toUpperCase() },
        });
        if (!existingCurrency) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Currency not found',
            });
            return;
        }
        // If setting as base currency, unset existing base
        if (isBaseCurrency && !existingCurrency.isBaseCurrency) {
            await database_1.default.currencies.updateMany({
                where: { isBaseCurrency: true },
                data: { isBaseCurrency: false },
            });
        }
        const currency = await database_1.default.currencies.update({
            where: { currencyCode: code.toUpperCase() },
            data: {
                currencyName,
                currencySymbol,
                isBaseCurrency,
                decimalPlaces,
            },
        });
        res.json({
            data: currency,
            message: 'Currency updated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Update currency error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update currency',
        });
    }
};
exports.updateCurrency = updateCurrency;
/**
 * Delete currency (soft delete)
 * DELETE /api/currencies/:code
 */
const deleteCurrency = async (req, res) => {
    try {
        const { code } = req.params;
        const currency = await database_1.default.currencies.findUnique({
            where: { currencyCode: code.toUpperCase() },
            include: {
                _count: {
                    select: {
                        customers: true,
                        suppliers: true,
                    },
                },
            },
        });
        if (!currency) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Currency not found',
            });
            return;
        }
        // Cannot delete base currency
        if (currency.isBaseCurrency) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Cannot delete base currency',
            });
            return;
        }
        // Check if in use
        const inUse = currency._count.customers > 0 || currency._count.suppliers > 0;
        if (inUse) {
            res.status(400).json({
                error: 'Validation Error',
                message: `Cannot delete currency. It is used by ${currency._count.customers} customers and ${currency._count.suppliers} suppliers.`,
            });
            return;
        }
        await database_1.default.currencies.update({
            where: { currencyCode: code.toUpperCase() },
            data: { isActive: false },
        });
        res.json({
            message: 'Currency deleted successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Delete currency error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete currency',
        });
    }
};
exports.deleteCurrency = deleteCurrency;
// ============================================
// EXCHANGE RATES
// ============================================
/**
 * Add exchange rate
 * POST /api/currencies/:code/exchange-rates
 */
const addExchangeRate = async (req, res) => {
    try {
        const { code } = req.params;
        const { effectiveDate, rateType, exchangeRate } = req.body;
        const userId = req.user?.userId;
        // Verify currency exists
        const currency = await database_1.default.currencies.findUnique({
            where: { currencyCode: code.toUpperCase() },
        });
        if (!currency) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Currency not found',
            });
            return;
        }
        const rate = await database_1.default.exchange_rates.create({
            data: {
                currencyCode: code.toUpperCase(),
                effectiveDate: new Date(effectiveDate),
                rateType: rateType,
                exchangeRate: parseFloat(exchangeRate),
                createdById: userId || null,
            },
            include: {
                currencies: true,
            },
        });
        res.status(201).json({
            data: rate,
            message: 'Exchange rate added successfully',
        });
    }
    catch (error) {
        if (error.code === 'P2002') {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Exchange rate for this currency, date, and type already exists',
            });
            return;
        }
        (0, logger_1.logError)('Add exchange rate error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to add exchange rate',
        });
    }
};
exports.addExchangeRate = addExchangeRate;
/**
 * Get exchange rates for currency
 * GET /api/currencies/:code/exchange-rates
 */
const getExchangeRates = async (req, res) => {
    try {
        const { code } = req.params;
        const { fromDate, toDate, rateType } = req.query;
        const where = {
            currencyCode: code.toUpperCase(),
        };
        if (fromDate) {
            where.effectiveDate = { gte: new Date(fromDate) };
        }
        if (toDate) {
            where.effectiveDate = {
                ...where.effectiveDate,
                lte: new Date(toDate),
            };
        }
        if (rateType) {
            where.rateType = rateType;
        }
        const rates = await database_1.default.exchange_rates.findMany({
            where,
            orderBy: { effectiveDate: 'desc' },
            include: {
                currencies: {
                    select: {
                        currencyCode: true,
                        currencyName: true,
                        currencySymbol: true,
                    },
                },
            },
        });
        res.json({
            data: rates,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get exchange rates error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch exchange rates',
        });
    }
};
exports.getExchangeRates = getExchangeRates;
/**
 * Get latest exchange rate for currency
 * GET /api/currencies/:code/exchange-rates/latest
 */
const getLatestExchangeRate = async (req, res) => {
    try {
        const { code } = req.params;
        const { rateType = 'AVERAGE' } = req.query;
        const rate = await database_1.default.exchange_rates.findFirst({
            where: {
                currencyCode: code.toUpperCase(),
                rateType: rateType,
                effectiveDate: { lte: new Date() },
            },
            orderBy: { effectiveDate: 'desc' },
            include: {
                currencies: true,
            },
        });
        if (!rate) {
            res.status(404).json({
                error: 'Not Found',
                message: 'No exchange rate found for this currency',
            });
            return;
        }
        res.json({ data: rate });
    }
    catch (error) {
        (0, logger_1.logError)('Get latest exchange rate error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch latest exchange rate',
        });
    }
};
exports.getLatestExchangeRate = getLatestExchangeRate;
