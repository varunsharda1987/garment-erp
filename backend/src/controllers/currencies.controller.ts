// Currencies Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { RateType, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

/**
 * Create new currency
 * POST /api/currencies
 */
export const createCurrency = async (req: Request, res: Response): Promise<void> => {
  const { currencyCode, currencyName, currencySymbol, isBaseCurrency, decimalPlaces } = req.body;

  // Check if currency code already exists
  const existingCurrency = await prisma.currencies.findUnique({
    where: { currencyCode },
  });

  if (existingCurrency) {
    throw new ConflictError('Currency code already exists');
  }

  // Base-currency switch must be atomic (bug-hunt financial-gst-16): unsetting the old base and
  // creating the new one in separate statements could leave the system with ZERO base currency
  // if the create failed (e.g. a code race slipping past the pre-check).
  const currency = await prisma.$transaction(async (tx) => {
    if (isBaseCurrency) {
      await tx.currencies.updateMany({
        where: { isBaseCurrency: true },
        data: { isBaseCurrency: false },
      });
    }

    return tx.currencies.create({
      data: {
        currencyCode: currencyCode.toUpperCase(),
        currencyName,
        currencySymbol,
        isBaseCurrency: isBaseCurrency || false,
        decimalPlaces: decimalPlaces || 2,
        isActive: true,
      },
    });
  });

  res.status(201).json({
    data: currency,
    message: 'Currency created successfully',
  });
};

/**
 * Get all currencies
 * GET /api/currencies
 */
export const getAllCurrencies = async (req: Request, res: Response): Promise<void> => {
  const { activeOnly = 'true' } = req.query;

  const where: Prisma.currenciesWhereInput = {};

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
};

/**
 * Get currency by code
 * GET /api/currencies/:code
 */
export const getCurrencyByCode = async (req: Request, res: Response): Promise<void> => {
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
    throw new NotFoundError('Currency', code);
  }

  res.json({ data: currency });
};

/**
 * Update currency
 * PUT /api/currencies/:code
 */
export const updateCurrency = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params;
  const { currencyName, currencySymbol, isBaseCurrency, decimalPlaces } = req.body;

  const existingCurrency = await prisma.currencies.findUnique({
    where: { currencyCode: code.toUpperCase() },
  });

  if (!existingCurrency) {
    throw new NotFoundError('Currency', code);
  }

  // Atomic base-currency switch (bug-hunt financial-gst-16) — see createCurrency
  const currency = await prisma.$transaction(async (tx) => {
    if (isBaseCurrency && !existingCurrency.isBaseCurrency) {
      await tx.currencies.updateMany({
        where: { isBaseCurrency: true },
        data: { isBaseCurrency: false },
      });
    }

    return tx.currencies.update({
      where: { currencyCode: code.toUpperCase() },
      data: {
        currencyName,
        currencySymbol,
        isBaseCurrency,
        decimalPlaces,
      },
    });
  });

  res.json({
    data: currency,
    message: 'Currency updated successfully',
  });
};

/**
 * Delete currency (soft delete)
 * DELETE /api/currencies/:code
 */
export const deleteCurrency = async (req: Request, res: Response): Promise<void> => {
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
    throw new NotFoundError('Currency', code);
  }

  // Cannot delete base currency
  if (currency.isBaseCurrency) {
    throw new ValidationError('Cannot delete base currency');
  }

  // Check if in use
  const inUse = currency._count.customers > 0 || currency._count.suppliers > 0;
  if (inUse) {
    throw new ConflictError(
      `Cannot delete currency. It is used by ${currency._count.customers} customers and ${currency._count.suppliers} suppliers.`
    );
  }

  await prisma.currencies.update({
    where: { currencyCode: code.toUpperCase() },
    data: { isActive: false },
  });

  res.json({
    message: 'Currency deleted successfully',
  });
};

// ============================================
// EXCHANGE RATES
// ============================================

/**
 * Add exchange rate
 * POST /api/currencies/:code/exchange-rates
 */
export const addExchangeRate = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params;
  const { effectiveDate, rateType, exchangeRate } = req.body;

  const userId = req.user?.userId;

  // Verify currency exists
  const currency = await prisma.currencies.findUnique({
    where: { currencyCode: code.toUpperCase() },
  });

  if (!currency) {
    throw new NotFoundError('Currency', code);
  }

  const rate = await prisma.exchange_rates.create({
    data: {
      currencyCode: code.toUpperCase(),
      effectiveDate: new Date(effectiveDate),
      rateType: rateType as RateType,
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
};

/**
 * Get exchange rates for currency
 * GET /api/currencies/:code/exchange-rates
 */
export const getExchangeRates = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params;
  const { fromDate, toDate, rateType } = req.query;

  const where: Prisma.exchange_ratesWhereInput = {
    currencyCode: code.toUpperCase(),
  };

  if (fromDate || toDate) {
    const effectiveDateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate) {
      effectiveDateFilter.gte = new Date(fromDate as string);
    }
    if (toDate) {
      effectiveDateFilter.lte = new Date(toDate as string);
    }
    where.effectiveDate = effectiveDateFilter;
  }

  if (rateType) {
    where.rateType = rateType as RateType;
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
};

/**
 * Get latest exchange rate for currency
 * GET /api/currencies/:code/exchange-rates/latest
 */
export const getLatestExchangeRate = async (req: Request, res: Response): Promise<void> => {
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
    throw new NotFoundError('Exchange rate');
  }

  res.json({ data: rate });
};
