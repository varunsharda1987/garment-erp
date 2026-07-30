# Testing & Quality Guide

> **Complete Quality Control & Testing Documentation**
> **Last Updated:** January 12, 2026
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quality Control Stages](#2-quality-control-stages)
3. [Fabric Physical Tests (FPT)](#3-fabric-physical-tests-fpt)
4. [Garment Physical Tests (GPT)](#4-garment-physical-tests-gpt)
5. [Testing Labs Management](#5-testing-labs-management)
6. [Test Templates](#6-test-templates)
7. [AQL-Based Inspection](#7-aql-based-inspection)
8. [API Reference](#8-api-reference)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

The Testing & Quality module ensures product quality through systematic testing at multiple stages of production.

### Key Components

| Component | Purpose | Table |
|-----------|---------|-------|
| Fabric Tests | Physical property testing | `fabric_physical_tests` |
| Garment Tests | Final product testing | `garment_physical_tests` |
| Test Templates | Reusable test configurations | `test_templates` |
| Testing Labs | Lab and equipment management | `testing_labs` |
| Inspections | AQL-based quality inspections | `inspections` |

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/fabricPhysicalTests.routes.ts` |
| Routes | `backend/src/routes/garmentPhysicalTests.routes.ts` |
| Routes | `backend/src/routes/testingLabs.routes.ts` |
| Routes | `backend/src/routes/testTemplates.routes.ts` |
| Controller | `backend/src/controllers/fabricPhysicalTests.controller.ts` |
| Controller | `backend/src/controllers/garmentPhysicalTests.controller.ts` |
| Pages | `frontend/src/pages/FabricPhysicalTests.tsx` |
| Pages | `frontend/src/pages/GarmentPhysicalTests.tsx` |
| Pages | `frontend/src/pages/TestTemplateForm.tsx` |
| Pages | `frontend/src/pages/TestingLabsList.tsx` |

### Quality Control Flow

```
Raw Material Inspection → In-Process QC → Final Inspection → Pre-Shipment Audit
        ↓                      ↓                 ↓                    ↓
   Fabric Tests          Stitching QC      Garment Tests        AQL Sampling
```

---

## 2. Quality Control Stages

### Stage 1: Incoming Material Inspection

**When:** Upon receipt of fabric and trims
**What:** Verify specifications match purchase order

| Check | Parameters |
|-------|------------|
| Fabric | GSM, width, color, composition, defects |
| Trims | Count, color, size, functionality |
| Labels | Print quality, content accuracy |
| Packaging | Quantity, condition |

### Stage 2: Pre-Production QC

**When:** Before cutting begins
**What:** Verify fabric quality and prepare cutting

| Check | Parameters |
|-------|------------|
| Fabric Relaxation | Shrinkage stabilization |
| Shade Matching | Color consistency across rolls |
| Defect Mapping | Mark defects for cutting avoidance |
| Spreading QC | Layer count, alignment, tension |

### Stage 3: In-Process QC

**When:** During production stages
**What:** Monitor quality at each stage

| Stage | Key Checks |
|-------|------------|
| Cutting | Pattern accuracy, notches, bundling |
| Stitching | Seam quality, measurements, construction |
| Finishing | Pressing, button attachment, final details |

### Stage 4: Final Inspection

**When:** After garment completion
**What:** Comprehensive quality check

| Check | Parameters |
|-------|------------|
| Measurements | All points per size chart |
| Construction | Seams, stitches, attachments |
| Appearance | Color, finish, symmetry |
| Functionality | Zippers, buttons, closures |
| Labeling | Correct labels, placement |

### Stage 5: Pre-Shipment Audit

**When:** Before dispatch
**What:** Final sampling-based verification

| Check | Parameters |
|-------|------------|
| AQL Sampling | Per customer requirements |
| Packing | Correct folding, poly bags, cartons |
| Documentation | Labels, tags, hangers |

---

## 3. Fabric Physical Tests (FPT)

### Purpose
Test physical properties of fabric to ensure quality standards.

### Database Model: `fabric_physical_tests`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| testNumber | String | Auto-generated (FPT-YYYY-NNNNN) |
| fabricId | UUID | Fabric being tested |
| fabricStockId | UUID | Specific stock lot (optional) |
| templateId | UUID | Test template used |
| labId | UUID | Testing lab |
| testDate | DateTime | Date of test |
| testedBy | UUID | Technician |
| status | Enum | PENDING, IN_PROGRESS, COMPLETED, FAILED |
| overallResult | Enum | PASS, FAIL, CONDITIONAL |
| remarks | String | Test observations |

### Test Parameters: `fabric_test_parameters`

| Field | Type | Description |
|-------|------|-------------|
| testId | UUID | Parent test |
| parameterName | String | Test parameter name |
| standardValue | String | Expected value |
| actualValue | String | Measured value |
| tolerance | String | Acceptable range |
| unit | String | Unit of measure |
| result | Enum | PASS, FAIL |
| remarks | String | Parameter notes |

### Common Fabric Tests

| Test | Unit | Standard | Purpose |
|------|------|----------|---------|
| GSM | g/m² | Per spec ±5% | Weight verification |
| Width | cm/inches | Per spec ±1" | Dimension verification |
| Shrinkage | % | Max 3-5% | Dimensional stability |
| Color Fastness (Wash) | Grade 1-5 | Min 4 | Wash durability |
| Color Fastness (Light) | Grade 1-8 | Min 4 | Light durability |
| Color Fastness (Rubbing) | Grade 1-5 | Min 4 | Rub durability |
| Pilling | Grade 1-5 | Min 3 | Surface quality |
| Tensile Strength | N/kg | Per fabric type | Strength |
| Tear Strength | N | Per fabric type | Tear resistance |
| Seam Slippage | mm | Max 6mm | Seam stability |
| pH Value | pH | 4.0-7.5 | Skin safety |

### API Endpoints

```
POST   /api/fabric-physical-tests           - Create test
GET    /api/fabric-physical-tests           - List all tests
GET    /api/fabric-physical-tests/:id       - Get test details
PUT    /api/fabric-physical-tests/:id       - Update test
DELETE /api/fabric-physical-tests/:id       - Delete test (pending only)
POST   /api/fabric-physical-tests/:id/start - Start testing
POST   /api/fabric-physical-tests/:id/complete - Complete test
GET    /api/fabric-physical-tests/by-fabric/:fabricId - Tests by fabric
GET    /api/fabric-physical-tests/pending   - Pending tests
GET    /api/fabric-physical-tests/failed    - Failed tests
```

### Test Workflow

```
Create Test Request → Assign Lab → Conduct Tests → Record Results → Generate Report
         ↓                                              ↓
    Select Template                              Pass/Fail Decision
         ↓                                              ↓
    Prepare Samples                           Corrective Action (if fail)
```

---

## 4. Garment Physical Tests (GPT)

### Purpose
Test completed garments for quality and compliance.

### Database Model: `garment_physical_tests`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| testNumber | String | Auto-generated (GPT-YYYY-NNNNN) |
| styleId | UUID | Style being tested |
| orderId | UUID | Order reference (optional) |
| workOrderId | UUID | Production batch |
| templateId | UUID | Test template used |
| labId | UUID | Testing lab |
| sampleSize | Int | Number of samples tested |
| testDate | DateTime | Date of test |
| testedBy | UUID | Technician |
| status | Enum | PENDING, IN_PROGRESS, COMPLETED, FAILED |
| overallResult | Enum | PASS, FAIL, CONDITIONAL |
| remarks | String | Test observations |

### Garment Test Parameters: `garment_test_parameters`

| Field | Type | Description |
|-------|------|-------------|
| testId | UUID | Parent test |
| parameterName | String | Test parameter name |
| standardValue | String | Expected value |
| actualValue | String | Measured value |
| tolerance | String | Acceptable range |
| unit | String | Unit of measure |
| result | Enum | PASS, FAIL |
| remarks | String | Parameter notes |

### Common Garment Tests

| Test | Unit | Standard | Purpose |
|------|------|----------|---------|
| Measurements | cm | Per size chart ±tolerance | Fit verification |
| Stitches Per Inch (SPI) | count | Per spec (10-14 typical) | Stitch quality |
| Seam Strength | kg/N | Per seam type | Construction |
| Button Pull | kg | Min 4 kg | Button security |
| Zipper Strength | kg | Per zipper type | Zipper durability |
| Snap Strength | kg | Min 4 kg | Snap security |
| Care Label Durability | washes | Min 25 washes | Label quality |
| Appearance After Wash | Grade | Min Grade 4 | Wash durability |
| Shrinkage After Wash | % | Max 3-5% | Size stability |
| Colorfastness After Wash | Grade | Min Grade 4 | Color stability |

### API Endpoints

```
POST   /api/garment-physical-tests           - Create test
GET    /api/garment-physical-tests           - List all tests
GET    /api/garment-physical-tests/:id       - Get test details
PUT    /api/garment-physical-tests/:id       - Update test
DELETE /api/garment-physical-tests/:id       - Delete test (pending only)
POST   /api/garment-physical-tests/:id/start - Start testing
POST   /api/garment-physical-tests/:id/complete - Complete test
GET    /api/garment-physical-tests/by-style/:styleId - Tests by style
GET    /api/garment-physical-tests/by-order/:orderId - Tests by order
GET    /api/garment-physical-tests/pending   - Pending tests
GET    /api/garment-physical-tests/failed    - Failed tests
```

---

## 5. Testing Labs Management

### Purpose
Manage internal and external testing laboratories.

### Database Model: `testing_labs`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Lab name |
| code | String | Short code |
| type | Enum | INTERNAL, EXTERNAL, THIRD_PARTY |
| accreditation | String | Accreditation body (e.g., NABL) |
| accreditationNumber | String | Certificate number |
| accreditationExpiry | DateTime | Expiry date |
| contactPerson | String | Lab contact |
| email | String | Contact email |
| phone | String | Contact phone |
| address | String | Lab address |
| capabilities | String[] | Test types supported |
| isActive | Boolean | Active status |

### Lab Types

| Type | Description | Use Case |
|------|-------------|----------|
| INTERNAL | Company's own lab | Routine testing |
| EXTERNAL | Third-party lab | Specialized tests |
| THIRD_PARTY | Independent certification | Compliance testing |

### Lab Equipment: `lab_equipment`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| labId | UUID | Parent lab |
| name | String | Equipment name |
| model | String | Model number |
| manufacturer | String | Equipment maker |
| serialNumber | String | Serial number |
| calibrationDate | DateTime | Last calibration |
| nextCalibrationDue | DateTime | Next calibration due |
| status | Enum | ACTIVE, MAINTENANCE, OUT_OF_SERVICE |

### API Endpoints

```
# Labs
POST   /api/testing-labs           - Create lab
GET    /api/testing-labs           - List all labs
GET    /api/testing-labs/:id       - Get lab details
PUT    /api/testing-labs/:id       - Update lab
DELETE /api/testing-labs/:id       - Delete lab
GET    /api/testing-labs/active    - Active labs
GET    /api/testing-labs/by-type/:type - Labs by type

# Equipment
POST   /api/lab-equipment          - Add equipment
GET    /api/lab-equipment          - List equipment
PUT    /api/lab-equipment/:id      - Update equipment
GET    /api/lab-equipment/calibration-due - Due for calibration
```

---

## 6. Test Templates

### Purpose
Create reusable test configurations with standard parameters.

### Database Model: `test_templates`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Template name |
| code | String | Short code |
| type | Enum | FABRIC, GARMENT |
| category | String | Product category |
| description | String | Template description |
| isActive | Boolean | Active status |
| version | Int | Template version |
| createdBy | UUID | Creator |

### Template Parameters: `test_template_parameters`

| Field | Type | Description |
|-------|------|-------------|
| templateId | UUID | Parent template |
| parameterName | String | Parameter name |
| standardValue | String | Default expected value |
| tolerance | String | Default tolerance |
| unit | String | Unit of measure |
| testMethod | String | Testing method/standard |
| isMandatory | Boolean | Required parameter |
| displayOrder | Int | Display sequence |

### Sample Templates

**Template: Cotton Woven Fabric**
| Parameter | Standard | Tolerance | Method |
|-----------|----------|-----------|--------|
| GSM | Per spec | ±5% | ASTM D3776 |
| Width | Per spec | ±1" | ASTM D3774 |
| Shrinkage (Warp) | Max 3% | - | AATCC 135 |
| Shrinkage (Weft) | Max 3% | - | AATCC 135 |
| Color Fastness (Wash) | Grade 4 | Min | AATCC 61 |
| Tensile Strength (Warp) | 200N | Min | ASTM D5034 |

**Template: Knit T-Shirt**
| Parameter | Standard | Tolerance | Method |
|-----------|----------|-----------|--------|
| Chest Width | Per size | ±1cm | Measurement |
| Body Length | Per size | ±1.5cm | Measurement |
| SPI | 12 | ±1 | Visual count |
| Button Pull | 4 kg | Min | Pull test |
| Shrinkage After Wash | 3% | Max | AATCC 135 |

### API Endpoints

```
POST   /api/test-templates           - Create template
GET    /api/test-templates           - List all templates
GET    /api/test-templates/:id       - Get template details
PUT    /api/test-templates/:id       - Update template
DELETE /api/test-templates/:id       - Delete template
GET    /api/test-templates/by-type/:type - Templates by type
GET    /api/test-templates/active    - Active templates
POST   /api/test-templates/:id/clone - Clone template
```

---

## 7. AQL-Based Inspection

### What is AQL?

**AQL (Acceptable Quality Level)** is a statistical sampling method to determine acceptable defect levels in a production batch.

### AQL Levels

| AQL Level | Defect Rate | Use Case |
|-----------|-------------|----------|
| 0.065 | 0.065% | Critical defects (safety) |
| 0.10 | 0.1% | High-end/luxury products |
| 0.65 | 0.65% | Premium retail |
| 1.0 | 1% | Standard retail |
| 1.5 | 1.5% | Export standard |
| 2.5 | 2.5% | Commercial grade |
| 4.0 | 4% | Economy products |

### Inspection Levels

| Level | Sample Size | Use Case |
|-------|-------------|----------|
| S-1 | Smallest | Reduced inspection |
| S-2 | Small | Light inspection |
| S-3 | Medium | Normal reduced |
| S-4 | Large | Special inspection |
| Level I | Reduced | Supplier with good history |
| Level II | Normal | Standard inspection |
| Level III | Tightened | New supplier or issues |

### Sample Size Table (Level II, Normal)

| Lot Size | Sample Size | AQL 1.5 Accept/Reject | AQL 2.5 Accept/Reject |
|----------|-------------|----------------------|----------------------|
| 2-8 | 2 | 0/1 | 0/1 |
| 9-15 | 3 | 0/1 | 0/1 |
| 16-25 | 5 | 0/1 | 0/1 |
| 26-50 | 8 | 0/1 | 0/1 |
| 51-90 | 13 | 0/1 | 1/2 |
| 91-150 | 20 | 1/2 | 1/2 |
| 151-280 | 32 | 1/2 | 2/3 |
| 281-500 | 50 | 2/3 | 3/4 |
| 501-1200 | 80 | 3/4 | 5/6 |
| 1201-3200 | 125 | 5/6 | 7/8 |
| 3201-10000 | 200 | 7/8 | 10/11 |

### Database Model: `inspections`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| inspectionNumber | String | Auto-generated |
| type | Enum | INCOMING, IN_PROCESS, FINAL, PRE_SHIPMENT |
| referenceType | String | Order, WorkOrder, GRN |
| referenceId | UUID | Reference document |
| lotSize | Int | Total quantity in lot |
| sampleSize | Int | Sample quantity |
| aqlLevel | Decimal | AQL level used |
| inspectionLevel | String | I, II, III |
| acceptNumber | Int | Max defects to accept |
| rejectNumber | Int | Defects to reject |
| defectsFound | Int | Actual defects found |
| result | Enum | ACCEPT, REJECT |
| inspectedBy | UUID | Inspector |
| inspectedAt | DateTime | Inspection date |

### Defect Classification

| Category | Definition | Impact |
|----------|------------|--------|
| Critical | Safety hazard, unusable | Immediate reject |
| Major | Significant defect | Counted for AQL |
| Minor | Small imperfection | 3 minor = 1 major |

### Common Defects

**Critical Defects:**
- Sharp objects (needles, pins)
- Toxic substances
- Structural failure risk

**Major Defects:**
- Wrong measurements (>1.5cm)
- Missing components
- Visible stains
- Open seams
- Wrong color/shade

**Minor Defects:**
- Loose threads
- Small stitch irregularities
- Slight shade variation
- Minor measurement variation

### API Endpoints

```
POST   /api/inspections              - Create inspection
GET    /api/inspections              - List inspections
GET    /api/inspections/:id          - Get inspection details
PUT    /api/inspections/:id          - Update inspection
POST   /api/inspections/:id/complete - Complete inspection
GET    /api/inspections/by-type/:type - By inspection type
GET    /api/inspections/by-reference/:type/:id - By reference
GET    /api/inspections/failed       - Failed inspections
GET    /api/inspections/calculate-sample - Calculate sample size
```

---

## 8. API Reference

### Complete Endpoint Summary

| Module | Endpoints | Methods |
|--------|-----------|---------|
| Fabric Physical Tests | 10 | GET, POST, PUT, DELETE |
| Garment Physical Tests | 10 | GET, POST, PUT, DELETE |
| Testing Labs | 8 | GET, POST, PUT, DELETE |
| Lab Equipment | 5 | GET, POST, PUT |
| Test Templates | 8 | GET, POST, PUT, DELETE |
| Inspections | 8 | GET, POST, PUT |

### Common Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | Int | Page number |
| limit | Int | Items per page |
| status | String | Filter by status |
| result | String | Filter by result (PASS/FAIL) |
| fromDate | Date | Date range start |
| toDate | Date | Date range end |
| labId | UUID | Filter by lab |

### Response Format

All endpoints return:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

---

## 9. Troubleshooting

### Test Results Not Saving

**Cause:** Missing mandatory parameters
**Solution:**
- Ensure all mandatory test parameters have values
- Check parameter data types match expected format

### Lab Not Available for Test

**Cause:** Lab inactive or accreditation expired
**Solution:**
- Check lab status in Testing Labs list
- Verify accreditation is current
- Update accreditation details if renewed

### Template Not Appearing

**Cause:** Template inactive or wrong type selected
**Solution:**
- Check template status is ACTIVE
- Verify type matches (FABRIC vs GARMENT)
- Check category matches product

### AQL Calculation Issues

**Cause:** Invalid lot size or AQL level
**Solution:**
- Verify lot size is accurate
- Confirm AQL level matches customer requirements
- Use standard inspection level (II) unless specified

### Equipment Calibration Alert

**Cause:** Calibration overdue
**Solution:**
- Schedule immediate recalibration
- Do not use equipment until calibrated
- Mark equipment as OUT_OF_SERVICE if critical

---

## Best Practices

### Testing

1. **Always use templates** - Ensures consistent testing across batches
2. **Document deviations** - Note any variations from standard procedures
3. **Retain samples** - Keep tested samples for reference
4. **Calibrate regularly** - Equipment calibration is critical

### Inspections

1. **Random sampling** - Use truly random selection methods
2. **Trained inspectors** - Ensure inspectors are qualified
3. **Clear defect criteria** - Define defects before inspection
4. **Document all defects** - Even if batch passes

### Quality Records

1. **Maintain traceability** - Link tests to production batches
2. **Archive reports** - Keep records per retention policy
3. **Trend analysis** - Review patterns in failures
4. **Corrective actions** - Document and track improvements

---

## Related Documentation

- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview
- [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) - Production workflow
- [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md) - Inventory management
- [GLOSSARY.md](GLOSSARY.md) - AQL and quality terminology

---

**Maintained By:** Kashaya Fabs Development Team
