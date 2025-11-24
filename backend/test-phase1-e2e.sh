#!/bin/bash

# Phase 1 End-to-End Testing Script
# Tests Lace, Button, and Thread material masters

API_URL="http://localhost:5000"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTRhOTRiNi1jZWY1LTQwYzItYmY5Ni1jZjJiNGI3MTdiYzIiLCJlbWFpbCI6ImFkbWluQGthc2hheWFmYWJzLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc2MzkxMjI0MCwiZXhwIjoxNzY0NTE3MDQwfQ.-6hdSKzn1D15_JRDTf7c9EGiYqaW5F-aKlinP5Yd4oY"

echo "==================================="
echo "Phase 1 E2E Testing"
echo "Testing Lace, Button, Thread CRUD"
echo "==================================="
echo ""

# Test 1: Create additional Lace items
echo "Test 1: Creating Lace Items..."
curl -s -X POST "$API_URL/api/materials/lace" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"laceName": "Black Lace 1inch", "width": 1.0, "color": "Black", "pricePerMeter": 12.50}' \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Created: {data['lace']['laceCode']} - {data['lace']['laceName']}\")"

curl -s -X POST "$API_URL/api/materials/lace" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"laceName": "Red Floral Lace 3inch", "width": 3.0, "color": "Red", "design": "Floral", "pricePerMeter": 18.00}' \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Created: {data['lace']['laceCode']} - {data['lace']['laceName']}\")"

echo ""

# Test 2: List Lace items
echo "Test 2: Listing Lace Items..."
curl -s -X GET "$API_URL/api/materials/lace?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Found {data['pagination']['total']} lace items\")"

echo ""

# Test 3: Create Button items
echo "Test 3: Creating Button Items..."
curl -s -X POST "$API_URL/api/materials/button" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"buttonName": "Black Button 18mm 4-hole", "size": "18mm", "holes": 4, "color": "Black", "material": "Plastic", "shape": "Round", "pricePerPiece": 0.08}' \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Created: {data['button']['buttonCode']} - {data['button']['buttonName']}\")"

curl -s -X POST "$API_URL/api/materials/button" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"buttonName": "Gold Metal Button 20mm 2-hole", "size": "20mm", "holes": 2, "color": "Gold", "material": "Metal", "shape": "Round", "pricePerPiece": 0.15, "pricePerGross": 21.60}' \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Created: {data['button']['buttonCode']} - {data['button']['buttonName']}\")"

echo ""

# Test 4: List Button items
echo "Test 4: Listing Button Items..."
curl -s -X GET "$API_URL/api/materials/button?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Found {data['pagination']['total']} button items\")"

echo ""

# Test 5: Create Thread items
echo "Test 5: Creating Thread Items..."
curl -s -X POST "$API_URL/api/materials/thread" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"threadName": "Cotton Thread 60s White", "threadCount": "60s", "color": "White", "composition": "100% Cotton", "threadType": "Sewing", "coneSize": "5000m", "pricePerCone": 3.50}' \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Created: {data['thread']['threadCode']} - {data['thread']['threadName']}\")"

curl -s -X POST "$API_URL/api/materials/thread" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"threadName": "Polyester Embroidery Thread 40s Black", "threadCount": "40s", "color": "Black", "composition": "100% Polyester", "threadType": "Embroidery", "coneSize": "3000m", "pricePerCone": 4.00}' \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Created: {data['thread']['threadCode']} - {data['thread']['threadName']}\")"

echo ""

# Test 6: List Thread items
echo "Test 6: Listing Thread Items..."
curl -s -X GET "$API_URL/api/materials/thread?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Found {data['pagination']['total']} thread items\")"

echo ""

# Test 7: Search functionality
echo "Test 7: Testing Search Functionality..."
curl -s -X GET "$API_URL/api/materials/lace?search=Black" \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Search 'Black' in lace: {len(data['lace'])} results\")"

curl -s -X GET "$API_URL/api/materials/button?search=Gold" \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Search 'Gold' in button: {len(data['buttons'])} results\")"

echo ""

# Test 8: Get template endpoints
echo "Test 8: Testing Template Download Endpoints..."
curl -s -X GET "$API_URL/api/materials/lace/template" \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Lace template has {len(data['columns'])} columns\")"

curl -s -X GET "$API_URL/api/materials/button/template" \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Button template has {len(data['columns'])} fields\")"

curl -s -X GET "$API_URL/api/materials/thread/template" \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys, json; data=json.load(sys.stdin); print(f\"✓ Thread template has {len(data['columns'])} fields\")"

echo ""
echo "==================================="
echo "✅ All E2E Tests Completed!"
echo "==================================="
