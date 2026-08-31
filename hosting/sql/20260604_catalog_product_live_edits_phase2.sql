-- FASE 2: Productos manuales y campos comerciales adicionales.
-- Ejecutar despues de 20260604_catalog_product_live_edits.sql si la Fase 1 ya fue aplicada.
-- Seguro para datos existentes: revisa INFORMATION_SCHEMA antes de alterar.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_catalog_live_edit_column $$
CREATE PROCEDURE add_catalog_live_edit_column(
  IN column_name_in VARCHAR(64),
  IN column_definition_in TEXT,
  IN after_column_in VARCHAR(64)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'catalog_product_live_edits'
      AND COLUMN_NAME = column_name_in
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `catalog_product_live_edits` ADD COLUMN `',
      column_name_in,
      '` ',
      column_definition_in,
      ' AFTER `',
      after_column_in,
      '`'
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_catalog_live_edit_index $$
CREATE PROCEDURE add_catalog_live_edit_index(
  IN index_name_in VARCHAR(64),
  IN index_columns_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'catalog_product_live_edits'
      AND INDEX_NAME = index_name_in
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `catalog_product_live_edits` ADD INDEX `',
      index_name_in,
      '` (',
      index_columns_in,
      ')'
    );
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

CALL add_catalog_live_edit_column('brand', 'VARCHAR(190) NULL', 'available') $$
CALL add_catalog_live_edit_column('package_label', 'VARCHAR(190) NULL', 'brand') $$
CALL add_catalog_live_edit_column('category', 'VARCHAR(190) NULL', 'package_label') $$
CALL add_catalog_live_edit_column('is_new', 'TINYINT(1) NOT NULL DEFAULT 0', 'category') $$
CALL add_catalog_live_edit_column('source_type', 'ENUM(''override'',''manual'') NOT NULL DEFAULT ''override''', 'thumbnail_url') $$
CALL add_catalog_live_edit_column('product_payload', 'JSON NULL', 'source_type') $$
CALL add_catalog_live_edit_index('idx_catalog_product_live_edits_source_type', '`source_type`') $$

DROP PROCEDURE IF EXISTS add_catalog_live_edit_column $$
DROP PROCEDURE IF EXISTS add_catalog_live_edit_index $$

DELIMITER ;
