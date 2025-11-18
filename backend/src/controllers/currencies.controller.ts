// Currencies Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { RateType } from '@prisma/client';

/**
 * Create new currency
 * POST /api/currencies
 */
export const createCurrency = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      currencyCode,
      currencyName,
      currencySymbol,
      isBaseCurrency,
      decimalPlaces,
    } = req.body;

    // Check if currency code already exists
    const existingCurrency = await prisma.currencies.findUnique({
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
      await prisma.currencies.updateMany({
        where: { isBaseCurrency: true },
        data: { isBaseCurrency: false },
      });
    }

    const currency = await prisma.currencies.create({
      data: {
        currencyCode: currencyCode.toUpperCase(),
        currencyName,
        currencySymbol,
        isBaseCurrency: isBaseCurrency || false,
        decimalPlaces: decimalPlaces || 2,
        isActive: true,
      } as any,
    });

    res.status(201).json({
      data: currency,
      message: 'Currency created successfully',
    });
  } catch (error) {
    console.error('Create currency error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create currency',
    });
  }
};

/**
 * Get all currencies
 * GET /api/currencies
 */
export const getAllCurrencies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { activeOnly = 'true' } = req.query;

    const where: any = {};

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const currencies = await prisma.currencies.findMany({
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
  } catch (error) {
    console.error('Get currencies error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch currencies',
    });
  }
};

/**
 * Get currency by code
 * GET /api/currencies/:code
 */
export const getCurrencyByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    const currency = await prisma.currencies.findUnique({
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
  } catch (error) {
    console.error('Get currency error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch currency',
    });
  }
};

/**
 * Update currency
 * PUT /api/currencies/:code
 */
export const updateCurrency = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;
    const { currencyName, currencySymbol, isBaseCurrency, decimalPlaces } = req.body;

    const existingCurrency = await prisma.currencies.findUnique({
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
      await prisma.currencies.updateMany({
        where: { isBaseCurrency: true },
        data: { isBaseCurrency: false },
      });
    }

    const currency = await prisma.currencies.update({
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
  } catch (error) {
    console.error('Update currency error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update currency',
    });
  }
};

/**
 * Delete currency (soft delete)
 * DELETE /api/currencies/:code
 */
export const deleteCurrency = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    const currency = await prisma.currencies.findUnique({
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

    await prisma.currencies.update({
      where: { currencyCode: code.toUpperCase() },
      data: { isActive: false },
    });

    res.json({
      message: 'Currency deleted successfully',
    });
  } catch (error) {
    console.error('Delete currency error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete currency',
    });
  }
};

// ============================================
// EXCHANGE RATES
// ============================================

/**
 * Add exchange rate
 * POST /api/currencies/:code/exchange-rates
 */
export const addExchangeRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;
    const { effectiveDate, rateType, exchangeRate } = req.body;

    const userId = (req as any).user?.userId;

    // Verify currency exists
    const currency = await prisma.currencies.findUnique({
      where: { currencyCode: code.toUpperCase() },
    });

    if (!currency) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Currency not found',
      });
      return;
    }

    const rate = await prisma.exchange_rates.create({
      data: {
        currencyCode: code.toUpperCase(),
        effectiveDate: new Date(effectiveDate),
        rateType: rateType as RateType,
        exchangeRate: parseFloat(exchangeRate),
        createdById: userId || null,
      } as any,
      include: {
        currencies: true,
      },
    });

    res.status(201).json({
      data: rate,
      message: 'Exchange rate added successfully',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Exchange rate for this currency, date, and type already exists',
      });
      return;
    }

    console.error('Add exchange rate error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add exchange rate',
    });
  }
};

/**
 * Get exchange rates for currency
 * GET /api/currencies/:code/exchange-rates
 */
export const getExchangeRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;
    const { fromDate, toDate, rateType } = req.query;

    const where: any = {
      currencyCode: code.toUpperCase(),
    };

    if (fromDate) {
      where.effectiveDate = { gte: new Date(fromDate as string) };
    }

    if (toDate) {
      where.effectiveDate = {
        ...where.effectiveDate,
        lte: new Date(toDate as string),
      };
    }

    if (rateType) {
      where.rateType = rateType as string;
    }

    const rates = await prisma.exchange_rates.findMany({
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
  } catch (error) {
    console.error('Get exchange rates error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch exchange rates',
    });
  }
};

/**
 * Get latest exchange rate for currency
 * GET /api/currencies/:code/exchange-rates/latest
 */
export const getLatestExchangeRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;
    const { rateType = 'AVERAGE' } = req.query;

    const rate = await prisma.exchange_rates.findFirst({
      where: {
        currencyCode: code.toUpperCase(),
        rateType: rateType as RateType,
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
  } catch (error) {
    console.error('Get latest exchange rate error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch latest exchange rate',
    });
  }
};
