/**
 * Seed HSN/SAC Master Data — Updated for GST 2.0 (effective Sep 22, 2025)
 *
 * HSN = Harmonized System of Nomenclature (for goods)
 * SAC = Service Accounting Code (for services)
 *
 * GST 2.0 Key Changes for Textiles/Apparel:
 *  - Apparel ≤₹2,500: 5% (threshold raised from ₹1,000)
 *  - Apparel >₹2,500: 18% (replaced old 12% slab)
 *  - Man-made fibres/yarns: reduced to 5%
 *  - Textile job work (SAC 9988): reduced to 5%
 *  - 12% slab abolished for most textile goods
 *
 * Default rates here use 5% for apparel (mass-market ≤₹2,500).
 * Users can override per-item in PO/Invoice if selling >₹2,500 (18%).
 */

import { PrismaClient, HSNSACType } from '@prisma/client';

const prisma = new PrismaClient();

interface HSNSACEntry {
  code: string;
  type: HSNSACType;
  description: string;
  chapter?: string;
  section?: string;
  defaultGstRate: number;
  unit?: string;
}

const hsnCodes: HSNSACEntry[] = [
  // ============================================
  // Chapter 50: Silk
  // ============================================
  { code: '5007', type: 'HSN', description: 'Woven fabrics of silk or of silk waste', chapter: '50', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },

  // ============================================
  // Chapter 52: Cotton
  // ============================================
  { code: '5204', type: 'HSN', description: 'Cotton sewing thread, whether or not put up for retail sale', chapter: '52', section: 'Textiles', defaultGstRate: 5, unit: 'CON' },
  { code: '5205', type: 'HSN', description: 'Cotton yarn (other than sewing thread), containing 85% or more by weight of cotton', chapter: '52', section: 'Textiles', defaultGstRate: 5, unit: 'KG' },
  { code: '5208', type: 'HSN', description: 'Woven fabrics of cotton, ≥85% cotton, weighing ≤200 g/m²', chapter: '52', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5209', type: 'HSN', description: 'Woven fabrics of cotton, ≥85% cotton, weighing >200 g/m²', chapter: '52', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '52091100', type: 'HSN', description: 'Cotton fabric - Unbleached plain weave', chapter: '52', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5210', type: 'HSN', description: 'Woven fabrics of cotton, <85% cotton, mixed with man-made fibres, ≤200 g/m²', chapter: '52', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5211', type: 'HSN', description: 'Woven fabrics of cotton, <85% cotton, mixed with man-made fibres, >200 g/m²', chapter: '52', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5212', type: 'HSN', description: 'Other woven fabrics of cotton', chapter: '52', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },

  // ============================================
  // Chapter 53: Vegetable fibres (Linen, Jute)
  // ============================================
  { code: '5309', type: 'HSN', description: 'Woven fabrics of flax (linen)', chapter: '53', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },

  // ============================================
  // Chapter 54: Man-made filaments
  // ============================================
  { code: '5401', type: 'HSN', description: 'Sewing thread of man-made filaments', chapter: '54', section: 'Textiles', defaultGstRate: 5, unit: 'CON' },
  { code: '5402', type: 'HSN', description: 'Synthetic filament yarn (nylon, polyester, etc.), not put up for retail sale', chapter: '54', section: 'Textiles', defaultGstRate: 5, unit: 'KG' },
  { code: '5407', type: 'HSN', description: 'Woven fabrics of synthetic filament yarn', chapter: '54', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5408', type: 'HSN', description: 'Woven fabrics of artificial filament yarn (viscose, rayon)', chapter: '54', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },

  // ============================================
  // Chapter 55: Man-made staple fibres
  // ============================================
  { code: '5508', type: 'HSN', description: 'Sewing thread of man-made staple fibres', chapter: '55', section: 'Textiles', defaultGstRate: 5, unit: 'CON' },
  { code: '5509', type: 'HSN', description: 'Yarn of synthetic staple fibres (polyester, acrylic)', chapter: '55', section: 'Textiles', defaultGstRate: 5, unit: 'KG' },
  { code: '5510', type: 'HSN', description: 'Yarn of artificial staple fibres (viscose, modal)', chapter: '55', section: 'Textiles', defaultGstRate: 5, unit: 'KG' },
  { code: '5512', type: 'HSN', description: 'Woven fabrics of synthetic staple fibres, ≥85% by weight', chapter: '55', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5513', type: 'HSN', description: 'Woven fabrics of synthetic staple fibres, <85% by weight, ≤170 g/m²', chapter: '55', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5514', type: 'HSN', description: 'Woven fabrics of synthetic staple fibres, <85% by weight, mixed with cotton', chapter: '55', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5515', type: 'HSN', description: 'Other woven fabrics of synthetic staple fibres', chapter: '55', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5516', type: 'HSN', description: 'Woven fabrics of artificial staple fibres', chapter: '55', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },

  // ============================================
  // Chapter 56: Wadding, felt, nonwovens, special yarns
  // ============================================
  { code: '5602', type: 'HSN', description: 'Felt, whether or not impregnated, coated, covered or laminated', chapter: '56', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5603', type: 'HSN', description: 'Nonwovens, whether or not impregnated, coated, covered or laminated', chapter: '56', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5604', type: 'HSN', description: 'Rubber thread/cord, textile-covered; elastic thread/strip', chapter: '56', section: 'Textiles', defaultGstRate: 5, unit: 'KG' },

  // ============================================
  // Chapter 58: Special woven fabrics, lace, embroidery
  // ============================================
  { code: '5804', type: 'HSN', description: 'Tulles and other net fabrics (not including woven, knitted or crocheted)', chapter: '58', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5806', type: 'HSN', description: 'Narrow woven fabrics (lace/tape/ribbon), width ≤30cm', chapter: '58', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5807', type: 'HSN', description: 'Labels, badges, and similar articles of textile materials', chapter: '58', section: 'Trims', defaultGstRate: 5, unit: 'PCS' },
  { code: '5808', type: 'HSN', description: 'Braids, tapes, and ornamental trimmings in the piece', chapter: '58', section: 'Trims', defaultGstRate: 5, unit: 'MTR' },
  { code: '5810', type: 'HSN', description: 'Embroidery in the piece, in strips or in motifs', chapter: '58', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },

  // ============================================
  // Chapter 59: Coated/laminated fabrics, interlinings
  // ============================================
  { code: '5903', type: 'HSN', description: 'Textile fabrics coated/laminated with plastics (fusible interlining)', chapter: '59', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },
  { code: '5911', type: 'HSN', description: 'Textile products for technical/industrial use (filter cloth, bolting)', chapter: '59', section: 'Textiles', defaultGstRate: 5, unit: 'MTR' },

  // ============================================
  // Chapter 60: Knitted or crocheted fabrics
  // ============================================
  { code: '6001', type: 'HSN', description: 'Pile fabrics (long pile, terry fabrics), knitted or crocheted', chapter: '60', section: 'Textiles', defaultGstRate: 5, unit: 'KG' },
  { code: '6006', type: 'HSN', description: 'Other knitted or crocheted fabrics', chapter: '60', section: 'Textiles', defaultGstRate: 5, unit: 'KG' },

  // ============================================
  // Chapter 61: Articles of apparel, knitted or crocheted
  // GST 2.0: 5% for garments ≤₹2,500; 18% for >₹2,500
  // Default set to 5% (mass-market default)
  // ============================================
  { code: '6101', type: 'HSN', description: "Men's/boys' overcoats, car-coats, capes, anoraks, wind-jackets (knitted)", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6102', type: 'HSN', description: "Women's/girls' overcoats, car-coats, capes, anoraks, wind-jackets (knitted)", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6103', type: 'HSN', description: "Men's/boys' suits, ensembles, jackets, blazers, trousers (knitted)", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6104', type: 'HSN', description: "Women's/girls' suits, ensembles, jackets, dresses, skirts, trousers (knitted)", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6105', type: 'HSN', description: "Men's/boys' shirts, knitted or crocheted", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6106', type: 'HSN', description: "Women's/girls' blouses, shirts and shirt-blouses (knitted)", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6107', type: 'HSN', description: "Men's/boys' underpants, briefs, nightshirts, pyjamas, bathrobes (knitted)", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6108', type: 'HSN', description: "Women's/girls' slips, petticoats, briefs, panties, nightdresses (knitted)", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6109', type: 'HSN', description: 'T-shirts, singlets and other vests, knitted or crocheted', chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6110', type: 'HSN', description: 'Jerseys, pullovers, cardigans, waistcoats, knitted or crocheted', chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6111', type: 'HSN', description: "Babies' garments and clothing accessories, knitted or crocheted", chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6112', type: 'HSN', description: 'Track suits, ski suits and swimwear, knitted or crocheted', chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6114', type: 'HSN', description: 'Other knitted or crocheted garments', chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6115', type: 'HSN', description: 'Pantyhose, tights, stockings, socks (knitted or crocheted)', chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6116', type: 'HSN', description: 'Gloves, mittens and mitts, knitted or crocheted', chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6117', type: 'HSN', description: 'Other knitted clothing accessories; knitted parts of garments', chapter: '61', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },

  // ============================================
  // Chapter 62: Articles of apparel, not knitted or crocheted (woven)
  // GST 2.0: 5% for garments ≤₹2,500; 18% for >₹2,500
  // Default set to 5% (mass-market default)
  // ============================================
  { code: '6201', type: 'HSN', description: "Men's/boys' overcoats, car-coats, capes, anoraks, wind-jackets (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6202', type: 'HSN', description: "Women's/girls' overcoats, car-coats, capes, anoraks, wind-jackets (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6203', type: 'HSN', description: "Men's/boys' suits, ensembles, jackets, blazers, trousers (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6204', type: 'HSN', description: "Women's/girls' suits, ensembles, jackets, dresses, skirts, trousers (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6205', type: 'HSN', description: "Men's/boys' shirts (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6206', type: 'HSN', description: "Women's/girls' blouses, shirts and shirt-blouses (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6207', type: 'HSN', description: "Men's/boys' singlets, vests, underpants, briefs, pyjamas (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6208', type: 'HSN', description: "Women's/girls' singlets, vests, slips, petticoats, briefs, pyjamas (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6209', type: 'HSN', description: "Babies' garments and clothing accessories (woven)", chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6210', type: 'HSN', description: 'Garments made up of coated/laminated/rubberized fabrics', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6211', type: 'HSN', description: 'Track suits, ski suits, swimwear, other garments (woven)', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '62114210', type: 'HSN', description: 'Ladies garments - Cotton (kurta sets, suits)', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '62114990', type: 'HSN', description: 'Other garments of cotton', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6212', type: 'HSN', description: 'Brassieres, girdles, corsets, braces, suspenders, garters', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6213', type: 'HSN', description: 'Handkerchiefs', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6214', type: 'HSN', description: 'Shawls, scarves, mufflers, mantillas, veils', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6215', type: 'HSN', description: 'Ties, bow ties and cravats', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6216', type: 'HSN', description: 'Gloves, mittens and mitts (woven)', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },
  { code: '6217', type: 'HSN', description: 'Other woven clothing accessories; parts of garments', chapter: '62', section: 'Apparel', defaultGstRate: 5, unit: 'PCS' },

  // ============================================
  // Chapter 63: Other made-up textile articles
  // GST 2.0: 5% for items ≤₹2,500; 18% for >₹2,500
  // ============================================
  { code: '6301', type: 'HSN', description: 'Blankets and travelling rugs', chapter: '63', section: 'Made-up Textiles', defaultGstRate: 5, unit: 'PCS' },
  { code: '6302', type: 'HSN', description: 'Bed linen, table linen, toilet linen and kitchen linen', chapter: '63', section: 'Made-up Textiles', defaultGstRate: 5, unit: 'PCS' },
  { code: '6303', type: 'HSN', description: 'Curtains, drapes, interior blinds, bed valances', chapter: '63', section: 'Made-up Textiles', defaultGstRate: 5, unit: 'PCS' },
  { code: '6304', type: 'HSN', description: 'Bedspreads, cushion covers, furnishing articles', chapter: '63', section: 'Made-up Textiles', defaultGstRate: 5, unit: 'PCS' },
  { code: '6305', type: 'HSN', description: 'Sacks and bags for packing of goods', chapter: '63', section: 'Made-up Textiles', defaultGstRate: 5, unit: 'PCS' },
  { code: '6307', type: 'HSN', description: 'Other made-up textile articles (dress patterns, dusters)', chapter: '63', section: 'Made-up Textiles', defaultGstRate: 5, unit: 'PCS' },
  { code: '63079090', type: 'HSN', description: 'Other made-up articles - Miscellaneous textile accessories', chapter: '63', section: 'Made-up Textiles', defaultGstRate: 5, unit: 'PCS' },

  // ============================================
  // Chapter 39: Plastics accessories & packaging
  // ============================================
  { code: '3923', type: 'HSN', description: 'Plastic articles for packing (polybags, poly pouches, PP bags)', chapter: '39', section: 'Packaging', defaultGstRate: 18, unit: 'PCS' },
  { code: '3926', type: 'HSN', description: 'Other articles of plastics (buttons, buckles, snap fasteners)', chapter: '39', section: 'Accessories', defaultGstRate: 18, unit: 'PCS' },

  // ============================================
  // Chapter 48: Paper labels, packaging, tags
  // ============================================
  { code: '4819', type: 'HSN', description: 'Cartons, boxes, cases, bags of paper/paperboard (packaging)', chapter: '48', section: 'Packaging', defaultGstRate: 18, unit: 'PCS' },
  { code: '4821', type: 'HSN', description: 'Paper or paperboard labels of all kinds, printed or not', chapter: '48', section: 'Packaging', defaultGstRate: 18, unit: 'PCS' },

  // ============================================
  // Chapter 49: Printed matter (hangtags, swing tags)
  // ============================================
  { code: '4911', type: 'HSN', description: 'Other printed matter (hangtags, swing tags, price tags, care labels)', chapter: '49', section: 'Packaging', defaultGstRate: 18, unit: 'PCS' },

  // ============================================
  // Chapter 73: Sewing needles & metal articles
  // ============================================
  { code: '7319', type: 'HSN', description: 'Sewing needles, knitting needles, bodkins, crochet hooks', chapter: '73', section: 'Machine Parts', defaultGstRate: 18, unit: 'PCS' },
  { code: '7326', type: 'HSN', description: 'Other articles of iron or steel (hangers, hooks, eyelets)', chapter: '73', section: 'Accessories', defaultGstRate: 18, unit: 'PCS' },

  // ============================================
  // Chapter 83: Metal accessories (clasps, buckles)
  // ============================================
  { code: '8308', type: 'HSN', description: 'Clasps, frames with clasps, buckles, hooks, eyes, eyelets (base metal)', chapter: '83', section: 'Accessories', defaultGstRate: 18, unit: 'PCS' },

  // ============================================
  // Chapter 84: Sewing machines
  // ============================================
  { code: '8452', type: 'HSN', description: 'Sewing machines and parts thereof', chapter: '84', section: 'Machine Parts', defaultGstRate: 18, unit: 'PCS' },

  // ============================================
  // Chapter 96: Buttons, zippers
  // ============================================
  { code: '9606', type: 'HSN', description: 'Buttons, press-fasteners, snap-fasteners, button moulds and parts', chapter: '96', section: 'Accessories', defaultGstRate: 18, unit: 'PCS' },
  { code: '9607', type: 'HSN', description: 'Slide fasteners (zippers) and parts thereof', chapter: '96', section: 'Accessories', defaultGstRate: 18, unit: 'PCS' },
];

const sacCodes: HSNSACEntry[] = [
  // ============================================
  // SAC 9988: Manufacturing / Job Work Services
  // GST 2.0: Textile/apparel job work reduced to 5%
  // ============================================
  { code: '998821', type: 'SAC', description: 'Dyeing services for textiles and textile articles', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998822', type: 'SAC', description: 'Printing services on textiles and textile articles', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998823', type: 'SAC', description: 'Embroidery services on textiles', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998829', type: 'SAC', description: 'Other textile processing services (handwork, smocking, etc.)', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998831', type: 'SAC', description: 'Cutting services for garment manufacturing', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998832', type: 'SAC', description: 'Stitching services for garment manufacturing', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998833', type: 'SAC', description: 'Finishing, washing, ironing services for garments', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998834', type: 'SAC', description: 'Washing and laundry services for textile articles', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998835', type: 'SAC', description: 'Ironing, pressing and pleating services', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },
  { code: '998814', type: 'SAC', description: 'Textile printing on customer-owned material', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },

  // Composite job work (general textile/apparel)
  { code: '9988', type: 'SAC', description: 'Job work in relation to textile yarn/fabric/garments (composite)', chapter: '99', section: 'Manufacturing Services', defaultGstRate: 5, unit: 'JOB' },

  // ============================================
  // SAC 9965: Transportation services
  // ============================================
  { code: '996511', type: 'SAC', description: 'Road transport services of goods by road tankers', chapter: '99', section: 'Transport Services', defaultGstRate: 18, unit: 'JOB' },
  { code: '996512', type: 'SAC', description: 'Road transport services of goods by refrigerated vehicles', chapter: '99', section: 'Transport Services', defaultGstRate: 18, unit: 'JOB' },
  { code: '996519', type: 'SAC', description: 'Other road transport services of goods', chapter: '99', section: 'Transport Services', defaultGstRate: 18, unit: 'JOB' },
  { code: '998871', type: 'SAC', description: 'Transportation services related to manufacturing', chapter: '99', section: 'Transport Services', defaultGstRate: 18, unit: 'JOB' },

  // ============================================
  // SAC 9972: Warehousing & storage
  // ============================================
  { code: '997212', type: 'SAC', description: 'Warehousing and storage services for goods', chapter: '99', section: 'Logistics Services', defaultGstRate: 18, unit: 'JOB' },

  // ============================================
  // SAC 9968: Courier & delivery
  // ============================================
  { code: '996812', type: 'SAC', description: 'Courier and delivery services', chapter: '99', section: 'Logistics Services', defaultGstRate: 18, unit: 'JOB' },

  // ============================================
  // SAC 9983: Other professional services
  // ============================================
  { code: '998346', type: 'SAC', description: 'Testing and quality analysis services', chapter: '99', section: 'Professional Services', defaultGstRate: 18, unit: 'JOB' },
  { code: '998397', type: 'SAC', description: 'Design and technical consultancy services', chapter: '99', section: 'Professional Services', defaultGstRate: 18, unit: 'JOB' },

  // ============================================
  // SAC 9992: Packaging
  // ============================================
  { code: '999210', type: 'SAC', description: 'Packaging services', chapter: '99', section: 'Other Services', defaultGstRate: 18, unit: 'JOB' },
];

async function seedHSNSACMasters() {
  console.log('Seeding HSN/SAC master data (GST 2.0 rates, effective Sep 22, 2025)...');

  const allCodes = [...hsnCodes, ...sacCodes];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of allCodes) {
    try {
      const existing = await prisma.hsn_sac_masters.findUnique({
        where: { code: entry.code },
      });

      if (existing) {
        await prisma.hsn_sac_masters.update({
          where: { code: entry.code },
          data: {
            description: entry.description,
            chapter: entry.chapter || entry.code.substring(0, 2),
            section: entry.section || null,
            defaultGstRate: entry.defaultGstRate,
            unit: entry.unit || null,
            type: entry.type,
          },
        });
        updated++;
      } else {
        await prisma.hsn_sac_masters.create({
          data: {
            code: entry.code,
            type: entry.type,
            description: entry.description,
            chapter: entry.chapter || entry.code.substring(0, 2),
            section: entry.section || null,
            defaultGstRate: entry.defaultGstRate,
            unit: entry.unit || null,
            isActive: true,
          },
        });
        created++;
      }
    } catch (error: any) {
      console.warn(`Skipped ${entry.code}: ${error.message}`);
      skipped++;
    }
  }

  console.log(`\nHSN/SAC seeding complete:`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total HSN codes: ${hsnCodes.length}`);
  console.log(`  Total SAC codes: ${sacCodes.length}`);
  console.log(`  Grand total: ${allCodes.length}`);
}

// Run if executed directly
seedHSNSACMasters()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });

export { seedHSNSACMasters };
