-- LGPD: ninguem alem do proprio usuario deve poder saber a senha dele.
-- Remove de vez a copia criptografada reversivel das senhas (so era usada
-- pelos antigos botoes "Ver senha atual"/"Gerar nova senha").
ALTER TABLE `users` DROP COLUMN `password_encrypted`;
