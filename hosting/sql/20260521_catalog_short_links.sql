-- Links cortos internos para catalogos compartidos.
-- Seguro: crea tabla nueva y no cambia los links largos existentes.

CREATE TABLE IF NOT EXISTS `catalog_short_links` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `share_link_id` BIGINT UNSIGNED NOT NULL,
  `catalog_id` BIGINT UNSIGNED NOT NULL,
  `seller_id` BIGINT UNSIGNED DEFAULT NULL,
  `client_id` BIGINT UNSIGNED DEFAULT NULL,
  `code` VARCHAR(24) NOT NULL,
  `open_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `last_opened_at` DATETIME DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_short_links_share` (`share_link_id`),
  UNIQUE KEY `uq_catalog_short_links_code` (`code`),
  KEY `idx_catalog_short_links_catalog` (`catalog_id`),
  KEY `idx_catalog_short_links_seller` (`seller_id`),
  CONSTRAINT `fk_catalog_short_links_share`
    FOREIGN KEY (`share_link_id`) REFERENCES `catalog_share_links` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_catalog_short_links_catalog`
    FOREIGN KEY (`catalog_id`) REFERENCES `catalogs` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
