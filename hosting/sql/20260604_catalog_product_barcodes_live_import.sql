-- FASE SEGURA: guardar codigo de barra en la capa viva e indexarlo para Listas sala.
-- No borra datos. Ejecutar despues de:
-- 20260604_catalog_product_live_edits.sql
-- 20260604_catalog_product_live_edits_phase2.sql
-- 20260604_catalog_scan_lists_phase1.sql

DELIMITER $$

DROP PROCEDURE IF EXISTS add_catalog_live_barcode_column $$
CREATE PROCEDURE add_catalog_live_barcode_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'catalog_product_live_edits'
      AND COLUMN_NAME = 'barcode'
  ) THEN
    ALTER TABLE `catalog_product_live_edits`
      ADD COLUMN `barcode` VARCHAR(120) NULL AFTER `category`;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_catalog_live_barcode_index $$
CREATE PROCEDURE add_catalog_live_barcode_index()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'catalog_product_live_edits'
      AND INDEX_NAME = 'idx_catalog_product_live_edits_barcode'
  ) THEN
    ALTER TABLE `catalog_product_live_edits`
      ADD INDEX `idx_catalog_product_live_edits_barcode` (`catalog_id`, `barcode`);
  END IF;
END $$

CALL add_catalog_live_barcode_column() $$
CALL add_catalog_live_barcode_index() $$

DROP PROCEDURE IF EXISTS add_catalog_live_barcode_column $$
DROP PROCEDURE IF EXISTS add_catalog_live_barcode_index $$

DELIMITER ;
