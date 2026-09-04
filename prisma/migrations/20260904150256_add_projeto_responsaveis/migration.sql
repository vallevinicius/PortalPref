-- CreateTable
CREATE TABLE `projeto_responsaveis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `projeto_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_projeto_responsaveis_user_projeto`(`user_id`, `projeto_id`),
    INDEX `projeto_responsaveis_projeto_id_idx`(`projeto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill: migrate existing single user->projeto links into the join table
INSERT INTO `projeto_responsaveis` (`user_id`, `projeto_id`, `created_at`)
SELECT `id`, `projeto_id`, NOW(3) FROM `users` WHERE `projeto_id` IS NOT NULL;

-- AddForeignKey
ALTER TABLE `projeto_responsaveis` ADD CONSTRAINT `projeto_responsaveis_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projeto_responsaveis` ADD CONSTRAINT `projeto_responsaveis_projeto_id_fkey` FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey: remove the old single-project link on users
ALTER TABLE `users` DROP FOREIGN KEY `users_projeto_id_fkey`;

-- DropIndex
DROP INDEX `users_projeto_id_idx` ON `users`;

-- AlterTable: drop the old single-project column now that data lives in projeto_responsaveis
ALTER TABLE `users` DROP COLUMN `projeto_id`;
