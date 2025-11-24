// Seed Production Planning Data - Comprehensive dummy data for testing
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Production Planning Data Seeding...\n');

  try {
    // Get the admin user
    const adminUser = await prisma.users.findFirst({
      where: { email: 'admin@kashayafabs.com' }
    });

    if (!adminUser) {
      console.error('❌ Admin user not found. Please run user seed first.');
      return;
    }

    console.log('✅ Found admin user:', adminUser.email);

    // 1. Create Customers (if not exist)
    console.log('\n📝 Creating Customers...');

    const customer1 = await prisma.customers.upsert({
      where: { code: 'CUST001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST001',
        name: 'Fashion Boutique Pvt Ltd',
        type: 'BUYER',
        category: 'DOMESTIC',
        contactPerson: 'Rahul Sharma',
        email: 'rahul@fashionboutique.com',
        phone: '9876543210',
        billingAddress: '123 MG Road, Bangalore, Karnataka - 560001',
        shippingAddress: '123 MG Road, Bangalore, Karnataka - 560001',
        gstNumber: '29ABCDE1234F1Z5',
        creditLimit: 500000,
        creditDays: 30,
        brandNames: 'Urban Style, Trendy Wear',
        categories: 'Ethnic Wear, Western Wear',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const customer2 = await prisma.customers.upsert({
      where: { code: 'CUST002' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST002',
        name: 'Global Fashions Inc',
        type: 'BUYER',
        category: 'EXPORT',
        contactPerson: 'John Smith',
        email: 'john@globalfashions.com',
        phone: '9876543211',
        billingAddress: '456 Park Avenue, Mumbai, Maharashtra - 400001',
        shippingAddress: '456 Park Avenue, Mumbai, Maharashtra - 400001',
        gstNumber: '27XYZAB5678G2W3',
        creditLimit: 1000000,
        creditDays: 45,
        brandNames: 'Global Style',
        categories: 'Western Wear, Kids Wear',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    console.log('✅ Created 2 customers');

    // 2. Create Styles (if not exist)
    console.log('\n👔 Creating Styles...');

    const style1 = await prisma.styles.upsert({
      where: { styleCode: 'ETH-MEN-001' },
      update: {},
      create: {
        id: randomUUID(),
        styleCode: 'ETH-MEN-001',
        styleName: 'Men Kurta Palazzo Set',
        customerName: 'Fashion Boutique Pvt Ltd',
        brandName: 'Urban Style',
        season: 'Summer 2025',
        description: 'Premium cotton kurta with palazzo pants',
        gender: 'MEN',
        ageGroup: 'ADULT',
        costPrice: 450,
        sellingPrice: 899,
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const style2 = await prisma.styles.upsert({
      where: { styleCode: 'WES-WOM-001' },
      update: {},
      create: {
        id: randomUUID(),
        styleCode: 'WES-WOM-001',
        styleName: 'Women Casual Dress',
        customerName: 'Global Fashions Inc',
        brandName: 'Global Style',
        season: 'Spring 2025',
        description: 'Trendy casual dress with floral print',
        gender: 'WOMEN',
        ageGroup: 'ADULT',
        costPrice: 550,
        sellingPrice: 1299,
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const style3 = await prisma.styles.upsert({
      where: { styleCode: 'ETH-WOM-001' },
      update: {},
      create: {
        id: randomUUID(),
        styleCode: 'ETH-WOM-001',
        styleName: 'Women Anarkali Suit',
        customerName: 'Fashion Boutique Pvt Ltd',
        brandName: 'Trendy Wear',
        season: 'Festive 2025',
        description: 'Elegant anarkali suit with embroidery',
        gender: 'WOMEN',
        ageGroup: 'ADULT',
        costPrice: 850,
        sellingPrice: 1899,
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 3 styles');

    // 3. Create Color and Size Options
    console.log('\n🎨 Creating Color and Size Options...');

    // Colors for Style 1
    const s1Colors = await Promise.all([
      prisma.color_options.create({
        data: {
          id: randomUUID(),
          styleId: style1.id,
          colorName: 'Navy Blue',
          colorCode: '#001F3F',
          sortOrder: 1
        }
      }),
      prisma.color_options.create({
        data: {
          id: randomUUID(),
          styleId: style1.id,
          colorName: 'Maroon',
          colorCode: '#800000',
          sortOrder: 2
        }
      }),
      prisma.color_options.create({
        data: {
          id: randomUUID(),
          styleId: style1.id,
          colorName: 'Black',
          colorCode: '#000000',
          sortOrder: 3
        }
      })
    ]);

    // Sizes for Style 1
    const s1Sizes = await Promise.all([
      prisma.size_options.create({
        data: {
          id: randomUUID(),
          styleId: style1.id,
          sizeName: 'M',
          sizeCode: 'M',
          sortOrder: 1
        }
      }),
      prisma.size_options.create({
        data: {
          id: randomUUID(),
          styleId: style1.id,
          sizeName: 'L',
          sizeCode: 'L',
          sortOrder: 2
        }
      }),
      prisma.size_options.create({
        data: {
          id: randomUUID(),
          styleId: style1.id,
          sizeName: 'XL',
          sizeCode: 'XL',
          sortOrder: 3
        }
      }),
      prisma.size_options.create({
        data: {
          id: randomUUID(),
          styleId: style1.id,
          sizeName: 'XXL',
          sizeCode: 'XXL',
          sortOrder: 4
        }
      })
    ]);

    // Colors for Style 2
    const s2Colors = await Promise.all([
      prisma.color_options.create({
        data: {
          id: randomUUID(),
          styleId: style2.id,
          colorName: 'Floral Pink',
          colorCode: '#FF69B4',
          sortOrder: 1
        }
      }),
      prisma.color_options.create({
        data: {
          id: randomUUID(),
          styleId: style2.id,
          colorName: 'Sky Blue',
          colorCode: '#87CEEB',
          sortOrder: 2
        }
      })
    ]);

    // Sizes for Style 2
    const s2Sizes = await Promise.all([
      prisma.size_options.create({
        data: {
          id: randomUUID(),
          styleId: style2.id,
          sizeName: 'S',
          sizeCode: 'S',
          sortOrder: 1
        }
      }),
      prisma.size_options.create({
        data: {
          id: randomUUID(),
          styleId: style2.id,
          sizeName: 'M',
          sizeCode: 'M',
          sortOrder: 2
        }
      }),
      prisma.size_options.create({
        data: {
          id: randomUUID(),
          styleId: style2.id,
          sizeName: 'L',
          sizeCode: 'L',
          sortOrder: 3
        }
      })
    ]);

    console.log('✅ Created colors and sizes for all styles');

    // 4. Create Orders
    console.log('\n📦 Creating Customer Orders...');

    const order1 = await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: 'ORD-2025-001',
        customerId: customer1.id,
        orderDate: new Date('2025-01-05'),
        expectedDeliveryDate: new Date('2025-02-15'),
        status: 'PENDING',
        priority: 'HIGH',
        totalQuantity: 500,
        totalAmount: 224500,
        paymentTerms: '30 days credit',
        shippingAddress: customer1.shippingAddress || '',
        remarks: 'First order of 2025 - urgent delivery required',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const order2 = await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: 'ORD-2025-002',
        customerId: customer2.id,
        orderDate: new Date('2025-01-10'),
        expectedDeliveryDate: new Date('2025-02-28'),
        status: 'PENDING',
        priority: 'MEDIUM',
        totalQuantity: 800,
        totalAmount: 439200,
        paymentTerms: '45 days credit',
        shippingAddress: customer2.shippingAddress || '',
        remarks: 'Export order - ensure quality standards',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 2 customer orders');

    // 5. Create Order Items
    console.log('\n📋 Creating Order Items...');

    const orderItem1 = await prisma.order_items.create({
      data: {
        id: randomUUID(),
        orderId: order1.id,
        styleId: style1.id,
        itemDescription: 'Men Kurta Palazzo Set - Navy Blue, Maroon, Black',
        totalQuantity: 500,
        unitPrice: 449,
        totalPrice: 224500,
        deliveryDate: new Date('2025-02-15'),
        status: 'PENDING',
        remarks: 'Pack in individual polybags'
      }
    });

    const orderItem2 = await prisma.order_items.create({
      data: {
        id: randomUUID(),
        orderId: order2.id,
        styleId: style2.id,
        itemDescription: 'Women Casual Dress - Floral Pink, Sky Blue',
        totalQuantity: 800,
        unitPrice: 549,
        totalPrice: 439200,
        deliveryDate: new Date('2025-02-28'),
        status: 'PENDING',
        remarks: 'Export quality packaging required'
      }
    });

    console.log('✅ Created 2 order items');

    // 6. Create Order Item Breakup (Color x Size matrix)
    console.log('\n🎯 Creating Order Item Breakup...');

    // Order Item 1 breakup (500 pieces across colors and sizes)
    const breakup1 = [];
    for (const color of s1Colors) {
      for (const size of s1Sizes) {
        let qty = 0;
        if (size.sizeName === 'M') qty = 30;
        else if (size.sizeName === 'L') qty = 50;
        else if (size.sizeName === 'XL') qty = 40;
        else if (size.sizeName === 'XXL') qty = 20;

        breakup1.push({
          id: randomUUID(),
          orderItemId: orderItem1.id,
          colorId: color.id,
          sizeId: size.id,
          quantity: qty
        });
      }
    }

    await prisma.order_item_breakup.createMany({ data: breakup1 });
    console.log(`✅ Created ${breakup1.length} breakup entries for Order Item 1`);

    // 7. Create Warehouses/Locations (if not exist)
    console.log('\n🏭 Creating Production Locations...');

    const factory1 = await prisma.locations.upsert({
      where: { locationCode: 'FAC-001' },
      update: {},
      create: {
        id: randomUUID(),
        locationCode: 'FAC-001',
        locationName: 'Main Production Unit',
        locationType: 'FACTORY',
        address: '789 Industrial Area, Phase 1, Bangalore',
        capacity: 5000,
        isActive: true,
      }
    });

    const factory2 = await prisma.locations.upsert({
      where: { locationCode: 'FAC-002' },
      update: {},
      create: {
        id: randomUUID(),
        locationCode: 'FAC-002',
        locationName: 'Secondary Production Unit',
        locationType: 'FACTORY',
        address: '456 Industrial Estate, Phase 2, Chennai',
        capacity: 3000,
        isActive: true,
      }
    });

    console.log('✅ Created 2 production locations');

    // 8. Create Work Orders
    console.log('\n🏗️ Creating Work Orders...');

    const workOrder1 = await prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber: 'WO2501-0001',
        orderId: order1.id,
        orderItemId: orderItem1.id,
        styleId: style1.id,
        locationId: factory1.id,
        plannedStartDate: new Date('2025-01-20'),
        plannedEndDate: new Date('2025-02-10'),
        actualStartDate: new Date('2025-01-20'),
        totalQuantity: 500,
        completedQuantity: 180,
        status: 'IN_PRODUCTION',
        priority: 'HIGH',
        remarks: 'Rush order - prioritize production',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const workOrder2 = await prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber: 'WO2501-0002',
        orderId: order2.id,
        orderItemId: orderItem2.id,
        styleId: style2.id,
        locationId: factory2.id,
        plannedStartDate: new Date('2025-01-25'),
        plannedEndDate: new Date('2025-02-20'),
        totalQuantity: 800,
        completedQuantity: 0,
        status: 'PENDING',
        priority: 'MEDIUM',
        remarks: 'Export order - ensure quality checks',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 2 work orders');

    // 9. Create Work Order Breakup
    console.log('\n📊 Creating Work Order Breakup...');

    const woBreakup = [];
    for (const color of s1Colors) {
      for (const size of s1Sizes) {
        let qty = 0;
        if (size.sizeName === 'M') qty = 30;
        else if (size.sizeName === 'L') qty = 50;
        else if (size.sizeName === 'XL') qty = 40;
        else if (size.sizeName === 'XXL') qty = 20;

        woBreakup.push({
          id: randomUUID(),
          workOrderId: workOrder1.id,
          colorId: color.id,
          sizeId: size.id,
          plannedQuantity: qty,
          completedQuantity: Math.floor(qty * 0.36) // 36% complete
        });
      }
    }

    await prisma.work_order_breakup.createMany({ data: woBreakup });
    console.log(`✅ Created ${woBreakup.length} work order breakup entries`);

    // 10. Create Production Tracking Updates
    console.log('\n📈 Creating Production Tracking Updates...');

    await prisma.production_tracking.createMany({
      data: [
        {
          id: randomUUID(),
          workOrderId: workOrder1.id,
          productionStage: 'CUTTING',
          updateDate: new Date('2025-01-20T10:00:00'),
          quantityCompleted: 500,
          remarks: 'All cutting completed',
          updatedById: adminUser.id,
        },
        {
          id: randomUUID(),
          workOrderId: workOrder1.id,
          productionStage: 'STITCHING',
          updateDate: new Date('2025-01-25T14:30:00'),
          quantityCompleted: 350,
          remarks: 'Stitching in progress - 70% done',
          updatedById: adminUser.id,
        },
        {
          id: randomUUID(),
          workOrderId: workOrder1.id,
          productionStage: 'FINISHING',
          updateDate: new Date('2025-01-28T16:00:00'),
          quantityCompleted: 180,
          remarks: 'Finishing ongoing - buttons attached',
          updatedById: adminUser.id,
        }
      ]
    });

    console.log('✅ Created 3 production tracking updates');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PRODUCTION DATA SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary of Created Data:');
    console.log('   ✅ 2 Customers (Fashion Boutique, Global Fashions)');
    console.log('   ✅ 3 Styles (Kurta Set, Casual Dress, Anarkali)');
    console.log('   ✅ Colors & Sizes for all styles');
    console.log('   ✅ 2 Customer Orders (500 + 800 pieces)');
    console.log('   ✅ 2 Order Items with breakup');
    console.log('   ✅ 2 Production Locations (Bangalore, Chennai)');
    console.log('   ✅ 2 Work Orders (1 in production, 1 pending)');
    console.log('   ✅ Work order breakup (color x size)');
    console.log('   ✅ 3 Production tracking updates');
    console.log('\n🎯 You can now view:');
    console.log('   • Production Dashboard - See active work orders & metrics');
    console.log('   • Work Orders List - Browse and filter work orders');
    console.log('   • Orders List - View customer orders');
    console.log('   • Styles List - See all product styles');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
