'use client'

import { Check, Copy, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSecretaria } from '@/lib/actions/secretarias'
import { createSecretariaUser, resetSecretariaUserPassword } from '@/lib/actions/users'
import type { Projeto, Secretaria, SecretariaAdmin } from '@/lib/data'

function formatValor(valor: number, unidade: string | null) {
  const numero = new Intl.NumberFormat('pt-BR').format(valor)
  return unidade ? `${numero} ${unidade}` : numero
}

function formatData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR')
}

function GeneratedPasswordBanner({
  credential,
  onDismiss,
}: {
  credential: { username: string; password: string }
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(credential.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-4">
      <p className="text-sm font-medium text-foreground">
        Senha gerada para <span className="font-mono">{credential.username}</span> — anote agora, ela não será exibida novamente:
      </p>
      <div className="flex items-center gap-2">
        <code className="rounded-md bg-background px-3 py-1.5 font-mono text-sm ring-1 ring-border">{credential.password}</code>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Fechar
        </Button>
      </div>
    </div>
  )
}

function NovaSecretariaForm() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await createSecretaria(nome)
        setNome('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível criar a secretaria.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="nova-secretaria-nome">Nome da secretaria</Label>
        <Input id="nova-secretaria-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Secretaria de Saúde" required />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Criando...' : 'Nova secretaria'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

function NovoUsuarioForm({
  secretarias,
  onCreated,
}: {
  secretarias: Secretaria[]
  onCreated: (credential: { username: string; password: string }) => void
}) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [secretariaId, setSecretariaId] = useState(String(secretarias[0]?.id ?? ''))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const credential = await createSecretariaUser(username, Number(secretariaId))
        setUsername('')
        onCreated(credential)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível criar o usuário.')
      }
    })
  }

  if (secretarias.length === 0) {
    return <p className="text-sm text-muted-foreground">Cadastre uma secretaria antes de criar usuários.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="novo-usuario-nome">Usuário de acesso</Label>
        <Input id="novo-usuario-nome" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex.: saude.admin" required />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="novo-usuario-secretaria">Secretaria</Label>
        <select
          id="novo-usuario-secretaria"
          value={secretariaId}
          onChange={(e) => setSecretariaId(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {secretarias.map((secretaria) => (
            <option key={secretaria.id} value={secretaria.id}>
              {secretaria.nome}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={isPending} className="gap-1.5">
        <KeyRound className="size-3.5" />
        {isPending ? 'Criando...' : 'Criar usuário + gerar senha'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

function SecretariasList({ secretarias }: { secretarias: Secretaria[] }) {
  if (secretarias.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma secretaria cadastrada ainda.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Secretaria</th>
            <th className="px-3 py-2">Projetos</th>
          </tr>
        </thead>
        <tbody>
          {secretarias.map((secretaria) => (
            <tr key={secretaria.id} className="border-t border-border">
              <td className="px-3 py-2">{secretaria.nome}</td>
              <td className="px-3 py-2">{secretaria.projetos_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SecretariaAdminsList({
  admins,
  onReset,
}: {
  admins: SecretariaAdmin[]
  onReset: (credential: { username: string; password: string }) => void
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<number | null>(null)

  function handleReset(admin: SecretariaAdmin) {
    if (!confirm(`Gerar uma nova senha para "${admin.username}"? A senha atual deixará de funcionar.`)) return
    setPendingId(admin.id)
    resetSecretariaUserPassword(admin.id)
      .then((result) => {
        onReset({ username: admin.username, password: result.password })
        router.refresh()
      })
      .finally(() => setPendingId(null))
  }

  if (admins.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum usuário de secretaria cadastrado ainda.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Usuário</th>
            <th className="px-3 py-2">Secretaria</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => (
            <tr key={admin.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono">{admin.username}</td>
              <td className="px-3 py-2">{admin.secretaria_nome}</td>
              <td className="px-3 py-2 text-right">
                <Button variant="outline" size="sm" onClick={() => handleReset(admin)} disabled={pendingId === admin.id} className="gap-1.5">
                  <KeyRound className="size-3.5" />
                  {pendingId === admin.id ? 'Gerando...' : 'Gerar nova senha'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProjetosOverview({ projetos }: { projetos: Projeto[] }) {
  if (projetos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado por nenhuma secretaria ainda.</p>
  }

  const bySecretaria = new Map<string, Projeto[]>()
  for (const projeto of projetos) {
    const lista = bySecretaria.get(projeto.secretaria_nome) ?? []
    lista.push(projeto)
    bySecretaria.set(projeto.secretaria_nome, lista)
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(bySecretaria.entries()).map(([secretariaNome, secretariaProjetos]) => (
        <div key={secretariaNome} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-primary">{secretariaNome}</h3>
          {secretariaProjetos.map((projeto) => (
            <Card key={projeto.id} size="sm">
              <CardHeader>
                <CardTitle className="text-sm">{projeto.nome}</CardTitle>
                {projeto.descricao && <CardDescription>{projeto.descricao}</CardDescription>}
              </CardHeader>
              {projeto.indicadores.length > 0 && (
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Título</th>
                          <th className="px-3 py-2">Valor</th>
                          <th className="px-3 py-2">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projeto.indicadores.map((indicador) => (
                          <tr key={indicador.id} className="border-t border-border">
                            <td className="px-3 py-2">{indicador.titulo}</td>
                            <td className="px-3 py-2">{formatValor(indicador.valor, indicador.unidade)}</td>
                            <td className="px-3 py-2">{formatData(indicador.data_referencia)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}

export function SuperAdminDashboard({
  secretarias,
  admins,
  projetos,
}: {
  secretarias: Secretaria[]
  admins: SecretariaAdmin[]
  projetos: Projeto[]
}) {
  const [revealedCredential, setRevealedCredential] = useState<{ username: string; password: string } | null>(null)

  return (
    <div className="flex flex-col gap-6">
      {revealedCredential && (
        <GeneratedPasswordBanner credential={revealedCredential} onDismiss={() => setRevealedCredential(null)} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Secretarias</CardTitle>
          <CardDescription>{secretarias.length} cadastrada(s)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NovaSecretariaForm />
          <SecretariasList secretarias={secretarias} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários das secretarias</CardTitle>
          <CardDescription>Cada secretaria tem um único usuário, criado por você. Somente você pode redefinir a senha dela.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NovoUsuarioForm secretarias={secretarias} onCreated={setRevealedCredential} />
          <SecretariaAdminsList admins={admins} onReset={setRevealedCredential} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Números e projetos de todas as secretarias</CardTitle>
          <CardDescription>Visão consolidada — a criação/edição é feita pelo usuário de cada secretaria.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjetosOverview projetos={projetos} />
        </CardContent>
      </Card>
    </div>
  )
}
