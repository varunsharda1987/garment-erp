/**
 * Master-data AI actions (Phase A) — greige, lace, fabric, colour, season, supplier,
 * customer and the six trim masters.
 *
 * Field requirements below mirror each endpoint's own Zod schema. Where the API is
 * laxer than the tool schema it is called out: for most trims every field is technically
 * optional, but a nameless master is useless, so the tool asks for a name.
 */

import { z } from 'zod';
import type { ActionDefinition, Payload, ActionContext, StepResult } from '../ai-action-types';
import { internalFetch } from '../ai-action-types';

/** Roles that maintain master data. Routes mostly have no gate; the registry is stricter. */
const MASTER_ROLES = ['ADMIN', 'MERCHANDISER', 'INVENTORY', 'PURCHASE'] as const;

/** Trim masters share one shape of supplier/buyer/description fields. */
const trimCommon = {
  supplierCode: z.string().max(50).optional(),
  buyerCode: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
};

const trimCommonProps = {
  supplierCode: { type: 'string' },
  buyerCode: { type: 'string' },
  description: { type: 'string' },
};

// ── Greige ───────────────────────────────────────────────────────────────────

const greigeShape = z.object({
  greigeName: z.string().min(1).max(200),
  composition: z.string().min(1).max(500),
  greigeWidth: z.number().positive(),
  yarnCount: z.string().max(50).optional(),
  construction: z.string().max(200).optional(),
  weaveType: z.string().max(50).optional(),
  greigeQuality: z.enum(['PRINTING', 'DYEING', 'SUPER_DYEING']).optional(),
  costPerMeter: z.number().nonnegative().optional(),
  averageShrinkagePercent: z.number().min(0).lt(100).optional(),
  description: z.string().max(1000).optional(),
});

const createGreige: ActionDefinition = {
  actionType: 'create_greige',
  actionEntity: 'greige_master',
  label: 'Create Greige Master',
  method: 'POST',
  path: '/api/fabric-management/greige',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: greigeShape,
  executionSchema: greigeShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_greige',
      description:
        'Create a greige (unfinished fabric) master. Required: greigeName, composition, greigeWidth in inches. Ask for anything missing.',
      parameters: {
        type: 'object',
        properties: {
          greigeName: { type: 'string', description: 'e.g. "Cotton Cambric 60x60"' },
          composition: { type: 'string', description: 'e.g. "100% Cotton"' },
          greigeWidth: { type: 'number', description: 'Width in inches' },
          yarnCount: { type: 'string' },
          construction: { type: 'string' },
          weaveType: { type: 'string', description: 'Plain, Twill, Satin…' },
          greigeQuality: { type: 'string', enum: ['PRINTING', 'DYEING', 'SUPER_DYEING'] },
          costPerMeter: { type: 'number' },
          averageShrinkagePercent: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['greigeName', 'composition', 'greigeWidth'],
      },
    },
  },
  successMessage: (d) => `✅ Created greige **${d.greigeName}** (code: ${d.greigeCode}). [Open it](/greige/${d.id})`,
};

// ── Lace ─────────────────────────────────────────────────────────────────────

const laceShape = z.object({
  laceName: z.string().min(1).max(200),
  laceType: z.string().max(50).optional(),
  composition: z.string().max(100).optional(),
  design: z.string().max(100).optional(),
  width: z.number().positive().optional(),
  color: z.string().max(50).optional(),
  pricePerMeter: z.number().nonnegative().optional(),
  isGreige: z.boolean().optional(),
  expectedShrinkagePercent: z.number().min(0).lt(100).optional(),
  costPerMeterGreige: z.number().nonnegative().optional(),
  description: z.string().max(1000).optional(),
});

