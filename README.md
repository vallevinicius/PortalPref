# PortalPref — Dashboard de Projetos

Aplicação Next.js para gerenciamento de secretarias, projetos e indicadores, utilizando **MySQL**, **Prisma ORM** e migrations versionadas.

## 1. Pré-requisitos

Antes de iniciar, instale os seguintes componentes:

| Componente | Versão/requisito |
|---|---|
| Node.js | 20 ou superior; Node 22 LTS é recomendado |
| npm | Incluído com o Node.js |
| MySQL ou MariaDB | Servidor acessível localmente ou por rede |
| Git | Necessário para alternar para a branch da implementação |

O projeto não inicia o servidor MySQL automaticamente. Você pode usar uma instalação local, XAMPP, Laragon, Docker ou um servidor MySQL já existente.

## 2. Obter a branch da implementação

Abra o PowerShell ou o terminal na pasta onde o projeto foi clonado e execute:

```powershell
git fetch --all
git switch feat/prisma-migrations-tests
```

Confirme a branch atual:

```powershell
git branch --show-current
```

O resultado esperado é:

```text
feat/prisma-migrations-tests
```

## 3. Instalar as dependências

Na raiz do projeto, execute:

```powershell
npm install
```

Esse comando instala o Next.js, Prisma, o cliente Prisma, Vitest, ESLint e as demais dependências do projeto.

## 4. Criar e configurar o arquivo `.env`

Copie o modelo de ambiente versionado:

```powershell
Copy-Item .env.example .env
```

No Prompt de Comando do Windows, o equivalente é:

```cmd
copy .env.example .env
```

Abra o arquivo `.env` e configure os valores reais. Um exemplo para um MySQL local é:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=portal_pref
DB_PASSWORD=sua_senha_mysql
DB_NAME=portal_pref

DATABASE_URL=mysql://portal_pref:sua_senha_mysql@127.0.0.1:3306/portal_pref

SESSION_SECRET=troque-por-um-segredo-longo-e-aleatorio
PASSWORD_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

ADMIN_USERNAME=admin
ADMIN_PASSWORD=troque-esta-senha
```

`DATABASE_URL` é usada pelo Prisma. As variáveis `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` são usadas pelo comando que cria o banco antes da aplicação das migrations.

Se a senha do MySQL possuir caracteres especiais, como `@`, `#`, `/`, `:` ou espaços, faça URL encoding na senha dentro de `DATABASE_URL`. Por exemplo, `p@ss word` deve ser representada como `p%40ss%20word`.

Nunca versione o arquivo `.env` nem compartilhe os valores reais de `SESSION_SECRET`, `PASSWORD_ENCRYPTION_KEY` ou `ADMIN_PASSWORD`.

## 5. Criar o banco e aplicar as migrations

Com o MySQL em execução e as credenciais configuradas, rode:

```powershell
npm run db:setup
```

Esse comando executa, em sequência:

```powershell
npm run db:create
npm run prisma:migrate:deploy
```

O primeiro comando cria o banco definido em `DB_NAME`, caso ele ainda não exista. O segundo aplica as migrations presentes em `prisma/migrations` sem criar alterações interativas.

Você também pode executar as etapas separadamente:

```powershell
npm run db:create
npm run prisma:generate
npm run prisma:migrate:deploy
```

Confira o estado do histórico Prisma sem alterar o banco:

```powershell
npx prisma migrate status
```

### Banco já existente

Se o banco já possui as tabelas do projeto, faça um backup antes de qualquer procedimento. A migration inicial foi criada para bancos novos. Não execute `migrate deploy` cegamente em um banco legado que ainda não possui o histórico `_prisma_migrations`, pois o Prisma pode tentar criar tabelas que já existem.

Quando o schema existente for comprovadamente equivalente à migration inicial, o histórico pode ser marcado como aplicado com:

```powershell
npx prisma migrate resolve --applied 20260817134219_init
```

Use esse comando somente depois de comparar o schema real com `prisma/schema.prisma` e com `prisma/migrations/20260817134219_init/migration.sql`.

## 6. Gerar o cliente Prisma

Sempre que o `schema.prisma` for alterado, gere novamente o cliente:

```powershell
npm run prisma:generate
```

O cliente gerado fica em `node_modules/@prisma/client` e não deve ser versionado manualmente.

## 7. Popular os dados iniciais

Depois que as migrations estiverem aplicadas, rode os seeds na seguinte ordem:

