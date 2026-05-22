-- Catalogos automaticos por rotacion - Fase 1 hosting
-- Fecha: 2026-05-18
-- Modo seguro: solo crea tablas nuevas y deja el modulo apagado por defecto.

CREATE TABLE IF NOT EXISTS `auto_catalog_rules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  `slug_prefix` VARCHAR(120) NOT NULL DEFAULT 'auto-catalogo',
  `base_catalog_id` BIGINT UNSIGNED NOT NULL,
  `product_limit` INT UNSIGNED NOT NULL DEFAULT 24,
  `no_repeat_days` INT UNSIGNED NOT NULL DEFAULT 14,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_by_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_auto_catalog_rules_active` (`is_active`),
  KEY `idx_auto_catalog_rules_base_catalog` (`base_catalog_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auto_catalog_runs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rule_id` BIGINT UNSIGNED NOT NULL,
  `base_catalog_id` BIGINT UNSIGNED NOT NULL,
  `generated_catalog_id` BIGINT UNSIGNED DEFAULT NULL,
  `slug` VARCHAR(190) NOT NULL DEFAULT '',
  `public_url` VARCHAR(255) NOT NULL DEFAULT '',
  `internal_seller_url` VARCHAR(255) NOT NULL DEFAULT '',
  `whatsapp_message` TEXT NULL,
  `run_token` CHAR(64) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'queued',
  `selected_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `error_message` TEXT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `finished_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auto_catalog_runs_token` (`run_token`),
  KEY `idx_auto_catalog_runs_rule` (`rule_id`),
  KEY `idx_auto_catalog_runs_catalog` (`generated_catalog_id`),
  KEY `idx_auto_catalog_runs_status` (`status`),
  KEY `idx_auto_catalog_runs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auto_catalog_run_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `run_id` BIGINT UNSIGNED NOT NULL,
  `rule_id` BIGINT UNSIGNED NOT NULL,
  `base_catalog_id` BIGINT UNSIGNED NOT NULL,
  `generated_catalog_id` BIGINT UNSIGNED DEFAULT NULL,
  `item_code` VARCHAR(120) NOT NULL,
  `product_hash` CHAR(40) NOT NULL DEFAULT '',
  `brand` VARCHAR(190) NOT NULL DEFAULT '',
  `category` VARCHAR(190) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_auto_catalog_run_items_recent` (`rule_id`, `item_code`, `created_at`),
  KEY `idx_auto_catalog_run_items_run` (`run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auto_catalog_seller_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `run_id` BIGINT UNSIGNED NOT NULL,
  `generated_catalog_id` BIGINT UNSIGNED DEFAULT NULL,
  `seller_name` VARCHAR(140) NOT NULL,
  `seller_token` CHAR(64) NOT NULL,
  `client_url` VARCHAR(255) NOT NULL DEFAULT '',
  `ip_address` VARCHAR(64) NOT NULL DEFAULT '',
  `user_agent` VARCHAR(255) NOT NULL DEFAULT '',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_opened_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auto_catalog_seller_sessions_token` (`seller_token`),
  KEY `idx_auto_catalog_seller_sessions_run` (`run_id`),
  KEY `idx_auto_catalog_seller_sessions_catalog` (`generated_catalog_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `app_settings` (`setting_key`, `setting_value`) VALUES
('auto_catalogs_enabled', '0'),
('auto_catalogs_api_key', '')
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;
