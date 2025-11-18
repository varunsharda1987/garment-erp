"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Currencies Routes
const express_1 = __importDefault(require("express"));
const currencies_controller_1 = require("../controllers/currencies.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Create new currency
router.post('/', currencies_controller_1.createCurrency);
// Get all currencies
router.get('/', currencies_controller_1.getAllCurrencies);
// Get currency by code
router.get('/:code', currencies_controller_1.getCurrencyByCode);
// Update currency
router.put('/:code', currencies_controller_1.updateCurrency);
// Delete currency (soft delete)
router.delete('/:code', currencies_controller_1.deleteCurrency);
// Exchange rates sub-routes
// Get latest exchange rate for currency
router.get('/:code/exchange-rates/latest', currencies_controller_1.getLatestExchangeRate);
// Add exchange rate
router.post('/:code/exchange-rates', currencies_controller_1.addExchangeRate);
// Get exchange rates for currency
router.get('/:code/exchange-rates', currencies_controller_1.getExchangeRates);
exports.default = router;
