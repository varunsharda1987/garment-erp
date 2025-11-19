# Material Categorization Refactor - Manual Test Plan

**Date:** November 16, 2025
**Frontend:** http://localhost:5178
**Backend:** http://localhost:5000
**Status:** ✅ Both servers running

---

## 🎯 Test Objectives

1. Verify two-level category selector works correctly
2. Confirm all 15 child categories render appropriate fields
3. Test material creation and saving
4. Verify hierarchical display in material list

---

## 📋 Pre-Test Checklist

- ✅ Backend server running on port 5000
- ✅ Frontend server running on port 5178
- ✅ Database has 19 categories (4 parents + 15 children)
- ✅ User logged in with valid credentials

---

## 🧪 Test Cases

### Test 1: Category Hierarchy Loading

**Steps:**
1. Navigate to http://localhost:5178/materials/new
2. Click on "Category Type" dropdown

**Expected Results:**
- ✅ Dropdown shows 4 parent categories:
  - Fabrics
  - Trims & Notions
  - Threads
  - Packaging
- ✅ No errors in browser console
- ✅ "Material Category" dropdown is disabled

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 2: FABRICS Parent - 4 Children

#### Test 2.1: Greige Fabric
**Steps:**
1. Select "Fabrics" from Category Type
2. Select "Greige Fabric" from Material Category

**Expected Fields:**
- ✅ Fabric Type (dropdown: Woven, Knit, Non-Woven)
- ✅ Composition (text input)
- ✅ Count (text input)
- ✅ Construction (text input)
- ✅ GSM (number input)
- ✅ Width in inches (number input)

**Test Data:**
```
Material Name: Cotton Greige 40s
Fabric Type: Woven
Composition: 100% Cotton
Count: 40s
Construction: Plain Weave
GSM: 180
Width: 60
Unit: Meter
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 2.2: Ready Fabric
**Steps:**
1. Select "Fabrics" from Category Type
2. Select "Ready Fabric" from Material Category

**Expected Fields:**
- ✅ Fabric Type (dropdown)
- ✅ Composition (text)
- ✅ Count (text)
- ✅ Construction (text)
- ✅ GSM (number)
- ✅ Width (number)
- ✅ Color (text)
- ✅ Finish (dropdown: Dyed, Printed, Enzyme Washed, Other)

**Test Data:**
```
Material Name: Navy Blue Cotton Ready Fabric
Fabric Type: Woven
Composition: 100% Cotton
Count: 40s
Construction: Plain
GSM: 180
Width: 60
Color: Navy Blue
Finish: Dyed
Unit: Meter
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 2.3: Lining & Pocketing
**Steps:**
1. Select "Fabrics" from Category Type
2. Select "Lining & Pocketing" from Material Category

**Expected Fields:**
- ✅ Material (dropdown: Polyester, Viscose, Cotton)
- ✅ Weight GSM (number)
- ✅ Width inches (number)
- ✅ Color (text)

**Test Data:**
```
Material Name: Polyester Lining White
Material: Polyester
Weight: 80
Width: 58
Color: White
Unit: Meter
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 2.4: Interlining & Fusibles
**Steps:**
1. Select "Fabrics" from Category Type
2. Select "Interlining & Fusibles" from Material Category

**Expected Fields:**
- ✅ Type (dropdown: Fusible, Non-Fusible)
- ✅ Weight GSM (number)
- ✅ Width inches (number)
- ✅ Color (text)

**Test Data:**
```
Material Name: Fusible Interlining White
Type: Fusible
Weight: 50
Width: 44
Color: White
Unit: Meter
```

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 3: TRIMS & NOTIONS Parent - 5 Children

#### Test 3.1: Closures
**Steps:**
1. Select "Trims & Notions" from Category Type
2. Select "Closures" from Material Category

**Expected Fields:**
- ✅ Item Type (dropdown: Button, Zipper, Snap, Hook & Eye)
- ✅ Size (text)
- ✅ Color (text)
- ✅ Material (dropdown: Metal, Plastic, Polyester, Brass)

**Test Data:**
```
Material Name: Metal Zipper #5 Black
Item Type: Zipper
Size: #5
Color: Black
Material: Metal
Unit: Pieces
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 3.2: Labels & Tags
**Steps:**
1. Select "Trims & Notions" from Category Type
2. Select "Labels & Tags" from Material Category

