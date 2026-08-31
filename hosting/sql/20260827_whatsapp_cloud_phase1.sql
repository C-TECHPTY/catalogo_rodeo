-- Fase 1 WhatsApp Cloud API. Migracion aditiva e idempotente.
CREATE TABLE IF NOT EXISTS `whatsapp_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `direction` ENUM('inbound','outbound') NOT NULL,
  `event_type` VARCHAR(40) NOT NULL DEFAULT 'unknown',
  `provider_message_id` VARCHAR(190) NOT NULL,
  `phone` VARCHAR(80) NOT NULL DEFAULT '',
  `seller_id` BIGINT UNSIGNED NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'received',
  `payload_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_whatsapp_messages_provider_id` (`provider_message_id`),
  KEY `idx_whatsapp_messages_seller_created` (`seller_id`, `created_at`), KEY `idx_whatsapp_messages_status_created` (`status`, `created_at`),
  CONSTRAINT `fk_whatsapp_messages_seller` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_delivery_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `whatsapp_message_id` BIGINT UNSIGNED NULL, `provider_message_id` VARCHAR(190) NOT NULL DEFAULT '',
  `status` VARCHAR(40) NOT NULL, `error_message` VARCHAR(500) NOT NULL DEFAULT '', `occurred_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_whatsapp_delivery_provider` (`provider_message_id`), KEY `idx_whatsapp_delivery_message` (`whatsapp_message_id`),
  CONSTRAINT `fk_whatsapp_delivery_message` FOREIGN KEY (`whatsapp_message_id`) REFERENCES `whatsapp_messages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
