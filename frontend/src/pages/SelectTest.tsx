import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SelectTest() {
  const [value, setValue] = useState('');

  const testData = [
    { id: '1', name: 'Test Customer 1', code: 'TC001' },
    { id: '2', name: 'Test Customer 2', code: 'TC002' },
    { id: '3', name: 'Test Customer 3', code: 'TC003' },
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-8">Select Component Test</h1>

      {/* Test 1: Basic Select with simple text */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Test 1: Basic Select</h2>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
            <SelectItem value="option3">Option 3</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-2 text-sm">Selected: {value || 'None'}</p>
      </div>

      {/* Test 2: Select with inline styles */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Test 2: Select with Inline Styles</h2>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            {testData.map((item) => (
              <SelectItem key={item.id} value={item.id} style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                {item.name} ({item.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Test 3: Plain HTML select as comparison */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Test 3: Native HTML Select (Comparison)</h2>
        <select className="w-full h-10 px-3 border rounded-md" onChange={(e) => setValue(e.target.value)}>
          <option value="">Select an option</option>
          {testData.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.code})
            </option>
          ))}
        </select>
      </div>

      {/* Test 4: Div with same styling */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Test 4: DIV Element Test (Should be visible)</h2>
        <div className="border rounded-md p-2">
          {testData.map((item) => (
            <div key={item.id} className="px-3 py-2 cursor-pointer hover:bg-gray-100" style={{ color: '#111827' }}>
              {item.name} ({item.code})
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold mb-2">Diagnostic Instructions:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Open browser DevTools (F12)</li>
          <li>Click on Test 1 dropdown to open it</li>
          <li>Right-click on an invisible item → Inspect Element</li>
          <li>Check the Computed styles in the right panel</li>
          <li>Look for 'color' property and see what value it has</li>
          <li>Take a screenshot of the Inspect panel</li>
        </ol>
      </div>
    </div>
  );
}