**Expected Fields:**
- ✅ Label Type (dropdown: Woven Label, Printed Label, Care Label, Hang Tag)
- ✅ Size (text)
- ✅ Printing Colors (number)
- ✅ Material (dropdown: Polyester, Cotton, Paper)

**Test Data:**
```
Material Name: Woven Brand Label
Label Type: Woven Label
Size: 2x1 inches
Printing Colors: 3
Material: Polyester
Unit: Pieces
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 3.3: Elastic & Tapes
**Steps:**
1. Select "Trims & Notions" from Category Type
2. Select "Elastic & Tapes" from Material Category

**Expected Fields:**
- ✅ Type (dropdown: Knitted Elastic, Woven Elastic, Bias Tape, Twill Tape)
- ✅ Width mm (number)
- ✅ Color (text)
- ✅ Stretch Percent (number)

**Test Data:**
```
Material Name: Knitted Elastic White 25mm
Type: Knitted Elastic
Width: 25
Color: White
Stretch Percent: 150
Unit: Meter
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 3.4: Decorative
**Steps:**
1. Select "Trims & Notions" from Category Type
2. Select "Decorative" from Material Category

**Expected Fields:**
- ✅ Type (dropdown: Ribbon, Lace, Bead, Sequin, Applique)
- ✅ Color (text)
- ✅ Size (text)

**Test Data:**
```
Material Name: Gold Sequins 3mm
Type: Sequin
Color: Gold
Size: 3mm
Unit: Gram
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 3.5: Hardware
**Steps:**
1. Select "Trims & Notions" from Category Type
2. Select "Hardware" from Material Category

**Expected Fields:**
- ✅ Type (dropdown: Grommet, Rivet, Buckle, D-Ring, Slider)
- ✅ Size (text)
- ✅ Material (dropdown: Metal, Brass, Plastic)
- ✅ Finish (dropdown: Nickel, Antique, Gold)

**Test Data:**
```
Material Name: Metal Rivet 10mm Antique
Type: Rivet
Size: 10mm
Material: Metal
Finish: Antique
Unit: Pieces
```

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 4: THREADS Parent - 3 Children

#### Test 4.1: Sewing Thread
**Steps:**
1. Select "Threads" from Category Type
2. Select "Sewing Thread" from Material Category

**Expected Fields:**
- ✅ Thread Type (dropdown: Core-spun, Spun Polyester, Cotton)
- ✅ Count (text)
- ✅ Color (text)
- ✅ Composition (text)

**Test Data:**
```
Material Name: Spun Polyester Thread 40/2 White
Thread Type: Spun Polyester
Count: 40/2
Color: White
Composition: 100% Polyester
Unit: Cone
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 4.2: Embroidery Thread
**Steps:**
1. Select "Threads" from Category Type
2. Select "Embroidery Thread" from Material Category

**Expected Fields:**
- ✅ Thread Type (dropdown: Rayon, Polyester, Metallic)
- ✅ Count (text)
- ✅ Color (text)

**Test Data:**
```
Material Name: Rayon Embroidery Thread Gold 40wt
Thread Type: Rayon
Count: 40wt
Color: Gold
Unit: Cone
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 4.3: Specialty Thread
**Steps:**
1. Select "Threads" from Category Type
2. Select "Specialty Thread" from Material Category

**Expected Fields:**
- ✅ Thread Type (dropdown: Buttonhole, Overlock, Blind Stitch)
- ✅ Count (text)
- ✅ Color (text)

**Test Data:**
```
Material Name: Buttonhole Thread 30/3 Black
Thread Type: Buttonhole
Count: 30/3
Color: Black
Unit: Cone
```

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 5: PACKAGING Parent - 3 Children

#### Test 5.1: Primary Packaging
**Steps:**
1. Select "Packaging" from Category Type
2. Select "Primary Packaging" from Material Category

**Expected Fields:**
- ✅ Type (dropdown: Poly Bag, Hanger, Price Tag)
- ✅ Size (text)
- ✅ Material (dropdown: LDPE, PP, Recycled)
- ✅ Printing Required (dropdown: Yes, No)

**Test Data:**
```
Material Name: Poly Bag 12x16 inches
Type: Poly Bag
Size: 12x16 inches
Material: LDPE
Printing Required: No
Unit: Pieces
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 5.2: Secondary Packaging
**Steps:**
1. Select "Packaging" from Category Type
2. Select "Secondary Packaging" from Material Category

