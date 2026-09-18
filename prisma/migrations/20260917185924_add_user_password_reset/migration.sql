-- AlterTable
ALTER TABLE `users`
  ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `password_reset_token` VARCHAR(255) NULL,
  ADD COLUMN `password_reset_expires` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `password_reset_token` ON `users`(`password_reset_token`);
