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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new currency
router.post('/', createCurrency);

// Get all currencies
router.get('/', getAllCurrencies);

// Get currency by code
router.get('/:code', getCurrencyByCode);

// Update currency
router.put('/:code', updateCurrency);

// Delete currency (soft delete)
router.delete('/:code', deleteCurrency);

// Exchange rates sub-routes
// Get latest exchange rate for currency
router.get('/:code/exchange-rates/latest', getLatestExchangeRate);

// Add exchange rate
router.post('/:code/exchange-rates', addExchangeRate);

// Get exchange rates for currency
router.get('/:code/exchange-rates', getExchangeRates);

export default router;
