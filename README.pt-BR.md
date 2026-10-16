<div align="center">

# Saquá360 — Project Dashboard

**Acompanhamento de projetos e indicadores das secretarias da Prefeitura de Saquarema (RJ).**

🇺🇸 [Read in English](README.md)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white) ![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white) ![Vitest](https://img.shields.io/badge/Vitest-tested-6E9F18?logo=vitest&logoColor=white)

</div>

## Sobre

Aplicação web interna usada pela prefeitura para cadastrar cada secretaria, seus projetos, os responsáveis e os indicadores que medem o andamento. Administradores têm uma visão consolidada; usuários de secretaria só veem e editam o que é deles. Toda alteração fica registrada em log de auditoria.

## Funcionalidades

- Secretarias, projetos e múltiplos responsáveis por projeto
- Indicadores com escalas configuráveis e prazo de atualização
- Controle de acesso por papel (admin, admin de projeto, usuário com/sem edição)
- Log de auditoria completo: quem alterou o quê e quando
- Redefinição de senha por e-mail e troca obrigatória no primeiro acesso
- Limite de tentativas de login persistido no banco
- Gráficos com Recharts e tema claro/escuro

## Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Base UI), Lucide, Sonner, Recharts |
| Autenticação | Signed session cookie (`jose`), `bcryptjs` |
| Dados | MySQL / MariaDB + Prisma ORM with versioned migrations |
| E-mail | Nodemailer (SMTP) with HTML templates |
| Testes | Vitest + coverage (v8) |

## Arquitetura

```
app/            rotas (área admin, login, troca de senha) e rotas de API de autenticação
lib/actions/    Server Actions: toda leitura/escrita passa por aqui, com checagem de permissão
lib/            sessão, permissões, auditoria, e-mail e cliente Prisma
prisma/         schema + 14 migrations versionadas
scripts/        seeds (admin, secretarias, métricas)
templates/      templates de e-mail
tests/          suítes Vitest
```
As alterações rodam como **Server Actions** que conferem a sessão e o papel do usuário antes de tocar no banco e gravam um registro em `AuditLog` no mesmo fluxo.

## Segurança

- Sessão em cookie httpOnly assinado; senhas com bcrypt
- Limite de tentativas de login gravado no MySQL (`LoginThrottle`), ciente de proxy via `TRUSTED_PROXY_COUNT`
- Comparação de segredos em tempo constante (`timingSafeEqual`)
- Autorização aplicada no servidor em toda Server Action, não só na interface

## Como rodar

**Pré-requisitos:** Node.js 20+, MySQL 8 ou MariaDB

```bash
cp .env.example .env      # preencha as variáveis abaixo
npm install
npm run db:setup          # prisma generate + migrate dev
npm run db:seed           # cria o primeiro admin a partir de ADMIN_USERNAME / ADMIN_PASSWORD
npm run dev               # http://localhost:3002
```
Em banco já existente (homologação/produção) use `npm run db:setup:deploy`, que só aplica as migrations versionadas.

### Variáveis de ambiente

`.env.example` — Nunca versione valores reais. Copie o arquivo de exemplo e preencha localmente.

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão MySQL |
| `SESSION_SECRET` | Segredo longo e aleatório que assina o cookie de sessão |
| `TRUSTED_PROXY_COUNT` | Quantidade de proxies reversos na frente do app (para o IP do cliente) |
| `ADMIN_USERNAME / ADMIN_PASSWORD` | Conta do primeiro admin criada pelo seed |
| `MAIL_HOST / MAIL_PORT / MAIL_USER / MAIL_PASS` | SMTP para os e-mails de redefinição de senha |

### Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento na porta 3002 |
| `npm run build` | `prisma generate` + build de produção |
| `npm test` | Roda a suíte Vitest |
| `npm run test:coverage` | Testes com relatório de cobertura |
| `npm run lint` | ESLint |
| `npm run prisma:studio` | Prisma Studio |

## Testes

20 arquivos de teste Vitest em `tests/` cobrindo permissões, sessão, auditoria e server actions. Rode `npm test`.

## Equipe

- [Vinícius Diller](https://github.com/viniciusdiller)
- [Vinicius do Valle](https://github.com/vallevinicius)
