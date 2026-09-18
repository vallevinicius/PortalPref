-- AlterTable
ALTER TABLE `users` ADD COLUMN `email` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `email` ON `users`(`email`);
