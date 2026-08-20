-- CreateTable
CREATE TABLE `indicador_escalas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projeto_id` INTEGER NOT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `valor_minimo` DECIMAL(16, 2) NOT NULL,
    `valor_maximo` DECIMAL(16, 2) NOT NULL,
    `crescente_melhor` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_escala_projeto_titulo`(`projeto_id`, `titulo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `indicador_escalas` ADD CONSTRAINT `indicador_escalas_projeto_id_fkey` FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
