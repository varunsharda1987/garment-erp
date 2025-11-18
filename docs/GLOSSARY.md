# Garment ERP Glossary

## Manufacturing Terms

### CMT - Cut, Make, Trim
The three main production processes in garment manufacturing:
- **Cutting**: Fabric cutting according to patterns
- **Making**: Stitching and assembly of garment pieces
- **Trimming**: Finishing touches, button attachment, quality checks

### Greige (Gray Fabric)
Unfinished fabric before dyeing, printing, or other finishing treatments. Also called "gray goods" or "loomstate fabric."

### GSM - Grams per Square Meter
Standard measurement for fabric weight. Higher GSM = heavier fabric.
- Light fabric: 130-200 GSM (summer wear)
- Medium fabric: 200-280 GSM (all-season)
- Heavy fabric: 280+ GSM (winter wear, denim)

### CAD Average
Computer-Aided Design average - the average fabric consumption per garment calculated using pattern-making software. Includes:
- Pattern pieces
- Fabric width utilization
- Marker efficiency
- Wastage considerations

### Value Loss
Material wastage during production due to:
- Cutting losses (fabric selvage, pattern inefficiency)
- Defects and damages
- Sample production
- Quality rejections
**Default:** 2% in this system

### Markup
Profit margin added to the total cost to determine selling price.
**Formula:** Final Price = Total Cost × (1 + Markup %)
**Default:** 15% in this system

---

## Business Concepts

### Style
A reusable design template representing a specific garment design. Contains:
- Technical specifications
- Fabric and trim requirements
- Construction details
- Process specifications
- Standard measurements

**Key Point:** One style can be ordered multiple times by different customers.

### Order
A customer purchase order for specific quantities of one or more styles. Contains:
- Customer information
- Style references
- Color × Size breakdown matrix
- Delivery requirements
- Pricing and payment terms

### BOM - Bill of Materials
Detailed breakdown of all materials required to produce one unit of a style. Includes:
- Fabric consumption with wastage
- Trims (buttons, zippers, labels, etc.)
- Accessories (hangers, packaging, etc.)
- Quantity per piece
- Cost per item

**Workflow Position:** Created AFTER Cost Sheet approval

### Cost Sheet (Costing)
Pre-order budget estimate including all cost components:
- Material costs (fabric, trims, accessories)
- CMT costs (cutting, stitching, finishing)
- Embroidery/printing costs
- Value loss adjustment
- Markup percentage
- Final product cost

**Workflow Position:** Approved BEFORE creating BOM or accepting orders

**Business Logic:** Cost Sheet acts as the approved budget. The actual BOM should not exceed the Cost Sheet material budget.

---

## Material Categories

### 1. Fabric
Main body material of the garment.
**Specifications:** Type, composition, GSM, width, color, finish

### 2. Trim
Supporting materials that enhance functionality or aesthetics:
- Buttons
- Zippers
- Hook & eyes
- Elastic
- Velcro
- Snaps

### 3. Thread
Sewing threads in various colors and types (polyester, cotton, nylon)

### 4. Interlining
Support fabric placed between garment layers for structure and stability

### 5. Label
Brand identification and care instruction tags:
- Main label (brand)
- Care label (washing instructions)
- Size label
- Barcode label

### 6. Packaging
Materials for finished product packaging:
- Polybags
- Boxes/cartons
- Hangers
- Price tags
- Tissue paper

### 7. Accessories
Additional decorative or functional elements:
- Embellishments (sequins, beads)
- Appliqués
- Patches
- Heat transfers

---

## Production Stages

### 1. Pattern Making
Creating paper or digital patterns for all garment pieces

### 2. Fabric Inspection
Checking fabric quality before cutting (defects, color consistency, GSM)

### 3. Fabric Spreading
Laying multiple fabric layers for efficient cutting

### 4. Cutting
Cutting fabric according to markers/patterns

### 5. Bundling
Grouping cut pieces for assembly line distribution

### 6. Sewing/Stitching
Assembling garment pieces using sewing machines

### 7. Finishing
Final operations:
- Button attachment
- Hemming
- Pressing/ironing
- Quality inspection