const createLace: ActionDefinition = {
  actionType: 'create_lace',
  actionEntity: 'lace_master',
  label: 'Create Lace Master',
  method: 'POST',
  path: '/api/materials/lace',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: laceShape,
  executionSchema: laceShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_lace',
      description:
        'Create a lace master. Required: laceName. For greige (undyed) lace set isGreige=true; colour does not apply then.',
      parameters: {
        type: 'object',
        properties: {
          laceName: { type: 'string', description: 'e.g. "Cotton Crochet Lace Floral"' },
          laceType: { type: 'string', description: 'Crochet, GPO, Nylon…' },
          composition: { type: 'string' },
          design: { type: 'string' },
          width: { type: 'number' },
          color: { type: 'string', description: 'Omit for greige lace' },
          pricePerMeter: { type: 'number' },
          isGreige: { type: 'boolean' },
          expectedShrinkagePercent: { type: 'number' },
          costPerMeterGreige: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['laceName'],
      },
    },
  },
  successMessage: (d) => `✅ Created lace **${d.laceName}** (code: ${d.laceCode}). [Open it](/materials/lace/${d.id})`,
};

// ── Fabric (finished) ────────────────────────────────────────────────────────

const fabricToolShape = z.object({
  fabricName: z.string().min(1).max(200),
  actualWidth: z.number().positive(),
  composition: z.string().max(500).optional(),
  colorName: z.string().max(50).optional(),
  actualGSM: z.number().positive().optional(),
  costPerMeter: z.number().nonnegative().optional(),
  finishType: z.string().max(50).optional(),
});

// fabricCode is Zod-required on the endpoint; prepare() fetches the next one.
const fabricExecShape = fabricToolShape.extend({ fabricCode: z.string().min(1).max(50) });

const createFabric: ActionDefinition = {
  actionType: 'create_fabric',
  actionEntity: 'fabric_master',
  label: 'Create Fabric Master',
  method: 'POST',
  path: '/api/fabric-management/fabric',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: fabricToolShape,
  executionSchema: fabricExecShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_fabric',
      description:
        'Create a finished fabric master. Required: fabricName and actualWidth (inches). The fabric code is generated automatically — never ask the user for it.',
      parameters: {
        type: 'object',
        properties: {
          fabricName: { type: 'string' },
          actualWidth: { type: 'number', description: 'Finished width in inches' },
          composition: { type: 'string' },
          colorName: { type: 'string' },
          actualGSM: { type: 'number' },
          costPerMeter: { type: 'number' },
          finishType: { type: 'string' },
        },
        required: ['fabricName', 'actualWidth'],
      },
    },
  },
  // The endpoint requires a code and re-mints auto-pattern codes on collision, so peeking
  // the next code here is safe; a failure to get one is fatal (create would 400).
  prepare: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    try {
      const { ok, body } = await internalFetch(
        '/api/fabric-management/fabric/next-code?source=stock',
        { method: 'GET' },
        ctx.authHeader
      );
      const nextCode = (body as { nextCode?: string }).nextCode;
      if (!ok || !nextCode) {
        return { ok: false, question: 'I could not reserve a fabric code just now. Please try again in a moment.' };
      }
      return { ok: true, payload: { ...payload, fabricCode: nextCode }, displayLines: [`Fabric code: ${nextCode}`] };
    } catch {
      return { ok: false, question: 'The fabric code lookup timed out. Please try again.' };
    }
  },
  successMessage: (d) => `✅ Created fabric **${d.fabricName}** (code: ${d.fabricCode}). [Open it](/fabric/${d.id})`,
};

// ── Colour ───────────────────────────────────────────────────────────────────

const colorShape = z.object({
  colorName: z.string().min(2).max(100),
  hexCode: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'hexCode must look like #RRGGBB')
    .optional(),
  colorFamily: z
    .enum([
      'Reds',
      'Blues',
      'Greens',
      'Yellows',
      'Oranges',
      'Purples',
      'Pinks',
      'Browns',
      'Neutrals',
      'Prints',
      'Metallics',
    ])
    .optional(),
  description: z.string().max(500).optional(),
});

