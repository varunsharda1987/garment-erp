-- T2-1 Stage D: retire unified_stock_view. It was meant to be the derived source of truth but
-- wrongly aggregated stock_levels (the hand-maintained ledger) instead of the per-lot tables —
-- derived_stock_view (20260620...) is the real one. Its last reader (GET /stock-levels/unified,
-- zero frontend callers, and a SELECT * whose declared stockValue column the view never had)
-- was removed in the same change that lands this migration.
DROP VIEW IF EXISTS unified_stock_view;
