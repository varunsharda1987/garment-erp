/**
 * "An open PO covers this, not linked" on the Requirements page: how the note reads, what Link opens, the label
 * heading's size coverage, and the linked rows' "PO… · qty".
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkedPOList, LinkPOButton, OpenPOSupplyNote } from '../OpenPOSupplyNote';
import {
  distinctSupplyLines,
  linkedPOTexts,
  openPOSizeCoverage,
  openPOSupplyWords,
  poLinkTargets,
} from '../open-po-supply';
import type { MaterialRequirement, OpenPOSupplyLine, RequirementPOLink } from '@/types/mrp.types';

const line = (extra: Partial<OpenPOSupplyLine> = {}): OpenPOSupplyLine => ({
  purchaseOrderId: 'po-231',
  poNumber: 'PO2609-0231',
  poStatus: 'SENT',
  poCategory: 'ACCESSORIES',
  supplierName: 'Label House',
  expectedDeliveryDate: '2026-10-20T00:00:00.000Z',
  purchaseOrderItemId: 'item-xs',
  lineUnit: 'PIECE',
  stockUnitsPerUnit: null,
  orderedStockQty: 4530,
  arrivedQty: 0,
  allocatedQty: 2941,
  freeToLink: 1589,
  arrivedFree: 0,
  toCome: 4530,
  unlinkedDemandQty: 2941,
  deliversTo: null,
  linkable: true,
  blockedReason: null,
  arrivesLate: false,
  ...extra,
});

let n = 0;
const req = (extra: Partial<MaterialRequirement> = {}): MaterialRequirement => {
  n += 1;
  return {
    id: `req-${n}`,
    requirementNumber: `MR2609-${String(n).padStart(4, '0')}`,
    materialId: 'lbl-xs',
    unit: 'PIECE',
    status: 'PO_REQUIRED',
    shortfall: 350,
    totalRequired: 350,
    openPOSupply: [line()],
    ...extra,
  } as unknown as MaterialRequirement;
};

const poLink = (extra: Partial<RequirementPOLink> = {}): RequirementPOLink =>
  ({
    id: `link-${(n += 1)}`,
    requirementId: 'r',
    purchaseOrderId: 'po-231',
    purchaseOrderItemId: 'item-xs',
    allocatedQuantity: 350,
    receivedQuantity: 0,
    createdAt: '2026-09-28T00:00:00.000Z',
    purchaseOrder: { id: 'po-231', poNumber: 'PO2609-0231', status: 'SENT', supplierId: 's' },
    ...extra,
  }) as RequirementPOLink;

describe('openPOSupplyWords', () => {
  it('reads "PO · N free · not linked (unlinked orders need M)" for one line with nothing arrived', () => {
    const words = openPOSupplyWords([line()], 'PIECE');
    expect(words?.headline).toBe('PO2609-0231 · 1,589 pcs free · not linked (unlinked orders need 2,941 pcs)');
    expect(words?.details).toEqual([]);
    expect(words?.blockedReason).toBeNull();
    expect(words?.title).toContain('PO2609-0231 — Label House');
  });

  it('splits what is here from what is to come, and says where greige delivers and when it is late', () => {
    const words = openPOSupplyWords(
      [
        line({
          arrivedQty: 3500,
          arrivedFree: 559,
          deliversTo: [{ pool: 'sup-mangal', name: 'Mangal Dyeing' }],
          arrivesLate: true,
          expectedDeliveryDate: '2026-11-05T00:00:00.000Z',
        }),
      ],
      'PIECE'
    );
    expect(words?.details).toEqual([
      '559 pcs here + 1,030 pcs to come',
      'delivers to Mangal Dyeing',
      'due 05-Nov-2026 — after it is needed',
    ]);
  });

  it('adds up several POs, and names the one when both lines are on it', () => {
    const two = openPOSupplyWords(
      [
        line(),
        line({ purchaseOrderId: 'po-4', poNumber: 'PO2609-0004', purchaseOrderItemId: 'item-4', freeToLink: 411 }),
      ],
      'PIECE'
    );
    expect(two?.headline).toBe('2 open POs · 2,000 pcs free · not linked (unlinked orders need 2,941 pcs)');

    const oneOfTwoLines = openPOSupplyWords(
      [line(), line({ purchaseOrderItemId: 'item-xs-2', freeToLink: 11 })],
      'PIECE'
    );
    expect(oneOfTwoLines?.headline.startsWith('PO2609-0231 · 1,600 pcs free')).toBe(true);
  });

  it('says why a line cannot be linked when none can', () => {
    const words = openPOSupplyWords(
      [line({ linkable: false, freeToLink: 0, blockedReason: '559 pcs arrived as stock — Use Stock' })],
      'PIECE'
    );
    expect(words?.headline).toBe('PO2609-0231 · not linked');
    expect(words?.blockedReason).toBe('559 pcs arrived as stock — Use Stock');
  });

  it('is nothing without a line', () => {
    expect(openPOSupplyWords([], 'PIECE')).toBeNull();
    expect(openPOSupplyWords(undefined, 'PIECE')).toBeNull();
  });
});

describe('poLinkTargets', () => {
  it('one target per PO: its lines and the requirements that fit, soonest expected first', () => {
    const xs1 = req();
    const xs2 = req({ openPOSupply: [line({ freeToLink: 1200 })] });
    const s = req({ materialId: 'lbl-s', openPOSupply: [line({ purchaseOrderItemId: 'item-s', freeToLink: 2369 })] });
    const early = req({
      openPOSupply: [
        line({
          purchaseOrderId: 'po-4',
          poNumber: 'PO2609-0004',
          purchaseOrderItemId: 'item-4',
          expectedDeliveryDate: '2026-10-01T00:00:00.000Z',
          freeToLink: 10,
        }),
      ],
    });
    const blocked = req({
      openPOSupply: [line({ purchaseOrderItemId: 'item-m', linkable: false, blockedReason: 'x' })],
    });

    const targets = poLinkTargets([xs1, xs2, s, early, blocked]);
    expect(targets.map((t) => t.poNumber)).toEqual(['PO2609-0004', 'PO2609-0231']);
    const po231 = targets[1];
    expect(po231.itemIds).toEqual(['item-xs', 'item-s']);
    expect(po231.focusRequirementIds).toEqual([xs1.id, xs2.id, s.id]);
    // a line counts once, at the most any of its rows can take
    expect(po231.freeToLink).toBe(1589 + 2369);
  });

  it('keeps the larger free figure of a line reached by several rows', () => {
    const lines = distinctSupplyLines([req({ openPOSupply: [line({ freeToLink: 5 })] }), req()]);
    expect(lines).toHaveLength(1);
    expect(lines[0].freeToLink).toBe(1589);
  });
});

describe('openPOSizeCoverage', () => {
  it('counts the sizes still waiting for a PO that an open PO could take', () => {
    const rows = [
      { requirements: [req()] },
      { requirements: [req({ openPOSupply: [] })] },
      { requirements: [req({ status: 'PO_SENT', openPOSupply: [] })] },
    ];
    expect(openPOSizeCoverage(rows)).toEqual({ covered: 1, waiting: 2 });
    expect(openPOSizeCoverage([{ requirements: [req({ openPOSupply: [] })] }])).toBeNull();
  });
});

describe('linkedPOTexts', () => {
  it('reads "PO · qty" per PO, a size’s colours added together', () => {
    const reqs = [
      req({ poLinks: [poLink({ allocatedQuantity: 200 })] }),
      req({ poLinks: [poLink({ allocatedQuantity: 150 })] }),
      req({ poLinks: [] }),
    ];
    expect(linkedPOTexts(reqs, 'PIECE')).toEqual(['PO2609-0231 · 350 pcs']);
  });
});

describe('components', () => {
  it('shows the note to everyone and Link opens the target', () => {
    const r = req();
    const onLink = vi.fn();
    render(
      <>
        <OpenPOSupplyNote supply={r.openPOSupply} unit="PIECE" />
        <LinkPOButton reqs={[r]} onLink={onLink} />
      </>
    );
    expect(screen.getByTestId('open-po-supply-note').textContent).toContain(
      'PO2609-0231 · 1,589 pcs free · not linked'
    );
    fireEvent.click(screen.getByRole('button', { name: /link/i }));
    expect(onLink).toHaveBeenCalledWith(
      expect.objectContaining({ poId: 'po-231', itemIds: ['item-xs'], focusRequirementIds: [r.id] })
    );
  });

  it('has no Link when nothing can be linked, and shows the linked PO with its quantity', () => {
    const linked = req({ status: 'PO_SENT', openPOSupply: undefined, poLinks: [poLink()] });
    const { container } = render(
      <>
        <LinkPOButton reqs={[linked]} onLink={vi.fn()} />
        <LinkedPOList reqs={[linked]} unit="PIECE" />
      </>
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toBe('PO2609-0231 · 350 pcs');
  });

  it('offers a menu when several POs can take it', () => {
    const r = req({
      openPOSupply: [line(), line({ purchaseOrderId: 'po-4', poNumber: 'PO2609-0004', purchaseOrderItemId: 'item-4' })],
    });
    render(<LinkPOButton reqs={[r]} onLink={vi.fn()} label="Link sizes" />);
    const trigger = screen.getByRole('button', { name: /link sizes/i });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  });
});