const createColor: ActionDefinition = {
  actionType: 'create_color',
  actionEntity: 'color_master',
  label: 'Create Colour',
  method: 'POST',
  path: '/api/colors',
  allowedRoles: ['ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'],
  toolSchema: colorShape,
  executionSchema: colorShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_color',
      description:
        'Create a colour in the colour master. Required: colorName. The colour code is generated automatically.',
      parameters: {
        type: 'object',
        properties: {
          colorName: { type: 'string', description: 'e.g. "Navy Blue"' },
          hexCode: { type: 'string', description: 'Hex like #1B2A4A — only if the user gives one' },
          colorFamily: {
            type: 'string',
            enum: [
              'Reds',
              'Blues',
              'Greens',
              'Yellows',
              'Oranges',
              'Purples',
              'Pinks',
              'Browns',
              'Neutrals',
              'Prints',
              'Metallics',
            ],
          },
          description: { type: 'string' },
        },
        required: ['colorName'],
      },
    },
  },
  // Colours have no detail page — link the list.
  successMessage: (d) => `✅ Created colour **${d.colorName}** (code: ${d.colorCode}). [Open colours](/colors)`,
};

// ── Season ───────────────────────────────────────────────────────────────────

const seasonShape = z.object({
  name: z.string().min(1).max(100),
  seasonType: z.enum(['SS', 'AW']),
  year: z.number().int().min(2000).max(2100),
});

const createSeason: ActionDefinition = {
  actionType: 'create_season',
  actionEntity: 'season_master',
  label: 'Create Season',
  method: 'POST',
  path: '/api/seasons',
  allowedRoles: ['ADMIN', 'MERCHANDISER'],
  toolSchema: seasonShape,
  executionSchema: seasonShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_season',
      description:
        'Create a season. Required: name, seasonType (SS = Spring/Summer, AW = Autumn/Winter) and year. The code is generated automatically.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'e.g. "Spring Summer 2027"' },
          seasonType: { type: 'string', enum: ['SS', 'AW'] },
          year: { type: 'number', description: 'Four digit year' },
        },
        required: ['name', 'seasonType', 'year'],
      },
    },
  },
  successMessage: (d) => `✅ Created season **${d.name}** (code: ${d.code}). [Open seasons](/seasons)`,
};

// ── Supplier ─────────────────────────────────────────────────────────────────

const SUPPLIER_CATEGORIES = [
  'FABRIC_SUPPLIER',
  'GREIGE_SUPPLIER',
  'TRIMS_SUPPLIER',
  'THREAD_SUPPLIER',
  'PACKAGING_SUPPLIER',
  'LACE_SUPPLIER',
  'DYEING_PRINTING',
  'EMBROIDERY',
  'HAND_WORK',
  'SMOCKING',
  'CMT_UNIT',
  'FINISHING_CONTRACTOR',
  'STITCHING_CONTRACTOR',
  'WASHING',
  'DORI_PIPING_CONTRACTOR',
  'MACHINE_PARTS_SUPPLIER',
  'OTHER_SERVICES',
] as const;

const supplierToolShape = z.object({
  name: z.string().min(2).max(200),
  supplierCategories: z.array(z.enum(SUPPLIER_CATEGORIES)).min(1),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditDays: z.number().int().min(0).max(365).optional(),
});

// The API requires a code; the supplier form generates it client-side, so the action does
// the same rather than asking the user to invent one that breaks the convention.
const supplierExecShape = supplierToolShape.extend({ code: z.string().min(2).max(50) });

const createSupplier: ActionDefinition = {
  actionType: 'create_supplier',
  actionEntity: 'suppliers',
  label: 'Create Supplier',
  method: 'POST',
  path: '/api/suppliers',
  allowedRoles: ['ADMIN', 'PURCHASE', 'MERCHANDISER'],
  toolSchema: supplierToolShape,
  executionSchema: supplierExecShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_supplier',
      description:
        'Create a supplier. Required: name and at least one supplierCategories value. The supplier code is generated automatically — never ask the user for it.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          supplierCategories: {
            type: 'array',
            description: 'What this supplier provides — at least one',
            items: { type: 'string', enum: SUPPLIER_CATEGORIES },
          },
          contactPerson: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
          paymentTerms: { type: 'string' },
          creditDays: { type: 'number' },
        },
        required: ['name', 'supplierCategories'],
      },
    },
  },
  // Mirrors SupplierForm's own generator (SUP + timestamp + random)
  prepare: async (payload: Payload): Promise<StepResult> => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    const code = `SUP${timestamp}${random}`;
    return { ok: true, payload: { ...payload, code }, displayLines: [`Supplier code: ${code}`] };
  },
  successMessage: (d) => `✅ Created supplier **${d.name}** (${d.code}). [Open it](/suppliers/${d.id})`,
};

