# StyleForm Guide

> **Complete Reference for Style Creation Workflow**
> **Last Updated:** January 13, 2026
> **Main Component:** `frontend/src/pages/StyleFormRedesigned.tsx` (2,167 lines)

---

## Table of Contents

1. [Overview](#overview)
2. [4-Tab Workflow](#4-tab-workflow)
3. [Current Implementation](#current-implementation)
4. [Key Features](#key-features)
5. [State Management](#state-management)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [AI Enhancement Options](#ai-enhancement-options)
8. [Critical Files Reference](#critical-files-reference)

---

## Overview

StyleForm is the primary interface for creating and editing garment styles in the Kashaya Fabs ERP system. It handles:

- **45+ form fields** across 4 tabs
- **Customer-specific presets** for accessories and sizes
- **Product category-driven component suggestions**
- **Integration with** CAD Planning, BOM/Costing, Variants, and Components

### StyleForm Scope

| Area | Count | Details |
|------|-------|---------|
| Frontend Components | 10+ | StyleFormRedesigned.tsx + supporting selectors |
| Backend Services | 11 | Controllers, services, routes |
| Database Tables | 14 | Interconnected style-related tables |
| Form Fields | 45+ | Across 4 tabs |

---

## 4-Tab Workflow

### Tab 1: Basic Info
**Purpose:** Core style identification and customer linking

| Field | Description |
|-------|-------------|
| Customer | Links to customer master, populates brands/presets |
| Brand | Customer-specific brands from `brand_categories` |
| Brand Category | Category within the selected brand |
| Style Code/Name | Unique identifier and display name |
| Season | Seasonal categorization |
| Product Category | 3-level hierarchy (L1 → L2 → L3) |
| Components | Auto-suggested based on product category |
| Additional Details | Cost/MRP, HSN Code, Tax Rule, Image, Remarks |

### Tab 2: Fabrics
**Purpose:** Fabric selection per component with embroidery support

- **GenericFabricSelector** - Select generic fabric name per component
- **Fabric Finish Type** - DYED, PRINTED, YARN_DYED, RAW
- **EmbroiderySelector** - Optional embroidery attachment per fabric
- One fabric entry per component selected in Tab 1

### Tab 3: Trims & Materials
**Purpose:** Material BOM for trims

- **TrimSelector** - Unified selector for:
  - Buttons, Zippers, Lace, Thread
  - Elastic, Labels, Interlining
- Each trim linked to `style_material_bom` table

### Tab 4: Accessories
**Purpose:** Garment and packaging accessories

- **AccessorySelector** - Select from master accessories
- **Customer Presets** - Auto-populate from customer accessory presets
- Tracks preset vs. manually-added accessories separately

---

## Current Implementation

### Main Component Structure

```
StyleFormRedesigned.tsx (2,167 lines)
├── State Management (~200 lines)
│   ├── Basic Info state
│   ├── Component selection state
│   ├── Fabrics state (FabricEntry[])
│   ├── Trims state (StyleTrim[])
│   └── Accessories state (StyleAccessory[])
├── Data Loading (~400 lines)
│   ├── loadCustomers()
│   ├── loadComponentMasters()
│   ├── loadProductCategories()
│   ├── loadAccessoryPresets()
│   └── loadSizePresets()
├── Tab Renderers (~1000 lines)
│   ├── renderBasicInfoTab()
│   ├── renderFabricsTab()
│   ├── renderTrimsTab()
│   └── renderAccessoriesTab()
└── Form Submission (~200 lines)
    ├── handleSave()
    └── Data transformation
```

### Key Supporting Components

| Component | Purpose |
|-----------|---------|
| `GenericFabricSelector` | Searchable fabric name picker |
| `TrimSelector` | Unified trim material selection |
| `AccessorySelector` | Accessory picker with preset support |
| `EmbroiderySelector` | Embroidery design attachment |
| `CADGroupPreview` | Preview CAD groups for selected fabrics |

---

## Key Features

### 1. Customer Accessory Presets
When a customer is selected, their accessory presets auto-populate:
- Preset items tracked in `presetItemIds` Set
- Manually added items tracked in `styleSpecificIds` Set
- Allows distinguishing preset vs. custom accessories

### 2. Size Category Presets
Customer-specific size presets with label configurations:
- `customerSizePresets` - Available presets for customer
- `selectedSizePresetId` - Currently selected preset
- `pendingLabelConfigs` - Label configs to be saved after style creation

### 3. Product Category → Component Auto-Suggestion
When a product category is selected:
1. System fetches suggested components for that category
2. Components auto-populate based on category defaults
3. Fabrics tab auto-creates entries for each component

### 4. Restore Dialog for Deleted Styles
If user enters a style code that belongs to a deleted style:
- Shows restore dialog with style info
- Option to restore the deleted style
- Prevents style code conflicts

### 5. Edit Mode Guards
Special handling for edit mode to prevent state overwrites:
- `styleLoadedRef` - Prevents double-loading in React Strict Mode
- `initialLoadCompleteRef` - Prevents useEffects from overwriting loaded data
- `isEditMode` checks in dependent effects

---

## State Management

### Core State Variables

```typescript
// Tab 1: Basic Info
const [selectedCustomerId, setSelectedCustomerId] = useState('');
const [availableBrands, setAvailableBrands] = useState<string[]>([]);
const [availableCategories, setAvailableCategories] = useState<BrandCategory[]>([]);
const [brandName, setBrandName] = useState('');
const [brandCategoryId, setBrandCategoryId] = useState('');

// Product Category (3-level hierarchy)
const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
const [productSubCategories, setProductSubCategories] = useState<Record<string, ProductCategory[]>>({});
const [productSubSubCategories, setProductSubSubCategories] = useState<Record<string, ProductCategory[]>>({});
const [selectedProductCategoryL1, setSelectedProductCategoryL1] = useState('');
const [selectedProductCategoryL2, setSelectedProductCategoryL2] = useState('');
const [selectedProductCategoryL3, setSelectedProductCategoryL3] = useState('');

// Components
const [componentMasters, setComponentMasters] = useState<ComponentMaster[]>([]);
const [selectedComponents, setSelectedComponents] = useState<Array<{ category: string; componentId: string }>>([]);
const [categoryComponentIds, setCategoryComponentIds] = useState<Set<string>>(new Set());

// Tab 2: Fabrics
const [fabrics, setFabrics] = useState<FabricEntry[]>([]);

// Tab 3: Trims
const [selectedTrims, setSelectedTrims] = useState<StyleTrim[]>([]);

// Tab 4: Accessories
const [selectedAccessories, setSelectedAccessories] = useState<StyleAccessory[]>([]);
```

### Key Interfaces

```typescript
interface FabricEntry {
  id: string;
  componentIndex: number;
  componentName: string;
  genericGreigeName: string;
  fabricFinishType: FabricFinishType | '';
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  embroideryName?: string | null;
  embroideryCode?: string | null;
}

type FabricFinishType = 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW';
```

---

## Common Issues & Solutions

### Issue 1: Brand/Category Not Loading
**Symptom:** Brand dropdown empty or category not populating
**Cause:** Customer doesn't have `brand_categories` configured
**Solution:** Ensure customer has brand categories set up in Customer Master

### Issue 2: Components Not Auto-Populating
**Symptom:** Components don't auto-fill when product category selected
**Cause:** Product category doesn't have component suggestions configured
**Solution:** Configure `product_category_component_suggestions` for the category

### Issue 3: Edit Mode Losing Values
**Symptom:** Fields reset when editing existing style
**Cause:** useEffects running before initial data load completes
**Solution:** Check `initialLoadCompleteRef` guards are in place

### Issue 4: Style Code Conflict
**Symptom:** "Style code already exists" error
**Cause:** Code belongs to deleted style
**Solution:** Use restore dialog to recover deleted style or choose new code

---

## AI Enhancement Options

The following approaches can extend StyleForm with AI assistance. These are **future implementation options**, not currently implemented.

### Three Implementation Approaches

### Approach 1: AI-Assisted StyleForm Helper (Quick - 2-3 hours)

**Concept**: Extend existing AI Assistant with StyleForm-specific knowledge

**Implementation Steps**:

1. **Create StyleForm Knowledge Base** (`docs/ai-knowledge-base/styleform-guide.md`)
   ```markdown
   # StyleForm Creation Guide

   ## Workflow Overview
   - Tab 1: Basic Info (Customer, Brand, Category, Season)
   - Tab 2: Fabrics (Generic names, finish types, embroidery)
   - Tab 3: Trims & Materials (Buttons, zippers, threads, etc.)
   - Tab 4: Accessories (Garment & packaging)

   ## Common Issues & Solutions
   - Brand/Category not loading: Check customer has brand_categories
   - Fabric not saving: Ensure component is selected first
   - SKU generation failing: Verify size options are configured
   ```

2. **Add StyleForm System Prompt**
   ```typescript
   // backend/src/services/ai/system-prompts.ts (NEW)
   export const STYLEFORM_ASSISTANT_PROMPT = `
   You are a StyleForm Creation Assistant for Kashaya Fabs ERP.

   Expertise:
   - 4-tab workflow guidance
   - Fabric/trim recommendations
   - Validation troubleshooting
   - Best practices

   Context: {context}
   `;
   ```

3. **Enhance Context Service**
   ```typescript
   // backend/src/services/ai/erp-context.service.ts (ADD METHOD)
   private async fetchStyleFormContext(userId: string): Promise<string> {
     const recentStyles = await this.prisma.styles.findMany({
       where: { createdById: userId },
       take: 5,
       orderBy: { createdAt: 'desc' }
     });
     return formatStyleContext(recentStyles);
   }
   ```

4. **Add Help Button in UI**
   ```tsx
   // frontend/src/pages/StyleFormRedesigned.tsx (ADD)
   <Tooltip content="Get AI help">
     <Button
       variant="ghost"
       size="icon"
       onClick={() => router.push('/ai-assistant?context=styleform')}
     >
       <Sparkles className="h-4 w-4" />
     </Button>
   </Tooltip>
   ```

**Files to Create/Modify**:
- `docs/ai-knowledge-base/styleform-guide.md` (NEW)
- `backend/src/services/ai/system-prompts.ts` (NEW)
- `backend/src/services/ai/erp-context.service.ts` (MODIFY)
- `frontend/src/pages/StyleFormRedesigned.tsx` (MODIFY)

**Pros**: Fast, uses existing infrastructure, immediate value
**Cons**: Reactive only (user must ask), manual knowledge maintenance

---

### Approach 2: StyleForm Suggestion API (Recommended - 1-2 days)

**Concept**: Dedicated endpoints providing AI-powered suggestions during style creation

**Architecture**:
```
StyleForm UI → Suggestion API → AI Service → Historical Data + RAG
              ↓
         Live Suggestions Displayed
```

**Implementation Steps**:

1. **Create Style Suggestion Service**
   ```typescript
   // backend/src/services/ai/style-suggestion.service.ts (NEW)

   export class StyleSuggestionService {
     async suggestFabrics(params: {
       customer: string;
       brand: string;
       season: string;
       category: string;
     }): Promise<FabricSuggestion[]> {
       // Query historical styles with similar params
       const historicalStyles = await this.findSimilarStyles(params);

       // Get common fabric patterns
       const fabricPatterns = this.analyzeFabricPatterns(historicalStyles);

       // Generate AI suggestions
       const prompt = this.buildFabricSuggestionPrompt(params, fabricPatterns);
       const suggestions = await this.aiProvider.generateText(prompt);

       return this.parseFabricSuggestions(suggestions);
     }

     async suggestTrims(params: {
       fabrics: FabricSelection[];
       category: string;
     }): Promise<TrimSuggestion[]> {
       // Analyze selected fabrics
       // Recommend compatible trims
       // Consider industry standards
     }

     async validateStyle(style: StyleFormData): Promise<ValidationIssue[]> {
       // Check completeness
       // Validate combinations
       // Flag unusual patterns
     }

     async estimateCost(style: StyleFormData): Promise<CostEstimate> {
       // Calculate material costs
       // Add labor estimates
       // Compare to similar styles
     }
   }
   ```

2. **Create API Routes**
   ```typescript
   // backend/src/routes/ai-style.routes.ts (NEW)

   router.post('/suggest-fabrics',
     authenticateToken,
     validateBody(suggestFabricsSchema),
     aiStyleController.suggestFabrics
   );

   router.post('/suggest-trims',
     authenticateToken,
     validateBody(suggestTrimsSchema),
     aiStyleController.suggestTrims
   );

   router.post('/validate',
     authenticateToken,
     validateBody(validateStyleSchema),
     aiStyleController.validateStyle
   );

   router.post('/estimate-cost',
     authenticateToken,
     validateBody(estimateCostSchema),
     aiStyleController.estimateCost
   );
   ```

3. **Frontend Integration - Suggestion Panels**
   ```tsx
   // frontend/src/components/StyleForm/SuggestionPanel.tsx (NEW)

   export const FabricSuggestionPanel = ({ customer, brand, season, category }) => {
     const [suggestions, setSuggestions] = useState<FabricSuggestion[]>([]);
     const [loading, setLoading] = useState(false);

     const loadSuggestions = async () => {
       setLoading(true);
       const result = await aiStyleService.suggestFabrics({
         customer, brand, season, category
       });
       setSuggestions(result);
       setLoading(false);
     };

     return (
       <Card className="mt-4">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Sparkles className="h-5 w-5" />
             AI Fabric Suggestions
           </CardTitle>
         </CardHeader>
         <CardContent>
           {loading ? <Spinner /> : (
             <div className="space-y-2">
               {suggestions.map(sug => (
                 <SuggestionCard
                   key={sug.id}
                   fabric={sug}
                   onApply={() => handleApply(sug)}
                 />
               ))}
             </div>
           )}
         </CardContent>
       </Card>
     );
   };
   ```

4. **RAG Enhancement - Index Historical Styles**
   ```typescript
   // backend/src/services/ai/indexing.service.ts (MODIFY)

   async indexSuccessfulStyles() {
     // Find styles with completed orders
     const successfulStyles = await this.prisma.styles.findMany({
       where: {
         status: 'APPROVED',
         orders: { some: { status: 'COMPLETED' } }
       },
       include: {
         style_components: {
           include: { style_fabrics: true }
         },
         style_material_bom: true
       }
     });

     // Create embeddings
     for (const style of successfulStyles) {
       const document = this.formatStyleAsDocument(style);
       const embedding = await this.embeddingService.createEmbedding(document);

       await this.prisma.ai_embeddings.create({
         data: {
           documentId: style.id,
           documentType: 'STYLE',
           content: document,
           embedding,
           metadata: {
             customer: style.customerName,
             brand: style.brandName,
             season: style.season,
             category: style.category
           }
         }
       });
     }
   }
   ```

5. **Prompt Engineering Examples**
   ```typescript
   buildFabricSuggestionPrompt(params, patterns) {
     return `
   Based on the following context, suggest 3-5 suitable fabrics for a new style:

   **Customer**: ${params.customer}
   - Historical fabric preferences: ${patterns.customerFabrics.join(', ')}
   - Average order value: ${patterns.avgOrderValue}

   **Brand**: ${params.brand}
   - Typical fabric types: ${patterns.brandFabrics.join(', ')}
   - Quality tier: ${patterns.qualityTier}

   **Season**: ${params.season}
   - Suitable fabrics: ${patterns.seasonalFabrics.join(', ')}

   **Category**: ${params.category}
   - Standard fabrics: ${patterns.categoryFabrics.join(', ')}

   Consider:
   1. Customer's past satisfaction with similar fabrics
   2. Seasonal appropriateness (breathability, warmth)
   3. Brand positioning (premium, mid-range, budget)
   4. Industry best practices for this category

   Return JSON array with:
   {
     "fabricName": "string",
     "fabricType": "string",
     "finishType": "string",
     "reasoning": "string (2-3 sentences)",
     "confidence": "high|medium|low",
     "estimatedCost": "number"
   }
     `;
   }
   ```

**Files to Create**:
- `backend/src/services/ai/style-suggestion.service.ts` (NEW)
- `backend/src/routes/ai-style.routes.ts` (NEW)
- `backend/src/controllers/ai-style.controller.ts` (NEW)
- `backend/src/schemas/ai-style.schema.ts` (NEW)
- `frontend/src/components/StyleForm/SuggestionPanel.tsx` (NEW)
- `frontend/src/components/StyleForm/FabricSuggestionCard.tsx` (NEW)
- `frontend/src/components/StyleForm/TrimSuggestionPanel.tsx` (NEW)
- `frontend/src/services/ai-style.service.ts` (NEW)

**Files to Modify**:
- `frontend/src/pages/StyleFormRedesigned.tsx` (integrate suggestion panels)
- `backend/src/services/ai/indexing.service.ts` (add style indexing)
- `backend/src/routes/index.ts` (register new routes)

**Pros**: Proactive, learns from data, reduces errors, maintains user control
**Cons**: Requires tuning, depends on historical data quality

---

### Approach 3: Autonomous StyleForm Agent (Advanced - 3-5 days)

**Concept**: Self-sufficient AI agent that can make code-level changes to StyleForm

**Architecture**:
```
User Request → Agent Analyzer → Change Planner → Code Generator
                                       ↓
                              Safety Validator
                                       ↓
                              User Approval UI
                                       ↓
                              Apply Changes → Git PR
```

**Implementation Steps**:

1. **Agent Service Core**
   ```typescript
   // backend/src/services/agents/styleform-agent.service.ts (NEW)

   export class StyleFormAgent {
     private tools: AgentToolkit;
     private validator: ChangeValidator;
     private learner: PatternLearner;

     async processRequest(request: AgentRequest): Promise<AgentResponse> {
       // 1. Analyze request
       const analysis = await this.analyzeRequest(request);

       // 2. Plan changes
       const plan = await this.planChanges(analysis);

       // 3. Generate code
       const changes = await this.generateChanges(plan);

       // 4. Validate
       const validation = await this.validator.validate(changes);
       if (!validation.safe) {
         return { status: 'rejected', reason: validation.issues };
       }

       // 5. Return for approval
       return {
         status: 'pending_approval',
         changes,
         explanation: plan.explanation,
         affectedFiles: changes.map(c => c.filePath)
       };
     }

     async applyChanges(changeId: string, approved: boolean) {
       if (!approved) return;

       const changes = await this.getChanges(changeId);

       // Create git branch
       await this.git.createBranch(`styleform-agent/${changeId}`);

       // Apply each change
       for (const change of changes) {
         await this.applyCodeChange(change);
       }

       // Run tests
       const testResult = await this.runTests();
       if (!testResult.passed) {
         await this.git.rollback();
         throw new Error('Tests failed');
       }

       // Create PR
       await this.git.createPullRequest({
         title: `StyleForm: ${changes.description}`,
         body: this.formatChangelog(changes),
         assignees: ['admin']
       });
     }
   }
   ```

2. **Agent Toolkit**
   ```typescript
   // backend/src/services/agents/agent-toolkit.ts (NEW)

   export class AgentToolkit {
     // Read tools
     async readFile(path: string): Promise<string>
     async analyzeComponent(componentName: string): Promise<ComponentStructure>
     async traceDataFlow(fieldName: string): Promise<DataFlowMap>
     async findRelatedFiles(query: string): Promise<string[]>

     // Write tools
     async modifyComponent(path: string, changes: CodeChange[]): Promise<void>
     async addField(location: FieldLocation, field: FieldDefinition): Promise<void>
     async addValidation(schema: string, rule: ValidationRule): Promise<void>
     async updateType(typePath: string, modification: TypeModification): Promise<void>

     // Analysis tools
     async detectPatterns(files: string[]): Promise<Pattern[]>
     async findSimilarImplementations(description: string): Promise<Example[]>
     async estimateImpact(changes: CodeChange[]): Promise<ImpactReport>

     // Safety tools
     async runTypeCheck(): Promise<TypeCheckResult>
     async runLinter(): Promise<LintResult>
     async runTests(filter?: string): Promise<TestResult>
     async simulateChange(change: CodeChange): Promise<SimulationResult>
   }
   ```

3. **Change Validator**
   ```typescript
   // backend/src/services/agents/change-validator.service.ts (NEW)

   export class ChangeValidator {
     async validate(changes: CodeChange[]): Promise<ValidationResult> {
       const checks = await Promise.all([
         this.checkBreakingChanges(changes),
         this.checkDataLoss(changes),
         this.checkSecurityIssues(changes),
         this.checkPerformanceImpact(changes),
         this.checkAccessibility(changes),
         this.checkTypesSafety(changes)
       ]);

       return {
         safe: checks.every(c => c.passed),
         issues: checks.flatMap(c => c.issues),
         warnings: checks.flatMap(c => c.warnings)
       };
     }

     private async checkBreakingChanges(changes: CodeChange[]): Promise<Check> {
       // Detect if removing fields that are in use
       // Check if changing prop types
       // Verify backward compatibility
     }
   }
   ```

4. **Pattern Learner**
   ```typescript
   // backend/src/services/agents/pattern-learner.service.ts (NEW)

   export class PatternLearner {
     async learnFromHistory(): Promise<void> {
       // Analyze git commits on StyleForm files
       const commits = await this.git.getCommits({
         path: 'frontend/src/pages/StyleFormRedesigned.tsx',
         since: '6 months ago'
       });

       for (const commit of commits) {
         const pattern = this.extractPattern(commit);
         await this.storePattern(pattern);
       }
     }

     async findSimilarChange(description: string): Promise<ChangePattern[]> {
       // Use embeddings to find similar past changes
       const embedding = await this.embeddingService.createEmbedding(description);

       return await this.prisma.agent_patterns.findMany({
         where: {
           embedding: { cosine_distance: { lt: 0.3, vector: embedding } }
         },
         orderBy: { confidence: 'desc' },
         take: 5
       });
     }
   }
   ```

5. **Agent Dashboard UI**
   ```tsx
   // frontend/src/pages/AgentDashboard.tsx (NEW)

   export const AgentDashboard = () => {
     return (
       <div className="p-6 space-y-6">
         <h1 className="text-3xl font-bold">StyleForm Agent</h1>

         <Card>
           <CardHeader>
             <CardTitle>Agent Status</CardTitle>
           </CardHeader>
           <CardContent>
             <StatusIndicator agent="styleform" />
             <div className="mt-4 grid grid-cols-3 gap-4">
               <Stat label="Changes Proposed" value={24} />
               <Stat label="Approved" value={20} />
               <Stat label="Success Rate" value="95%" />
             </div>
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle>Pending Changes</CardTitle>
           </CardHeader>
           <CardContent>
             <PendingChangesList />
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle>Recent Activity</CardTitle>
           </CardHeader>
           <CardContent>
             <ChangeHistory limit={20} />
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle>Settings</CardTitle>
           </CardHeader>
           <CardContent>
             <AgentSettings />
           </CardContent>
         </Card>
       </div>
     );
   };
   ```

**Files to Create** (15+ files):
- `backend/src/services/agents/styleform-agent.service.ts`
- `backend/src/services/agents/agent-toolkit.ts`
- `backend/src/services/agents/change-validator.service.ts`
- `backend/src/services/agents/pattern-learner.service.ts`
- `backend/src/services/agents/code-generator.service.ts`
- `backend/src/routes/agent.routes.ts`
- `backend/src/controllers/agent.controller.ts`
- `backend/src/schemas/agent.schema.ts`
- `frontend/src/pages/AgentDashboard.tsx`
- `frontend/src/components/Agent/StatusIndicator.tsx`
- `frontend/src/components/Agent/PendingChangesList.tsx`
- `frontend/src/components/Agent/ChangeHistory.tsx`
- `frontend/src/components/Agent/ChangePreview.tsx`
- `frontend/src/services/agent.service.ts`
- Database migration for `agent_patterns`, `agent_changes` tables

**Pros**: Fully autonomous, learns continuously, handles complex changes, reduces dev time
**Cons**: Complex, requires extensive safety measures, higher risk, needs fine-tuning

---

## Recommendation: Start with Approach 2

**Why Approach 2 (Suggestion API)?**

1. **Immediate Value**: Users get help while creating styles
2. **Safe**: User maintains full control, agent only suggests
3. **Foundation**: Builds data pipeline for future autonomous agent
4. **Proven Pattern**: Similar to GitHub Copilot (suggest, not auto-apply)
5. **Incremental**: Can expand features over time

**Implementation Roadmap**:

**Week 1: Fabric Suggestions**
- Index historical styles
- Build fabric suggestion prompt
- Create suggestion panel UI
- Test with 5-10 users

**Week 2: Trim Suggestions**
- Analyze fabric-trim patterns
- Build trim recommendation engine
- Integrate into Trims tab
- A/B test suggestion quality

**Week 3: Validation & Cost Estimation**
- Build validation rules
- Add cost estimation model
- Create validation feedback UI
- Monitor accuracy metrics

**Week 4: Templates & Optimization**
- Similar style templates
- Optimize prompt performance
- Improve suggestion relevance
- Plan for autonomous features

**Future: Evolve to Approach 3**
- Once suggestions prove valuable (3-6 months)
- Start with simple autonomous tasks (add field)
- Gradually expand capabilities
- Always require human approval

---

## Critical Files Reference

### StyleForm Core Files

| File | Purpose | Lines |
|------|---------|-------|
| `frontend/src/pages/StyleFormRedesigned.tsx` | Main form component | 2,167 |
| `frontend/src/components/GenericFabricSelector.tsx` | Fabric name picker | ~300 |
| `frontend/src/components/TrimSelector.tsx` | Trim material selection | ~400 |
| `frontend/src/components/AccessorySelector.tsx` | Accessory picker | ~350 |
| `frontend/src/components/EmbroiderySelector.tsx` | Embroidery attachment | ~250 |

### Backend Services

| File | Purpose |
|------|---------|
| `backend/src/services/style.service.ts` | Style CRUD operations |
| `backend/src/controllers/style.controller.ts` | API endpoints |
| `backend/src/routes/style.routes.ts` | Route definitions |

### Related Database Tables

| Table | Purpose |
|-------|---------|
| `styles` | Core style records |
| `style_components` | Components per style |
| `style_fabrics` | Fabric assignments |
| `style_material_bom` | Unified trim/material storage |
| `style_variants` | Size variants with SKUs |

### AI Infrastructure (For Future Enhancement)

| File | Purpose |
|------|---------|
| `backend/src/services/ai/conversation.service.ts` | AI conversation management |
| `backend/src/services/ai/erp-context.service.ts` | ERP context injection |
| `frontend/src/pages/AIAssistant.tsx` | AI chat interface |

---

## Related Documentation

- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview
- [BOM_MRP_GUIDE.md](BOM_MRP_GUIDE.md) - Material BOM details
- [MATERIALS_MASTER_GUIDE.md](MATERIALS_MASTER_GUIDE.md) - Material masters
- [CAD_PLANNING_GUIDE.md](CAD_PLANNING_GUIDE.md) - CAD integration

---

**Document History:**
- **January 13, 2026** - Converted from implementation plan to standalone guide
- **Original:** `docs/plans/styleform-dedicated-agent.md`
