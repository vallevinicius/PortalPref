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
git switch fix/seed-admin-only
```

Confirme a branch atual:

```powershell
git branch --show-current
```

O resultado esperado é:

```text
fix/seed-admin-only
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

Para o cenário solicitado, configure o arquivo `.env` desta forma:

```dotenv
DATABASE_URL="mysql://root:vinicius@localhost:3306/apaixonese"
PORT=3305

SESSION_SECRET=troque-por-um-segredo-longo-e-aleatorio
PASSWORD_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

ADMIN_USERNAME=admin
ADMIN_PASSWORD=troque-esta-senha
```

O Prisma usa exclusivamente `DATABASE_URL` para conectar ao MySQL. A variável `PORT` define a porta HTTP do Next.js; neste caso, o site será aberto em [http://localhost:3305](http://localhost:3305).

Se a senha do MySQL possuir caracteres especiais, como `@`, `#`, `/`, `:` ou espaços, faça URL encoding na senha dentro de `DATABASE_URL`. Por exemplo, `p@ss word` deve ser representada como `p%40ss%20word`.

Nunca versione o arquivo `.env` nem compartilhe os valores reais de `DATABASE_URL`, `SESSION_SECRET`, `PASSWORD_ENCRYPTION_KEY` ou `ADMIN_PASSWORD`.

## 5. Criar o banco e aplicar as migrations com Prisma

Com o MySQL em execução e o usuário da `DATABASE_URL` autorizado a criar bancos, rode:

```powershell
npm run db:setup
```

Esse comando executa, em sequência:

```powershell
npm run prisma:generate
npm run prisma:migrate
```

O `prisma generate` cria o cliente TypeScript. O `prisma migrate dev` compara `prisma/schema.prisma`, cria uma migration quando necessário, aplica o histórico ao banco e executa os generators. Em uma base nova, esse é o fluxo recomendado para desenvolvimento.

Você também pode executar as etapas separadamente:

```powershell
npx prisma generate
npx prisma migrate dev
```

Para ambientes que devem apenas aplicar migrations já versionadas, sem criar novas migrations interativamente, use:

```powershell
npm run db:setup:deploy
```

Esse comando executa `prisma generate` e `prisma migrate deploy`.

Confira o estado do histórico Prisma sem alterar o banco:

```powershell
npx prisma migrate status
```

### Banco já existente

Faça um backup antes de usar `migrate dev` ou `migrate reset` em um banco com dados. O banco `apaixonese` configurado localmente já possui registros na tabela `_prisma_migrations` que não estão presentes nesta branch. Por isso, o status pode indicar histórico divergente.

Para uma instalação de teste limpa, prefira criar um banco novo na URL, por exemplo `apaixonese_dev`, e execute `npm run db:setup`. Se `apaixonese` for descartável e você quiser recriá-lo do zero, faça backup e use o procedimento destrutivo apropriado no seu ambiente antes de rodar novamente `npx prisma migrate dev`.

Não marque `20260817134219_init` como aplicada com `prisma migrate resolve` sem comparar o schema real, pois isso pode fazer o Prisma acreditar que tabelas existentes já correspondem ao schema desta branch.

## 6. Gerar o cliente Prisma

Sempre que o `schema.prisma` for alterado, gere novamente o cliente:

```powershell
npm run prisma:generate
```

O cliente gerado fica em `node_modules/@prisma/client` e não deve ser versionado manualmente.

## 7. Popular os dados iniciais

Depois que as migrations estiverem aplicadas, execute o seed padrão:

```powershell
npm run db:seed
```

Esse comando cria ou atualiza **somente o super administrador** usando `ADMIN_USERNAME` e `ADMIN_PASSWORD`. Ele não cria secretarias, usuários de demonstração, projetos, indicadores nem eventos históricos de auditoria. Os comandos `db:seed-secretarias` e `db:seed-metricas` continuam separados e só devem ser executados quando você quiser explicitamente inserir dados iniciais de negócio.

O cenário demonstrativo é totalmente opt-in e não é chamado por `db:seed`, `db:setup` ou `db:setup:deploy`. Para usá-lo apenas em um banco local descartável, execute separadamente:

```powershell
npm run db:seed-demo
```

Esse comando cria seis secretarias, seis administradores de secretaria, dezoito projetos, trinta e seis indicadores e eventos de auditoria históricos. Nunca inclua `db:seed-demo` no pipeline de produção. Os usuários demo `demo-1` até `demo-6` usam a senha temporária `Demo@1234` e devem permanecer restritos a ambientes locais de demonstração.

Os seeds de secretarias, métricas e demonstração são idempotentes dentro de suas próprias regras; o seed padrão do administrador pode ser executado com segurança para atualizar a senha e o papel do super administrador.

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
| `/admin/audit-log` | Histórico completo, filtros e paginação; disponível somente para `super_admin` |

## 9. Audit log e controle de acesso

O sistema registra eventos de autenticação, criação e alteração de secretarias, usuários, projetos e indicadores, redefinição e visualização de credenciais, além da própria consulta do histórico. Cada evento contém o ator, a ação, a entidade, o identificador relacionado, o alvo de usuário quando aplicável, detalhes estruturados e data/hora.

A leitura do audit log é protegida em dois níveis: a página server-side redireciona usuários não autenticados ou que não sejam `super_admin`, e a função de consulta exige novamente `requireSession('super_admin')`. Portanto, administradores de secretaria não conseguem obter os eventos nem acessando a rota diretamente.

O super administrador acessa o histórico pelo botão **Ver audit log completo** no dashboard ou diretamente em `/admin/audit-log`. A tela permite filtrar por ação, tipo de entidade e ator, além de navegar por páginas. Senhas e outros segredos nunca são armazenados nos detalhes dos eventos.

## 10. Executar os testes unitários

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

A suíte criada para esta implementação cobre as ações de secretarias, projetos, indicadores e usuários, a camada de leitura agregada, o login, o logout, o helper de auditoria, a consulta protegida do audit log e o singleton de configuração do Prisma. Os testes utilizam mocks do Prisma e não dependem de um banco real.

## 11. Executar lint, TypeScript e build

Use os comandos abaixo antes de abrir um pull request:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

O build de produção pode carregar as variáveis de `.env`, portanto mantenha o arquivo configurado mesmo quando o objetivo for apenas validar a compilação.

## 12. Abrir o Prisma Studio

Para inspecionar os registros pelo painel do Prisma:

```powershell
npm run prisma:studio
```

O comando abre o Prisma Studio em uma porta local informada pelo terminal. Feche o processo com `Ctrl+C` quando terminar.

## 13. Criar uma nova migration

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

## 14. Resetar um banco de desenvolvimento

O comando abaixo é destrutivo: ele apaga os dados do banco configurado e reaplica o histórico de migrations.

```powershell
npx prisma migrate reset
```

Use-o somente em banco descartável de desenvolvimento. Nunca execute esse comando contra produção ou contra uma base contendo dados que não estejam protegidos por backup.

## 15. Solução de problemas comuns

| Problema | Verificação/recomendação |
|---|---|
| `Can't reach database server` | Confirme se o MySQL está em execução, se a porta está correta e se `DATABASE_URL` aponta para o host certo. |
| `Unknown database` | Execute `npm run db:setup` e confirme se o usuário da `DATABASE_URL` tem permissão para criar o banco. |
| `P1001` ou `P1003` | Revise host, porta, usuário, senha e nome do banco na `DATABASE_URL`. |
| `P3006`/`P3018` perto de `-- CreateTable` | Atualize para o commit que remove o BOM UTF-8 da migration, confirme que o arquivo começa diretamente com `-- CreateTable` e repita `npx prisma migrate dev` em um banco de desenvolvimento. |
| Erro de autenticação no site | Confirme os valores usados no seed e execute `npm run db:seed` novamente. |
| `prisma generate` com cliente desatualizado | Execute `npm run prisma:generate` depois de alterar o schema. |
| Tabela já existente durante a migration inicial | Pare, faça backup e avalie o procedimento de baseline com `prisma migrate resolve --applied`; não apague tabelas sem confirmação. |
| Porta 3000 ocupada | Inicie com outra porta usando `npm run dev -- -p 3001` e abra `http://localhost:3001`. |

## 16. Estado da implementação

A branch `fix/seed-admin-only` deriva de `feat/audit-log` e reforça que o comando padrão `npm run db:seed` executa somente a criação/atualização do super administrador, sem popular dados de negócio ou histórico. A implementação do audit log permanece disponível, e o cenário demonstrativo continua opt-in pelo comando separado `npm run db:seed-demo`. A validação anterior da feature alcançou **59 testes passando**, além de TypeScript, lint e build.