### 8. Washing (if applicable)
Stone wash, enzyme wash, or other fabric treatments

### 9. Quality Control (QC)
Final inspection before packaging:
- Measurement check
- Stitch quality
- Defect detection

### 10. Packing
Folding, bagging, and boxing for shipment

---

## Supplier Categories

### 1. Fabric Supplier
Provides main garment materials (woven, knit, non-woven)

### 2. Trim Supplier
Supplies buttons, zippers, and other functional trims

### 3. Thread Supplier
Provides sewing threads

### 4. Interlining Supplier
Supplies fusible and non-fusible interlinings

### 5. Label Supplier
Prints and supplies various labels

### 6. Packaging Supplier
Provides polybags, boxes, hangers, and packaging materials

### 7. Accessories Supplier
Supplies embellishments, patches, and decorative elements

---

## Measurement & Quality Terms

### AQL - Acceptable Quality Level
Statistical measure for quality inspection. Defines maximum number of defects acceptable in a production batch.
**Common AQL levels:**
- AQL 1.5: High quality (export standards)
- AQL 2.5: Standard quality
- AQL 4.0: Commercial quality

### Tolerance
Acceptable variation from standard measurements.
**Example:** Chest width = 100cm ± 1cm (tolerance)

### Defect Categories
- **Critical**: Makes garment unwearable (safety issues)
- **Major**: Significantly affects appearance/function
- **Minor**: Small imperfections not affecting wearability

---

## Business Workflow

### Pre-Order Workflow
1. **Customer Inquiry** → Requirement discussion
2. **Sample Development** → Create sample garment
3. **Costing** → Prepare Cost Sheet with all estimates
4. **Cost Sheet Approval** → Internal approval of budget
5. **Price Quotation** → Send quote to customer
6. **Order Confirmation** → Customer places order

### Production Workflow
1. **Order Entry** → Create order in system
2. **BOM Creation** → Detail material requirements (must not exceed Cost Sheet budget)
3. **Material Procurement** → Purchase Orders to suppliers
4. **Production Planning** → Schedule and assign work orders
5. **Production Execution** → Cut, make, trim processes
6. **Quality Inspection** → AQL-based QC
7. **Packing & Shipment** → Prepare for delivery

### Post-Production
1. **Dispatch** → Ship to customer
2. **Invoice** → Billing
3. **Payment Collection** → Accounts receivable
4. **Feedback** → Customer satisfaction tracking

---

## Financial Terms

### FOB - Free On Board
Pricing term where seller covers costs until goods are loaded on ship. Buyer pays shipping costs.

### Ex-Factory Price
Price quoted at factory gate. Buyer arranges and pays for all transportation.

### LC - Letter of Credit
Bank guarantee for payment (used in international trade)

### Payment Terms Examples
- **Advance**: 30% advance, 70% before shipment
- **Against Documents**: Payment on receiving shipping documents
- **Net 30**: Payment due 30 days after invoice date

---

## Technical Abbreviations

- **SKU**: Stock Keeping Unit (unique product identifier)
- **MOQ**: Minimum Order Quantity
- **ETA**: Estimated Time of Arrival
- **ETD**: Estimated Time of Departure
- **OTD**: On-Time Delivery
- **WIP**: Work In Progress
- **FG**: Finished Goods
- **RM**: Raw Material
- **GRN**: Goods Receiving Note
- **PO**: Purchase Order
- **SO**: Sales Order
- **QC**: Quality Control
- **QA**: Quality Assurance

---

## Inventory & Warehouse Terms **NEW**

### Batch/Lot Tracking
System for tracking materials by production batch or supplier lot number. Enables quality traceability, expiry date management, FIFO enforcement, and recall management.

### Bin Location
Specific physical location within a warehouse where materials are stored.
**Format Example:** WH1-A-01-03 = Warehouse 1, Aisle A, Rack 01, Shelf 03

### FEFO - First Expired, First Out
Inventory rotation method where items closest to expiry date are used first (for perishable/time-sensitive materials)

### FIFO - First In, First Out
Inventory rotation method where oldest stock is used first (prevents aging)