```powershell
npm run db:seed
npm run db:seed-secretarias
npm run db:seed-metricas
```

O primeiro comando cria ou atualiza o administrador supremo usando `ADMIN_USERNAME` e `ADMIN_PASSWORD`. O segundo cadastra as secretarias padrão. O terceiro cria os projetos/métricas associados às secretarias encontradas.

Os seeds de secretarias e métricas são idempotentes: executá-los novamente não deve duplicar registros protegidos por constraints únicas.

## 8. Iniciar o site em desenvolvimento

Execute:

```powershell
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador. Use `ADMIN_USERNAME` e `ADMIN_PASSWORD` do `.env` para entrar como administrador supremo.

A aplicação possui as principais rotas abaixo:

| Rota | Finalidade |
|---|---|
| `/` | Página inicial/login |
| `/admin` | Dashboard administrativo |
| `/admin/secretarias/:secretariaId` | Projetos e indicadores de uma secretaria |
| `/admin/projetos/:projetoId` | Detalhes e edição de um projeto |
| `/api/auth/login` | Login via API |
| `/api/auth/logout` | Encerramento da sessão |

## 9. Executar os testes unitários

Para executar todos os testes uma vez:

```powershell
npm test
```

Para executar em modo de observação durante o desenvolvimento:

```powershell
npm run test:watch
```

Para gerar cobertura, caso o provider de cobertura esteja instalado no ambiente:

```powershell
npm run test:coverage
```

A suíte criada para esta implementação cobre as ações de secretarias, projetos, indicadores e usuários, a camada de leitura agregada, o login e o singleton de configuração do Prisma. Os testes utilizam mocks do Prisma e não dependem de um banco real.

## 10. Executar lint, TypeScript e build

Use os comandos abaixo antes de abrir um pull request:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

O build de produção pode carregar as variáveis de `.env`, portanto mantenha o arquivo configurado mesmo quando o objetivo for apenas validar a compilação.

## 11. Abrir o Prisma Studio

Para inspecionar os registros pelo painel do Prisma:

```powershell
npm run prisma:studio
```

O comando abre o Prisma Studio em uma porta local informada pelo terminal. Feche o processo com `Ctrl+C` quando terminar.

## 12. Criar uma nova migration

Quando uma alteração de banco for necessária, edite `prisma/schema.prisma`, gere uma migration nomeada e valide o resultado:

```powershell
npm run prisma:migrate -- --name nome_da_alteracao
npm run prisma:generate
npx prisma migrate status
npm test
npm run lint
npm run build
```

A pasta criada em `prisma/migrations` deve ser versionada junto com a alteração do schema. Não edite migrations já aplicadas em outros ambientes; crie uma nova migration.

## 13. Resetar um banco de desenvolvimento

O comando abaixo é destrutivo: ele apaga os dados do banco configurado e reaplica o histórico de migrations.

```powershell
npx prisma migrate reset
```

Use-o somente em banco descartável de desenvolvimento. Nunca execute esse comando contra produção ou contra uma base contendo dados que não estejam protegidos por backup.

## 14. Solução de problemas comuns

| Problema | Verificação/recomendação |
|---|---|
| `Can't reach database server` | Confirme se o MySQL está em execução, se a porta está correta e se `DATABASE_URL` aponta para o host certo. |
| `Unknown database` | Execute `npm run db:create` ou verifique `DB_NAME` no `.env`. |
| `P1001` ou `P1003` | Revise host, porta, usuário, senha e nome do banco na `DATABASE_URL`. |
| Erro de autenticação no site | Confirme os valores usados no seed e execute `npm run db:seed` novamente. |
| `prisma generate` com cliente desatualizado | Execute `npm run prisma:generate` depois de alterar o schema. |
| Tabela já existente durante a migration inicial | Pare, faça backup e avalie o procedimento de baseline com `prisma migrate resolve --applied`; não apague tabelas sem confirmação. |
| Porta 3000 ocupada | Inicie com outra porta usando `npm run dev -- -p 3001` e abra `http://localhost:3001`. |

## 15. Estado da implementação

A branch `feat/prisma-migrations-tests` contém seis commits segmentados: infraestrutura, schema/migration, acesso a dados, seeds, testes e documentação operacional. Antes da documentação, a validação concluída foi de **44 testes passando**, TypeScript, lint, build, validação do schema Prisma e status de migrations.
