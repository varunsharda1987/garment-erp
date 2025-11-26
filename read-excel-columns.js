const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\admin\\Downloads\\style_import_template.xlsx';

try {
  const workbook = XLSX.readFile(filePath);

  console.log('Available Sheets:', workbook.SheetNames.join(', '));
  console.log('\n' + '='.repeat(60));

  workbook.SheetNames.forEach(sheetName => {
    console.log(`\nSheet: "${sheetName}"`);
    console.log('-'.repeat(60));

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length > 0 && data[0]) {
      console.log('\nColumn Names:');
      data[0].forEach((col, i) => {
        console.log(`  ${(i+1).toString().padStart(2)}. ${col}`);
      });
    }

    console.log(`\nTotal Columns: ${data[0] ? data[0].length : 0}`);
    console.log(`Total Rows (including header): ${data.length}`);
  });
} catch (error) {
  console.error('Error reading Excel file:', error.message);
}
