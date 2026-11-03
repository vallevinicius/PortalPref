-- AlterTable
ALTER TABLE `indicadores` ADD COLUMN `tipo_grafico` VARCHAR(10) NOT NULL DEFAULT 'barras',
    ADD COLUMN `categoria` VARCHAR(120) NULL;
