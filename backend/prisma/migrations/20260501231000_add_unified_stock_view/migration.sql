-- CreateView: unified_stock_view
-- Aggregates all stock levels with material and warehouse information
-- Used by stockLevel.service.ts for unified stock queries

DROP VIEW IF EXISTS unified_stock_view;

CREATE VIEW unified_stock_view AS
SELECT
  sl.id,
  sl."materialId",
  m.code AS "materialCode",
  m.name AS "materialName",
  m."materialType" AS "materialType",
  sl."warehouseId",
  w."warehouseName",
  w."warehouseCode",
  sl.quantity,
  sl.unit,
  sl."lastUpdated"
FROM stock_levels sl
JOIN materials m ON sl."materialId" = m.id
LEFT JOIN warehouses w ON sl."warehouseId" = w.id;