// ── Customer ─────────────────────────────────────────────────────────────────

const customerToolShape = z.object({
  name: z.string().min(2).max(200),
  category: z.enum(['DOMESTIC', 'EXPORT', 'WHOLESALER', 'RETAILER']),
  businessType: z.enum(['B2B', 'B2C']).optional(),
  market: z.enum(['DOMESTIC', 'INTERNATIONAL']).optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  billingAddress: z.string().optional(),
  creditDays: z.number().int().min(0).max(365).optional(),
});

// The API requires a code; CustomerForm generates CUST-{B2B|B2C}-{INT|DOM}-NNN by scanning
// existing customers. The action reproduces that so chat-created codes match the convention.
const customerExecShape = customerToolShape.extend({ code: z.string().min(2).max(50) });

const createCustomer: ActionDefinition = {
  actionType: 'create_customer',
  actionEntity: 'customers',
  label: 'Create Customer',
  method: 'POST',
  path: '/api/customers',
  // Mirrors the route's own authorize() gate
  allowedRoles: ['ADMIN', 'SALES', 'MERCHANDISER'],
  toolSchema: customerToolShape,
  executionSchema: customerExecShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_customer',
      description:
        'Create a customer (buyer). Required: name and category. The customer code is generated automatically — never ask the user for it.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          category: { type: 'string', enum: ['DOMESTIC', 'EXPORT', 'WHOLESALER', 'RETAILER'] },
          businessType: { type: 'string', enum: ['B2B', 'B2C'], description: 'Defaults to B2B' },
          market: { type: 'string', enum: ['DOMESTIC', 'INTERNATIONAL'], description: 'Defaults to DOMESTIC' },
          contactPerson: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          billingAddress: { type: 'string' },
          creditDays: { type: 'number' },
        },
        required: ['name', 'category'],
      },
    },
  },
  // Mirrors CustomerForm: scan existing codes with the same prefix and take the next number
  prepare: async (payload: Payload, ctx: ActionContext): Promise<StepResult> => {
    const businessType = (payload.businessType as string) || 'B2B';
    const market = (payload.market as string) === 'INTERNATIONAL' ? 'INT' : 'DOM';
    const prefix = `CUST-${businessType}-${market}-`;

    let nextNumber = 1;
    try {
      const { ok, body } = await internalFetch('/api/customers?page=1&limit=100', { method: 'GET' }, ctx.authHeader);
      if (ok && Array.isArray(body.data)) {
        const numbers = (body.data as Array<{ code?: string }>)
          .filter((row) => row.code?.startsWith(prefix))
          .map((row) => Number(row.code?.match(/CUST-[^-]+-[^-]+-(\d+)/)?.[1] || 0))
          .filter((n) => !Number.isNaN(n));
        if (numbers.length > 0) nextNumber = Math.max(...numbers) + 1;
      }
    } catch {
      // Fall through to 001 — the endpoint rejects a duplicate, so nothing is silently wrong
    }

    const code = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    return { ok: true, payload: { ...payload, code }, displayLines: [`Customer code: ${code}`] };
  },
  successMessage: (d) => `✅ Created customer **${d.name}** (${d.code}). [Open it](/customers/${d.id})`,
};

// ── Trims ────────────────────────────────────────────────────────────────────
// Note: apart from thread, the API leaves every trim field optional — the tool still asks
// for a name because an unnamed master is useless. Do NOT send styleCodes for elastic,
// label or packaging: those schemas dropped it and the value is silently discarded.

const buttonShape = z.object({
  buttonName: z.string().min(1).max(200),
  size: z.string().max(50).optional(),
  holes: z.number().int().min(0).max(10).optional(),
  color: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  shape: z.string().max(50).optional(),
  pricePerPiece: z.number().nonnegative().optional(),
  ...trimCommon,
});

