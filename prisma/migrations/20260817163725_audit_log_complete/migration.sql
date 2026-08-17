-- DropForeignKey
ALTER TABLE `audit_log` DROP FOREIGN KEY `audit_log_target_user_id_fkey`;

-- AlterTable
ALTER TABLE `audit_log` ADD COLUMN `details` JSON NULL,
    ADD COLUMN `entity_id` INTEGER NULL,
    ADD COLUMN `entity_type` VARCHAR(40) NOT NULL DEFAULT 'user',
    MODIFY `action` VARCHAR(80) NOT NULL,
    MODIFY `target_user_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `audit_log_entity_type_action_idx` ON `audit_log`(`entity_type`, `action`);

-- CreateIndex
CREATE INDEX `audit_log_created_at_idx` ON `audit_log`(`created_at`);

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_target_user_id_fkey` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
