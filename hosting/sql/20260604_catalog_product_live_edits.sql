-- FASE 1: Edicion viva de productos desde dashboard.
-- Seguro para datos existentes: solo crea tablas nuevas.
-- Electron y catalog_json_path siguen funcionando como fuente base.

CREATE TABLE IF NOT EXISTS `catalog_product_live_edits` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_id` BIGINT UNSIGNED NOT NULL,
  `item_code` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `price` VARCHAR(80) NULL,
  `available` VARCHAR(80) NULL,
  `brand` VARCHAR(190) NULL,
  `package_label` VARCHAR(190) NULL,
  `category` VARCHAR(190) NULL,
  `is_new` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `image_url` VARCHAR(500) NULL,
  `thumbnail_url` VARCHAR(500) NULL,
  `source_type` ENUM('override','manual') NOT NULL DEFAULT 'override',
  `product_payload` JSON NULL,
  `created_by_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `updated_by_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_product_live_edits_catalog_item` (`catalog_id`, `item_code`),
  KEY `idx_catalog_product_live_edits_catalog_id` (`catalog_id`),
  KEY `idx_catalog_product_live_edits_item_code` (`item_code`),
  KEY `idx_catalog_product_live_edits_is_active` (`is_active`),
  KEY `idx_catalog_product_live_edits_source_type` (`source_type`),
  KEY `idx_catalog_product_live_edits_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_catalog_product_live_edits_catalog_id`
    FOREIGN KEY (`catalog_id`) REFERENCES `catalogs` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_catalog_product_live_edits_created_by`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `catalog_users` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_catalog_product_live_edits_updated_by`
    FOREIGN KEY (`updated_by_user_id`) REFERENCES `catalog_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `catalog_product_live_edit_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_id` BIGINT UNSIGNED NOT NULL,
  `item_code` VARCHAR(120) NOT NULL,
  `admin_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `field_name` VARCHAR(80) NOT NULL,
  `old_value` TEXT NULL,
  `new_value` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_product_live_edit_history_catalog_item` (`catalog_id`, `item_code`),
  KEY `idx_catalog_product_live_edit_history_user` (`admin_user_id`),
  KEY `idx_catalog_product_live_edit_history_created` (`created_at`),
  CONSTRAINT `fk_catalog_product_live_edit_history_catalog_id`
    FOREIGN KEY (`catalog_id`) REFERENCES `catalogs` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_catalog_product_live_edit_history_user`
    FOREIGN KEY (`admin_user_id`) REFERENCES `catalog_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
