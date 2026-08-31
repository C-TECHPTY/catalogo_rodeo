CREATE TABLE IF NOT EXISTS `catalog_product_barcodes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_id` BIGINT UNSIGNED DEFAULT NULL,
  `item_code` VARCHAR(120) NOT NULL,
  `barcode` VARCHAR(120) NOT NULL,
  `label_text` VARCHAR(255) DEFAULT NULL,
  `created_by_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_product_barcodes_catalog_barcode` (`catalog_id`, `barcode`),
  KEY `idx_catalog_product_barcodes_item` (`catalog_id`, `item_code`),
  KEY `idx_catalog_product_barcodes_barcode` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `catalog_scan_lists` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  `base_catalog_id` BIGINT UNSIGNED NOT NULL,
  `category_label` VARCHAR(120) DEFAULT NULL,
  `status` ENUM('draft','generated','archived') NOT NULL DEFAULT 'draft',
  `generated_catalog_id` BIGINT UNSIGNED DEFAULT NULL,
  `notes` TEXT NULL,
  `created_by_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_scan_lists_base` (`base_catalog_id`),
  KEY `idx_catalog_scan_lists_status` (`status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `catalog_scan_list_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `list_id` BIGINT UNSIGNED NOT NULL,
  `item_code` VARCHAR(120) NOT NULL,
  `barcode` VARCHAR(120) DEFAULT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `quantity_hint` INT UNSIGNED NOT NULL DEFAULT 1,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_by_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_scan_list_items_list_item` (`list_id`, `item_code`),
  KEY `idx_catalog_scan_list_items_barcode` (`barcode`),
  CONSTRAINT `fk_catalog_scan_list_items_list_id`
    FOREIGN KEY (`list_id`) REFERENCES `catalog_scan_lists` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
