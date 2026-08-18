-- CreateTable
CREATE TABLE `login_throttles` (
    `key` CHAR(64) NOT NULL,
    `failed_attempts` INTEGER NOT NULL DEFAULT 0,
    `window_started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `blocked_until` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `login_throttles_blocked_until_idx`(`blocked_until`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
