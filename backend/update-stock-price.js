/**
 * Update fabric stock purchase cost
 * Usage: node update-stock-price.js <stock-id> <new-price>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateStockPrice() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node update-stock-price.js <stock-id> <new-price>');
    console.error('Example: node update-stock-price.js abc-123-def 150.50');
    process.exit(1);
  }

  const stockId = args[0];
  const newPrice = parseFloat(args[1]);

  if (isNaN(newPrice) || newPrice < 0) {
    console.error('Error: Price must be a positive number');
    process.exit(1);
  }

  try {
    // Get the stock record
    const stock = await prisma.fabric_stock.findUnique({
      where: { id: stockId },
      include: {
        fabricMaster: {
          select: {
            fabricCode: true,
            fabricName: true,
            colorName: true,
          },
        },
      },
    });

    if (!stock) {
      console.error(`Error: Stock record not found with ID: ${stockId}`);
      process.exit(1);
    }

    console.log('\n📦 Current Stock Details:');
    console.log(`   Fabric: ${stock.fabricMaster.fabricCode} - ${stock.fabricMaster.fabricName}`);
    console.log(`   Color: ${stock.fabricMaster.colorName || 'N/A'}`);
    console.log(`   Quantity: ${stock.quantityAvailable} meters`);
    console.log(`   Current Cost: ₹${Number(stock.purchaseCost)}`);
    console.log(`   New Cost: ₹${newPrice}\n`);

    // Update the stock
    const updated = await prisma.fabric_stock.update({
      where: { id: stockId },
      data: {
        purchaseCost: newPrice,
        weightedAvgCost: newPrice, // Update weighted avg cost too
      },
    });

    console.log('✅ Stock price updated successfully!');
    console.log(`   Purchase Cost: ₹${Number(updated.purchaseCost)}`);
    console.log(`   Weighted Avg Cost: ₹${Number(updated.weightedAvgCost)}`);
    console.log(`   Total Value: ₹${Number(updated.quantityAvailable) * newPrice}\n`);

  } catch (error) {
    console.error('Error updating stock price:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateStockPrice();
