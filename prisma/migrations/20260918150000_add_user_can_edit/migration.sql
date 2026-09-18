-- Adiciona a permissão de edição do usuário. Usado para criar admins supremos
-- "apenas visualização" (ex.: perfil da prefeita), que acompanham todas as
-- secretarias mas não podem criar, editar ou excluir nada.
ALTER TABLE `users` ADD COLUMN `can_edit` BOOLEAN NOT NULL DEFAULT true;
