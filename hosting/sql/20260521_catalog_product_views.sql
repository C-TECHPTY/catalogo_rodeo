-- Contadores globales de vistas por producto.
-- Seguro: crea una tabla nueva y no altera pedidos ni catalogos existentes.

CREATE TABLE IF NOT EXISTS `catalog_product_view_counters` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_id` BIGINT UNSIGNED NOT NULL,
  `item_code` VARCHAR(120) NOT NULL,
  `item_name` VARCHAR(255) NOT NULL DEFAULT '',
  `category` VARCHAR(160) NOT NULL DEFAULT '',
  `view_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `last_viewed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_product_view_counter` (`catalog_id`, `item_code`),
  KEY `idx_catalog_product_views_catalog_count` (`catalog_id`, `view_count`),
  KEY `idx_catalog_product_views_last` (`last_viewed_at`),
  CONSTRAINT `fk_catalog_product_views_catalog_id`
    FOREIGN KEY (`catalog_id`) REFERENCES `catalogs` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