const createButton: ActionDefinition = {
  actionType: 'create_button',
  actionEntity: 'button_master',
  label: 'Create Button',
  method: 'POST',
  path: '/api/materials/button',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: buttonShape,
  executionSchema: buttonShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_button',
      description: 'Create a button master. Ask for a name. The code (BTN-…) is generated automatically.',
      parameters: {
        type: 'object',
        properties: {
          buttonName: { type: 'string' },
          size: { type: 'string', description: 'e.g. "18L"' },
          holes: { type: 'number' },
          color: { type: 'string' },
          material: { type: 'string', description: 'e.g. "Polyester", "Horn"' },
          shape: { type: 'string' },
          pricePerPiece: { type: 'number' },
          ...trimCommonProps,
        },
        required: ['buttonName'],
      },
    },
  },
  successMessage: (d) =>
    `✅ Created button **${d.buttonName}** (${d.buttonCode}). [Open it](/materials/button/${d.id})`,
};

const zipperShape = z.object({
  zipperName: z.string().min(1).max(200),
  brand: z.string().max(50).optional(),
  sliderType: z.string().max(50).optional(),
  length: z.number().positive().optional(),
  teethType: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  pricePerPiece: z.number().nonnegative().optional(),
  ...trimCommon,
});

const createZipper: ActionDefinition = {
  actionType: 'create_zipper',
  actionEntity: 'zipper_master',
  label: 'Create Zipper',
  method: 'POST',
  path: '/api/materials/zipper',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: zipperShape,
  executionSchema: zipperShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_zipper',
      description: 'Create a zipper master. Ask for a name. The code (ZIP-…) is generated automatically.',
      parameters: {
        type: 'object',
        properties: {
          zipperName: { type: 'string' },
          brand: { type: 'string', description: 'e.g. "YKK"' },
          sliderType: { type: 'string' },
          length: { type: 'number', description: 'Length in inches or cm as the user states' },
          teethType: { type: 'string' },
          color: { type: 'string' },
          pricePerPiece: { type: 'number' },
          ...trimCommonProps,
        },
        required: ['zipperName'],
      },
    },
  },
  successMessage: (d) =>
    `✅ Created zipper **${d.zipperName}** (${d.zipperCode}). [Open it](/materials/zipper/${d.id})`,
};

const elasticShape = z.object({
  elasticName: z.string().min(1).max(200),
  elasticType: z.string().max(50).optional(),
  composition: z.string().max(100).optional(),
  width: z.number().positive().optional(),
  stretchPercent: z.number().min(0).max(1000).optional(),
  color: z.string().max(50).optional(),
  pricePerMeter: z.number().nonnegative().optional(),
  ...trimCommon,
});

const createElastic: ActionDefinition = {
  actionType: 'create_elastic',
  actionEntity: 'elastic_master',
  label: 'Create Elastic',
  method: 'POST',
  path: '/api/materials/elastic',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: elasticShape,
  executionSchema: elasticShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_elastic',
      description: 'Create an elastic master. Ask for a name. The code (ELA-…) is generated automatically.',
      parameters: {
        type: 'object',
        properties: {
          elasticName: { type: 'string' },
          elasticType: { type: 'string', description: 'e.g. "Woven", "Knitted"' },
          composition: { type: 'string' },
          width: { type: 'number' },
          stretchPercent: { type: 'number' },
          color: { type: 'string' },
          pricePerMeter: { type: 'number' },
          ...trimCommonProps,
        },
        required: ['elasticName'],
      },
    },
  },
  successMessage: (d) =>
    `✅ Created elastic **${d.elasticName}** (${d.elasticCode}). [Open it](/materials/elastic/${d.id})`,
};

const threadShape = z.object({
  threadName: z.string().min(1).max(200),
  brand: z.string().max(50).optional(),
  packagingType: z.enum(['CONE', 'TUBE', 'SPOOL', 'CONE_5K', 'CONE_10K']).optional(),
  color: z.string().max(50).optional(),
  ply: z.number().int().positive().optional(),
  metersPerUnit: z.number().positive().optional(),
  pricePerCone: z.number().nonnegative().optional(),
  ...trimCommon,
});

