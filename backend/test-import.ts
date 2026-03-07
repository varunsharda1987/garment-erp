// Test if thread-conversion controller can be imported
import * as threadConversionController from './src/controllers/thread-conversion.controller';

console.log('Controller exports:', Object.keys(threadConversionController));
console.log('convertThreadQuantity:', typeof threadConversionController.convertThreadQuantity);
console.log('getPackagingSpecs:', typeof threadConversionController.getPackagingSpecs);