### LIFO - Last In, First Out
Inventory rotation method where newest stock is used first (less common in garment industry)

### Reorder Level
Minimum stock quantity that triggers automatic purchase requisition.
**Formula:** Reorder Level = (Lead Time × Daily Usage) + Safety Stock

### Safety Stock
Buffer inventory maintained to prevent stockouts due to demand fluctuations or supply delays

### Stock Adjustment
Inventory correction due to physical count variance, damage, theft, returns, or expired materials

### Storage Capacity
Maximum weight or volume that a storage bin/rack can hold

### UOM - Unit of Measure
Standard unit for measuring materials (meters, kg, pieces, dozens, etc.)

### UOM Conversion
Conversion between different units of measure (e.g., 1 meter = 1.0936 yards, fabric meters to kg based on GSM)

---

## Production & Operations Terms **NEW**

### Bottleneck
Production stage or machine that limits overall throughput (slowest stage determines total capacity)

### Capacity Planning
Process of determining production capacity needed to meet demand (considers machines, hours, skills, materials)

### Machine Efficiency
Percentage of actual output vs. theoretical maximum output.
**Formula:** (Actual Output / Maximum Capacity) × 100

### Operation
Single step in production process with defined standard time (SAM), skill level, and machine type

### Production Calendar
Working days configuration including public holidays, weekends, and seasonal shutdowns

### Production Floor
Physical area where manufacturing takes place (may have multiple production lines)

### Production Line
Group of machines and workers organized to manufacture garments through sequential operations

### SAM - Standard Allowed Minutes
Time required to complete one operation under normal conditions

### Shift
Defined work period with start/end time, breaks, and shift type (day/night/general)

### Work Order
Manufacturing instruction to produce specific quantity of a style with line assignment and target date

---

## Sales & Logistics Terms **NEW**

### Agent/Broker
Intermediary who facilitates sales between buyer and seller, earning commission (buying agent, commission agent, or independent broker)

### AWB - Air Waybill
Shipping document for air freight, serves as receipt and contract of carriage

### Bill of Lading (BL)
Shipping document for sea freight, legal document of ownership

### CIF - Cost, Insurance, Freight
Incoterm where seller pays for shipping and insurance to destination port

### DDP - Delivered Duty Paid
Incoterm where seller pays all costs including customs duties and taxes at destination

### EXW - Ex Works
Incoterm where buyer takes responsibility at seller's factory gate (minimum seller obligation)

### Freight Forwarder
Company that arranges transportation and documentation for shipments (air/sea/road/multimodal)

### Incoterms
International Commercial Terms defining responsibilities of buyers and sellers (EXW, FOB, CIF, DDP, DAP)

### Sales Territory
Geographic area assigned to a salesperson or team for revenue targeting and customer management

### Shipping Carrier
Company providing transportation services (DHL, FedEx, BlueDart, Maersk, etc.)

---

## Quality Management Terms **NEW**

### Critical Defect
Defect that makes garment unsafe to wear or completely unusable (sharp objects, toxic residue, structural failure)

### Defect Code
Standardized code for categorizing quality defects (ST-01: Skipped stitch, MS-02: Measurement error, etc.)

### Inspection Level
Sampling intensity for AQL inspection (Level I = least strict, Level III = most strict)

### Major Defect
Defect significantly affecting appearance, function, or salability (wrong color, missing buttons, measurement errors >1.5cm)

### Minor Defect
Small imperfection not affecting wearability (loose threads, slight shade variation, small stitch irregularity)

### Quality Checkpoint
Defined inspection point in production (raw material arrival, cutting, stitching, finishing, packing)

### Sample Size (AQL)
Number of pieces to inspect from a lot, determined by AQL table based on lot size and inspection level

### Testing Parameter
Specific quality characteristic to be measured (fabric: GSM, shrinkage, color fastness; garment: seam strength, button pull force)

---

## Human Resources Terms **NEW**

### Department
Organizational unit grouping employees by function (Production, Sales, Accounts, Quality, Purchase, HR, Admin)

### Department Hierarchy
Multi-level organizational structure where departments have parent-child relationships

