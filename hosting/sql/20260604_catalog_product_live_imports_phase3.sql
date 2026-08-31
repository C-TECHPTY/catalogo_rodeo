-- FASE 3: Importacion incremental CSV/XLSX a la capa viva MySQL.
-- Seguro para datos existentes: solo crea tabla de logs.

CREATE TABLE IF NOT EXISTS `catalog_product_live_import_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_id` BIGINT UNSIGNED NOT NULL,
  `admin_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `filename` VARCHAR(190) NOT NULL DEFAULT '',
  `total_rows` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `skipped_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `error_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_product_live_import_logs_catalog_id` (`catalog_id`),
  KEY `idx_catalog_product_live_import_logs_user` (`admin_user_id`),
  KEY `idx_catalog_product_live_import_logs_created_at` (`created_at`),
  CONSTRAINT `fk_catalog_product_live_import_logs_catalog_id`
    FOREIGN KEY (`catalog_id`) REFERENCES `catalogs` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_catalog_product_live_import_logs_user`
    FOREIGN KEY (`admin_user_id`) REFERENCES `catalog_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
