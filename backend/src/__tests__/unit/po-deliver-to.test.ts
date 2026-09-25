import { resolvePoDeliverTo, TO_BE_ADVISED_LINE } from '../../services/document-data/po-deliver-to';

const OUR_ADDRESS = 'H-1, 51, RIICO Industrial Area, Mansarovar, Jaipur 302020';

describe('resolvePoDeliverTo — the Deliver To of a printed PO', () => {
  it('no location → "to be advised", never our own address', () => {
    const d = resolvePoDeliverTo(null, OUR_ADDRESS);
    expect(d.toBeAdvised).toBe(true);
    expect(d.oneLine).toBe(TO_BE_ADVISED_LINE);
    expect(d.oneLine).not.toContain('RIICO');
    expect(d.placeName).toBe('the address we confirm before dispatch');
  });

  it('our own store with no address of its own → the Company Profile address', () => {
    const d = resolvePoDeliverTo(
      { warehouseName: 'Kashaya Fabs', warehouseType: 'RAW_MATERIAL', address: null, city: null, pincode: null },
      OUR_ADDRESS
    );
    expect(d.oneLine).toBe(`Kashaya Fabs — ${OUR_ADDRESS}`);
    expect(d.addressLines).toEqual([OUR_ADDRESS]);
    expect(d.placeName).toBe('Kashaya Fabs');
  });

  it('a store with its own address → its own address', () => {
    const d = resolvePoDeliverTo(
      {
        warehouseName: 'Godown 2',
        warehouseType: 'RAW_MATERIAL',
        address: 'Plot 7',
        city: 'Jaipur',
        pincode: '302013',
      },
      OUR_ADDRESS
    );
    expect(d.oneLine).toBe('Godown 2 — Plot 7, Jaipur 302013');
  });

  it("a processor's unit never borrows our address", () => {
    const d = resolvePoDeliverTo(
      {
        warehouseName: 'Aryan Dyeing - Processing Unit',
        warehouseType: 'JOB_WORK',
        address: null,
        city: null,
        pincode: null,
      },
      OUR_ADDRESS
    );
    expect(d.oneLine).toBe('Aryan Dyeing - Processing Unit');
    expect(d.addressLines).toEqual([]);
  });
});