const createThread: ActionDefinition = {
  actionType: 'create_thread',
  actionEntity: 'thread_master',
  label: 'Create Thread',
  method: 'POST',
  path: '/api/materials/thread',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: threadShape,
  executionSchema: threadShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_thread',
      description: 'Create a thread master. Required: threadName. The code (THR-…) is generated automatically.',
      parameters: {
        type: 'object',
        properties: {
          threadName: { type: 'string' },
          brand: { type: 'string' },
          packagingType: { type: 'string', enum: ['CONE', 'TUBE', 'SPOOL', 'CONE_5K', 'CONE_10K'] },
          color: { type: 'string' },
          ply: { type: 'number' },
          metersPerUnit: { type: 'number' },
          pricePerCone: { type: 'number' },
          ...trimCommonProps,
        },
        required: ['threadName'],
      },
    },
  },
  successMessage: (d) =>
    `✅ Created thread **${d.threadName}** (${d.threadCode}). [Open it](/materials/thread/${d.id})`,
};

const labelShape = z.object({
  labelName: z.string().min(1).max(200),
  labelCategory: z.enum(['SEWN_IN', 'HANGTAG', 'PRICE_TAG']).optional(),
  labelType: z.string().max(50).optional(),
  content: z.string().max(500).optional(),
  fabricContent: z.string().max(200).optional(),
  washcareInstructions: z.string().max(500).optional(),
  pricePerPiece: z.number().nonnegative().optional(),
  ...trimCommon,
});

const createLabel: ActionDefinition = {
  actionType: 'create_label',
  actionEntity: 'label_master',
  label: 'Create Label',
  method: 'POST',
  path: '/api/materials/label',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: labelShape,
  executionSchema: labelShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_label',
      description:
        'Create a label master (sewn-in label, hangtag or price tag). Ask for a name. The code (LBL-…) is generated automatically.',
      parameters: {
        type: 'object',
        properties: {
          labelName: { type: 'string' },
          labelCategory: { type: 'string', enum: ['SEWN_IN', 'HANGTAG', 'PRICE_TAG'] },
          labelType: { type: 'string' },
          content: { type: 'string', description: 'Text printed on the label' },
          fabricContent: { type: 'string' },
          washcareInstructions: { type: 'string' },
          pricePerPiece: { type: 'number' },
          ...trimCommonProps,
        },
        required: ['labelName'],
      },
    },
  },
  successMessage: (d) => `✅ Created label **${d.labelName}** (${d.labelCode}). [Open it](/materials/label/${d.id})`,
};

const packagingShape = z.object({
  packagingName: z.string().min(1).max(200),
  packagingType: z.string().max(50).optional(),
  size: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  thickness: z.string().max(100).optional(),
  printDetails: z.string().max(500).optional(),
  pricePerPiece: z.number().nonnegative().optional(),
  ...trimCommon,
});

const createPackaging: ActionDefinition = {
  actionType: 'create_packaging',
  actionEntity: 'packaging_master',
  label: 'Create Packaging',
  method: 'POST',
  path: '/api/materials/packaging',
  allowedRoles: [...MASTER_ROLES],
  toolSchema: packagingShape,
  executionSchema: packagingShape,
  tool: {
    type: 'function',
    function: {
      name: 'create_packaging',
      description:
        'Create a packaging master (poly bag, carton, etc.). Ask for a name. The code (PKG-…) is generated automatically.',
      parameters: {
        type: 'object',
        properties: {
          packagingName: { type: 'string' },
          packagingType: { type: 'string', description: 'e.g. "Poly Bag", "Carton"' },
          size: { type: 'string' },
          material: { type: 'string' },
          thickness: { type: 'string', description: 'e.g. "40 microns"' },
          printDetails: { type: 'string' },
          pricePerPiece: { type: 'number' },
          ...trimCommonProps,
        },
        required: ['packagingName'],
      },
    },
  },
  successMessage: (d) =>
    `✅ Created packaging **${d.packagingName}** (${d.packagingCode}). [Open it](/materials/packaging/${d.id})`,
};

export const MASTER_ACTIONS: ActionDefinition[] = [
  createGreige,
  createLace,
  createFabric,
  createColor,
  createSeason,
  createSupplier,
  createCustomer,
  createButton,
  createZipper,
  createElastic,
  createThread,
  createLabel,
  createPackaging,
];
