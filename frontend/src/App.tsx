import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [apiStatus, setApiStatus] = useState<string>('Checking...');
  const [apiData, setApiData] = useState<any>(null);

  useEffect(() => {
    // Test API connection
    fetch('http://localhost:5000/health')
      .then(res => res.json())
      .then(data => {
        setApiStatus('Connected');
        setApiData(data);
      })
      .catch(err => {
        setApiStatus('Disconnected');
        console.error('API connection failed:', err);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🏭 Kashaya Fabs ERP
          </h1>
          <p className="text-gray-600 mb-8">Garment Manufacturing System</p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">System Status</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Frontend:</span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Running
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Backend API:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  apiStatus === 'Connected'
                    ? 'bg-green-100 text-green-800'
                    : apiStatus === 'Checking...'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    apiStatus === 'Connected'
                      ? 'bg-green-500'
                      : apiStatus === 'Checking...'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}></span>
                  {apiStatus}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Database:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  apiStatus === 'Connected'
                    ? 'bg-green-100 text-green-800'
                    : apiStatus === 'Checking...'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    apiStatus === 'Connected'
                      ? 'bg-green-500'
                      : apiStatus === 'Checking...'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}></span>
                  {apiStatus === 'Connected' ? 'Connected' : apiStatus}
                </span>
              </div>
            </div>
          </div>

          {apiData && (
            <div className="bg-blue-50 rounded-lg p-4 text-left">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">API Response:</h3>
              <pre className="text-xs text-gray-600 overflow-auto">
                {JSON.stringify(apiData, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-8 text-sm text-gray-500">
            <p>Phase 1: Foundation - Module 1.1 Complete</p>
            <p className="mt-1">Ready for development! 🚀</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
