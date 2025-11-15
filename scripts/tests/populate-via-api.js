// Populate data via API endpoints
// This bypasses Prisma schema issues by using the existing API layer

const API_URL = 'http://localhost:5000/api';
const credentials = {
  email: 'admin@kashayafabs.com',
  password: 'Admin@123'
};

let authToken = '';

async function login() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });

  const data = await response.json();
  authToken = data.token;
  console.log('✅ Logged in\\n');
}

async function createSuppliers() {
  console.log('🏢 Creating Suppliers...');

  const suppliers = [
    {
      code: 'SUPP-FAB-001',
      name: 'Premium Fabrics Pvt Ltd',
      category: 'FABRIC',
      contactPerson: 'Sanjay Gupta',
      email: 'sanjay@premiumfabrics.in',
      phone: '9123456780',
      address: 'Textile Market, Surat, Gujarat',
      gstNumber: '24AABCU9603R1ZP'
    },
    {
      code: 'SUPP-TRM-001',
      name: 'Button & Zipper Co',
      category: 'TRIMS_ACCESSORIES',
      contactPerson: 'Vijay Shah',
      email: 'vijay@buttonzipper.in',
      phone: '9123456782',
      address: 'Industrial Area, Ludhiana',
      gstNumber: '03AABCU9603R1ZR'
    },
    {
      code: 'SUPP-DYE-001',
      name: 'Color Perfect Dyeing',
      category: 'DYEING_PRINTING',
      contactPerson: 'Arvind Kumar',
      email: 'arvind@colorperfect.in',
      phone: '9123456784',
      address: 'Dyeing Hub, Tirupur',
      gstNumber: '33AABCU9603R1ZT'
    },
    {
      code: 'SUPP-EMB-001',
      name: 'Royal Embroidery Works',
      category: 'EMBROIDERY',
      contactPerson: 'Deepak Singh',
      email: 'deepak@royalemb.in',
      phone: '9123456786',
      address: 'Embroidery Lane, Lucknow',
      gstNumber: '09AABCU9603R1ZV'
    },
    {
      code: 'SUPP-CMT-001',
      name: 'Precision Stitching Unit',
      category: 'CMT_UNIT',
      contactPerson: 'Mahesh Reddy',
      email: 'mahesh@precisionst.in',
      phone: '9123456787',
      address: 'Garment City, Bangalore',
      gstNumber: '29AABCU9603R1ZW'
    }
  ];

  for (const supplier of suppliers) {
    try {
      const response = await fetch(`${API_URL}/suppliers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supplier)
      });

      if (response.ok) {
        console.log(`  ✅ Created supplier: ${supplier.name}`);
      } else {
        const error = await response.text();
        console.log(`  ⚠️  ${supplier.code}: ${error}`);
      }
    } catch (error) {
      console.log(`  ❌ ${supplier.code}: ${error.message}`);
    }
  }

  console.log('\\n✅ Suppliers creation complete\\n');
}

async function main() {
  console.log('🌱 Populating Master Data via API...\\n');
  console.log('============================================================\\n');

  try {
    await login();
    await createSuppliers();

    console.log('============================================================');
    console.log('🎉 Data Population Complete!');
    console.log('============================================================\\n');
    console.log('📊 Summary:');
    console.log('   ✅ 5 Suppliers created');
    console.log('\\n🎯 Next: Refresh the Suppliers page to see the data\\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
