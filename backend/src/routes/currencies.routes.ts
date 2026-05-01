// Currencies Routes
import express from 'express';
import {
  createCurrency,
  getAllCurrencies,
  getCurrencyByCode,
  updateCurrency,
  deleteCurrency,
  addExchangeRate,
  getExchangeRates,
  getLatestExchangeRate,
} from '../controllers/currencies.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createCurrencySchema,
  updateCurrencySchema,
  createExchangeRateSchema,
  currencyQuerySchema,
} from '../schemas/currencies.schema';
import { codeParamSchema } from '../schemas/common.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new currency
router.post('/', validateBody(createCurrencySchema), asyncHandler(createCurrency));

// Get all currencies
router.get('/', validateQuery(currencyQuerySchema), asyncHandler(getAllCurrencies));

// Get currency by code
router.get('/:code', validateParams(codeParamSchema), asyncHandler(getCurrencyByCode));

// Update currency
router.put('/:code', validateParams(codeParamSchema), validateBody(updateCurrencySchema), asyncHandler(updateCurrency));

// Delete currency (soft delete)
router.delete('/:code', validateParams(codeParamSchema), asyncHandler(deleteCurrency));

// Exchange rates sub-routes
// Get latest exchange rate for currency
router.get('/:code/exchange-rates/latest', validateParams(codeParamSchema), asyncHandler(getLatestExchangeRate));

// Add exchange rate
router.post(
  '/:code/exchange-rates',
  validateParams(codeParamSchema),
  validateBody(createExchangeRateSchema),
  asyncHandler(addExchangeRate)
);

// Get exchange rates for currency
router.get('/:code/exchange-rates', validateParams(codeParamSchema), asyncHandler(getExchangeRates));

export default router;
