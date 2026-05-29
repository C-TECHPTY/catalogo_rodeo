-- Preparacion futura para Push Notifications reales del admin.
-- No activa notificaciones push por si solo. Requiere HTTPS y VAPID keys.

CREATE TABLE IF NOT EXISTS `admin_push_subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `endpoint_hash` CHAR(64) NOT NULL,
  `endpoint` TEXT NOT NULL,
  `p256dh_key` TEXT NOT NULL,
  `auth_key` TEXT NOT NULL,
  `user_agent` VARCHAR(255) NOT NULL DEFAULT '',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_push_subscriptions_endpoint` (`endpoint_hash`),
  KEY `idx_admin_push_subscriptions_user` (`user_id`),
  KEY `idx_admin_push_subscriptions_active` (`is_active`),
  CONSTRAINT `fk_admin_push_subscriptions_user`
    FOREIGN KEY (`user_id`) REFERENCES `catalog_users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