### Designation
Job title/position with defined responsibility level, salary range, reporting hierarchy, and qualifications

### Employee
Individual working for the company, tracked with code, personal details, department, designation, and skills

### Reporting Manager
Supervisor to whom an employee reports directly in organizational hierarchy

### Shift Roster
Schedule assigning employees to specific shifts on specific dates (fixed, rotating, or custom)

---

## PLM & Product Development Terms **NEW**

### Approval Workflow
Multi-level approval process for critical documents (Cost Sheet, BOM, Samples, Purchase Orders)
**Typical Levels:** L1 Creator, L2 Manager, L3 Director

### Collection
Group of related styles developed for a specific season or theme (e.g., "Spring/Summer 2026 Ethnic Collection")

### PLM - Product Lifecycle Management
End-to-end management of a product from concept → design → development → production → end-of-life

### Sample
Physical garment prototype created during development (Development, Sales, Approval, or Production sample)

### Season
Time period for which a collection is designed (Spring/Summer, Fall/Winter, Holiday, etc.)

### Tech Pack
Technical specification document with sketches, measurement chart, construction details, materials, and packaging

---

## Compliance & Documentation Terms **NEW**

### Audit Trail
Complete record of all changes to data including who, when, and what was changed

### Certification
Official document verifying compliance with standards (GOTS, Oeko-Tex, ISO 9001, ISO 14001)

### Document Retention
Policy defining how long documents must be kept (varies by document type and legal requirements)

### Document Type
Category of document with defined retention period and access level (Compliance, Quality, Legal, Export, Contract)

### GOTS - Global Organic Textile Standard
Certification for organic textiles covering organic processing, environmental criteria, and social criteria

### Oeko-Tex
Independent testing and certification for harmful substances in textiles

### Regulatory Requirement
Legal requirement for compliance (labeling, testing, documentation) - varies by country/region

### Traceability
Ability to track a product's journey from raw material source to final customer

---

## Maintenance Management Terms **NEW**

### Breakdown
Unexpected machine failure stopping production (tracked with reason, downtime, cost, spare parts)

### Corrective Maintenance
Repair work performed AFTER a machine breaks down (reactive)

### Downtime
Period when machine is not operational (breakdown, maintenance, setup, or idle)

### MTBF - Mean Time Between Failures
Average time between machine breakdowns. Higher MTBF = more reliable machine.
**Formula:** Total Uptime / Number of Failures

### MTTR - Mean Time To Repair
Average time to repair a machine after breakdown. Lower MTTR = faster repairs.
**Formula:** Total Repair Time / Number of Repairs

### Preventive Maintenance (PM)
Scheduled maintenance performed regularly to prevent breakdowns (daily, weekly, monthly, quarterly, annual)

### Spare Parts
Replacement components kept in inventory for machine maintenance and repairs

---

## Global Master Terms **NEW**

### Color Family
Grouping of related colors for easier management (Red, Blue, Neutral, Pastel families)

### Color Master
Centralized database of all colors with unique code, standard name, Pantone reference, RGB/HEX values, and swatch image

### Measurement Chart
Size-wise table of garment measurements (chest, waist, hip, length, sleeve, etc.)

### Pantone
Standardized color matching system used worldwide (e.g., Pantone 18-1664 TPX = Viva Magenta)

### Sequence/Numbering
Auto-generated code format configuration (STY-2026-00001, ORD/2026/JAN/0001, INV-2026-00123)

### Size Chart
Standardized size definitions with measurements for a specific size system (US, UK, EU, Free Size)

### Size Master
Centralized database of all sizes with unique code, size name, size system, category, and measurement chart reference

### Size System
Standardized sizing convention (US: 0/2/4/6, UK: 6/8/10/12, EU: 34/36/38/40, Free Size)

---

**Total Terms:** 180+
**Last Updated:** November 15, 2025
**Maintained By:** Kashaya Fabs Development Team

**Coverage:** All current modules (Phases 0-5.X) + All planned phases (1.5, 2-11)
**Note:** Terms marked **NEW** are from upcoming phases and will be implemented as those phases are developed
