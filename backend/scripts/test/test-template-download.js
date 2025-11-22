const axios = require('axios');

async function testTemplateDownload() {
  try {
    // Get token from localStorage (simulated)
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFlZjFlODk1LTQ3MmUtNDk2Ni1hNTdlLWI2YjI2NmRhNzk0MCIsImVtYWlsIjoiYWRtaW5Aa2FzaGF5YS5jb20iLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MzE3MDUzMzksImV4cCI6MTczMTcxMjUzOX0.CjSi9EZD3DDAD52eHZHgF-5KgGYDRu2eW5nFKkj6MDY'; // Replace with actual token

    console.log('Testing template download...');
    console.log('URL: http://localhost:5000/api/import/suppliers/template?format=excel');

    const response = await axios.get(
      'http://localhost:5000/api/import/suppliers/template',
      {
        params: { format: 'excel' },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'blob',
      }
    );

    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Content-Disposition:', response.headers['content-disposition']);
    console.log('Data size:', response.data.size || response.data.length);

  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.statusText);
    console.error('Error message:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

testTemplateDownload();
