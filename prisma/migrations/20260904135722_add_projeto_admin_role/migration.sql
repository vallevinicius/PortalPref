-- AlterTable: add the new role value to the enum
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('super_admin', 'secretaria_admin', 'projeto_admin') NOT NULL;

-- AlterTable: add the nullable projeto_id column
ALTER TABLE `users` ADD COLUMN `projeto_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `users_projeto_id_idx` ON `users`(`projeto_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_projeto_id_fkey` FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
