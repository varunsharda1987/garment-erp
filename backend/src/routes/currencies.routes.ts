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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new currency
router.post('/', asyncHandler(createCurrency));

// Get all currencies
router.get('/', asyncHandler(getAllCurrencies));

// Get currency by code
router.get('/:code', asyncHandler(getCurrencyByCode));

// Update currency
router.put('/:code', asyncHandler(updateCurrency));

// Delete currency (soft delete)
router.delete('/:code', asyncHandler(deleteCurrency));

// Exchange rates sub-routes
// Get latest exchange rate for currency
router.get('/:code/exchange-rates/latest', asyncHandler(getLatestExchangeRate));

// Add exchange rate
router.post('/:code/exchange-rates', asyncHandler(addExchangeRate));

// Get exchange rates for currency
router.get('/:code/exchange-rates', asyncHandler(getExchangeRates));

export default router;