**Expected Fields:**
- ✅ Type (dropdown: Carton, Tissue Paper, Inner Box)
- ✅ Dimensions (text)
- ✅ Material (dropdown: Corrugated, Kraft Paper)

**Test Data:**
```
Material Name: Corrugated Carton 40x30x20cm
Type: Carton
Dimensions: 40x30x20 cm
Material: Corrugated
Unit: Pieces
```

**Status:** ⬜ Pass / ⬜ Fail

---

#### Test 5.3: Labeling
**Steps:**
1. Select "Packaging" from Category Type
2. Select "Labeling" from Material Category

**Expected Fields:**
- ✅ Type (dropdown: Barcode Sticker, Size Sticker, Price Label)
- ✅ Size (text)
- ✅ Printing Type (dropdown: Thermal, Inkjet)

**Test Data:**
```
Material Name: Barcode Sticker 2x1 inch
Type: Barcode Sticker
Size: 2x1 inch
Printing Type: Thermal
Unit: Pieces
```

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 6: Material List Display

**Steps:**
1. Navigate to http://localhost:5178/materials
2. Observe the Category column for all created materials

**Expected Results:**
- ✅ Categories display in "Parent > Child" format:
  - "Fabrics > Greige Fabric"
  - "Fabrics > Ready Fabric"
  - "Fabrics > Lining & Pocketing"
  - "Fabrics > Interlining & Fusibles"
  - "Trims & Notions > Closures"
  - "Trims & Notions > Labels & Tags"
  - "Trims & Notions > Elastic & Tapes"
  - "Trims & Notions > Decorative"
  - "Trims & Notions > Hardware"
  - "Threads > Sewing Thread"
  - "Threads > Embroidery Thread"
  - "Threads > Specialty Thread"
  - "Packaging > Primary Packaging"
  - "Packaging > Secondary Packaging"
  - "Packaging > Labeling"

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 7: Category Filter

**Steps:**
1. On Material List page, click the "All Categories" dropdown
2. Observe the list of categories

**Expected Results:**
- ✅ Filter dropdown shows hierarchical format
- ✅ Parent categories show as is (e.g., "Fabrics")
- ✅ Child categories show with parent prefix (e.g., "Fabrics > Greige Fabric")
- ✅ Selecting a filter correctly filters the materials

**Status:** ⬜ Pass / ⬜ Fail

---

### Test 8: Material Edit

**Steps:**
1. Click "Edit" on any created material
2. Verify parent and child categories are pre-selected
3. Verify category-specific data is loaded correctly
4. Make a small change and save
5. Verify changes are persisted

**Expected Results:**
- ✅ Parent category dropdown shows correct selection
- ✅ Child category dropdown loads and shows correct selection
- ✅ Category-specific fields show saved data
- ✅ Changes save successfully
- ✅ Material list reflects the update

**Status:** ⬜ Pass / ⬜ Fail

---

## 🐛 Issues Found

### Issue Template:
```
Issue #:
Test Case:
Description:
Steps to Reproduce:
Expected Behavior:
Actual Behavior:
Severity: Critical / High / Medium / Low
```

---

## ✅ Test Summary

**Total Test Cases:** 23
- Category Loading: 1
- Fabrics (4 categories): 4
- Trims & Notions (5 categories): 5
- Threads (3 categories): 3
- Packaging (3 categories): 3
- Material List Display: 1
- Category Filter: 1
- Material Edit: 1

**Results:**
- ⬜ Passed: ___/23
- ⬜ Failed: ___/23
- ⬜ Blocked: ___/23

**Overall Status:** ⬜ Pass / ⬜ Fail

---

## 📝 Notes

**Backend Server:** ✅ Running on http://localhost:5000
**Frontend Server:** ✅ Running on http://localhost:5178
**Database:** garment_erp (PostgreSQL)

**Testing By:** _________________
**Date Completed:** _________________
**Time Spent:** _________________

---

## 🎉 Success Criteria

All tests must pass for the refactor to be considered complete:
- ✅ All 15 categories render correct fields
- ✅ Material creation works for each category
- ✅ Category data saves correctly
- ✅ Materials display with "Parent > Child" format
- ✅ Category filter works with hierarchy
- ✅ Edit functionality preserves category data
- ✅ No console errors during operation
