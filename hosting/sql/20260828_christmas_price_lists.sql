-- Guarda la lista aplicada en proformas/pedidos de Navidad. Migración aditiva e idempotente.
DELIMITER $$
DROP PROCEDURE IF EXISTS add_price_list_column_if_missing $$
CREATE PROCEDURE add_price_list_column_if_missing(IN p_table VARCHAR(64))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = 'price_list'
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `price_list` ENUM(''panama'', ''direct'') NULL DEFAULT NULL');
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END $$
CALL add_price_list_column_if_missing('orders') $$
CALL add_price_list_column_if_missing('order_items') $$
DROP PROCEDURE IF EXISTS add_price_list_column_if_missing $$
DELIMITER ;
