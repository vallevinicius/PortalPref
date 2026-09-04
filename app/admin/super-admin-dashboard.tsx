'use client'

import { AlertTriangle, Eye, KeyRound, PieChart as PieChartIcon, Plus, ScrollText, Search, ShieldPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmPasswordDialog, GeneratedPasswordBanner, type Credential } from './credential-components'
import { createSecretaria } from '@/lib/actions/secretarias'
import { cn } from '@/lib/utils'
import { createSuperAdmin, getSuperAdminPassword, resetSuperAdminPassword } from '@/lib/actions/users'
import type { ProjetoResumo, Secretaria, SecretariaAdmin, SuperAdmin } from '@/lib/data'
import { calcularStatusAtualizacao } from '@/lib/prazo-atualizacao'
import { getSecretariaIcon } from '@/lib/secretaria-icon'
import { SECRETARIA_PRESETS } from '@/lib/secretaria-presets'

const OUTRA_OPCAO_VALOR = '__outra__'

function NovaSecretariaDialog({
  open,
  onOpenChange,
  secretarias,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  secretarias: Secretaria[]
}) {
  const router = useRouter()
  const [selecionado, setSelecionado] = useState('')
  const [nomePersonalizado, setNomePersonalizado] = useState('')
  const [isPending, startTransition] = useTransition()

  const nomesExistentes = useMemo(() => new Set(secretarias.map((s) => s.nome)), [secretarias])
  const opcoesDisponiveis = useMemo(
    () => SECRETARIA_PRESETS.filter((nome) => !nomesExistentes.has(nome)),
    [nomesExistentes],
  )

  function resetForm() {
    setSelecionado('')
    setNomePersonalizado('')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nome = selecionado === OUTRA_OPCAO_VALOR ? nomePersonalizado : selecionado
    startTransition(async () => {
      try {
        await createSecretaria(nome)
        resetForm()
        onOpenChange(false)
        toast.success('Secretaria criada.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível criar a secretaria.')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) resetForm()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova secretaria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nova-secretaria-select">Secretaria</Label>
            <Select value={selecionado} onValueChange={(value) => setSelecionado(value ?? '')}>
              <SelectTrigger id="nova-secretaria-select" className="w-full">
                <SelectValue placeholder="Selecione uma secretaria">
                  {(value: string | null) => (value === OUTRA_OPCAO_VALOR ? 'Outra (digitar nome)' : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {opcoesDisponiveis.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
                <SelectItem value={OUTRA_OPCAO_VALOR}>Outra (digitar nome)</SelectItem>
              </SelectContent>
            </Select>
            {opcoesDisponiveis.length === 0 && (
              <p className="text-xs text-muted-foreground">Todas as secretarias da lista padrão já foram cadastradas.</p>
            )}
          </div>
          {selecionado === OUTRA_OPCAO_VALOR && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nova-secretaria-nome-personalizado">Nome da secretaria</Label>
              <Input
                id="nova-secretaria-nome-personalizado"
                value={nomePersonalizado}
                onChange={(e) => setNomePersonalizado(e.target.value)}
                placeholder="Ex.: Secretaria de Saúde"
                required
                autoFocus
              />
            </div>
          )}
          <Button
            type="submit"
            disabled={isPending || !selecionado || (selecionado === OUTRA_OPCAO_VALOR && !nomePersonalizado.trim())}
            className="mt-1"
          >
            {isPending ? 'Criando...' : 'Criar secretaria'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const PIZZA_CORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7']
const PIZZA_COR_OUTRAS = '#c3c2b7'
const PIZZA_MAX_FATIAS = 7

function buildPizzaData(secretarias: Secretaria[]) {
  const comProjetos = [...secretarias].filter((s) => s.projetos_count > 0).sort((a, b) => b.projetos_count - a.projetos_count)
  const principais = comProjetos.slice(0, PIZZA_MAX_FATIAS)
  const resto = comProjetos.slice(PIZZA_MAX_FATIAS)
  const somaResto = resto.reduce((soma, s) => soma + s.projetos_count, 0)

  const dados = principais.map((s, indice) => ({
    id: s.id as number | null,
    nome: s.nome,
    valor: s.projetos_count,
    cor: PIZZA_CORES[indice % PIZZA_CORES.length],
  }))

  if (somaResto > 0) {
    dados.push({ id: null, nome: `Outras secretarias (${resto.length})`, valor: somaResto, cor: PIZZA_COR_OUTRAS })
  }

  return dados
}

function ProjetosPorSecretariaButton({ secretarias }: { secretarias: Secretaria[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const dados = useMemo(() => buildPizzaData(secretarias), [secretarias])
  const total = dados.reduce((soma, item) => soma + item.valor, 0)

  function handleSelecionar(id: number | null) {
    if (id === null) return
    setOpen(false)
    router.push(`/admin/secretarias/${id}`)
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <PieChartIcon className="size-4" />
        Projetos por secretaria
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" initialFocus={false}>
          <DialogHeader>
            <DialogTitle>Projetos por secretaria</DialogTitle>
            <DialogDescription>
              {total} projeto{total === 1 ? '' : 's'} no total, distribuídos entre as secretarias com mais lançamentos. Clique numa fatia para abrir a secretaria.
            </DialogDescription>
          </DialogHeader>
          {dados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado ainda.</p>
          ) : (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center justify-center sm:w-64">
                <PieChart width={240} height={240} className="outline-none [&_svg]:outline-none [&_path]:outline-none [&_path]:focus:outline-none">
                  <Pie data={dados} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={44} outerRadius={78} paddingAngle={2}>
                    {dados.map((item) => (
                      <Cell
                        key={item.nome}
                        fill={item.cor}
                        stroke="#ffffff"
                        strokeWidth={2}
                        cursor={item.id === null ? 'default' : 'pointer'}
                        onClick={() => handleSelecionar(item.id)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, nome) => [`${value} projeto${value === 1 ? '' : 's'}`, nome]}
                  />
                </PieChart>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                {dados.map((item) => (
                  <button
                    key={item.nome}
                    type="button"
                    onClick={() => handleSelecionar(item.id)}
                    disabled={item.id === null}
                    className={cn(
                      'flex items-start justify-between gap-3 rounded-md px-1.5 py-1 text-left text-sm -mx-1.5 transition-colors',
                      item.id !== null && 'hover:bg-muted cursor-pointer',
                      item.id === null && 'cursor-default',
                    )}
                  >
                    <span className="flex min-w-0 items-start gap-2">
                      <span aria-hidden="true" className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
                      <span className="text-foreground">{item.nome}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                      {item.valor} projeto{item.valor === 1 ? '' : 's'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function SecretariaCard({ secretaria, admin }: { secretaria: Secretaria; admin: SecretariaAdmin | null }) {
  const Icon = getSecretariaIcon(secretaria.nome)

  return (
    <Link
      href={`/admin/secretarias/${secretaria.id}`}
      className="group relative flex h-40 flex-col justify-end overflow-hidden rounded-2xl bg-linear-to-br from-primary to-[#004847] p-4 text-left shadow-md ring-1 ring-black/5 transition-transform duration-150 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.25}
        className="pointer-events-none absolute -right-4 -top-4 size-28 text-white/10 transition-transform duration-150 group-hover:scale-110"
      />
      <Badge className="relative mb-2 w-fit border-white/25 bg-white/15 text-white">
        {admin ? admin.username : 'Sem usuário'}
      </Badge>
      <span className="relative text-base font-semibold leading-snug text-white">{secretaria.nome}</span>
      <span className="relative mt-1 text-xs text-white/75">
        {secretaria.projetos_count} projeto{secretaria.projetos_count === 1 ? '' : 's'}
      </span>
    </Link>
  )
}

function SecretariaGrid({ secretarias, admins }: { secretarias: Secretaria[]; admins: SecretariaAdmin[] }) {
  if (secretarias.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma secretaria cadastrada ainda.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {secretarias.map((secretaria) => (
        <SecretariaCard
          key={secretaria.id}
          secretaria={secretaria}
          admin={admins.find((admin) => admin.secretaria_id === secretaria.id) ?? null}
        />
      ))}
    </div>
  )
}

function NovoSuperAdminDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (credential: Credential) => void
}) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const credential = await createSuperAdmin(username)
        setUsername('')
        onOpenChange(false)
        onCreated(credential)
        toast.success('Usuário supremo criado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível criar o usuário.')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setUsername('')
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário supremo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="novo-supremo-nome">Usuário de acesso</Label>
            <Input id="novo-supremo-nome" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex.: viceprefeita" required />
          </div>
          <p className="text-xs text-muted-foreground">
            Esse usuário terá o mesmo nível de acesso que o seu: vê e gerencia todas as secretarias.
          </p>
          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? 'Criando...' : 'Criar usuário supremo'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SuperAdminRow({
  superAdmin,
  isCurrentUser,
  isBootstrapAdmin,
  onCredentialRevealed,
}: {
  superAdmin: SuperAdmin
  isCurrentUser: boolean
  isBootstrapAdmin: boolean
  onCredentialRevealed: (credential: Credential) => void
}) {
  const router = useRouter()
  const [resetPending, setResetPending] = useState(false)
  const [viewPending, setViewPending] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [confirmViewOpen, setConfirmViewOpen] = useState(false)

  if (isBootstrapAdmin) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <span className="font-mono text-sm">
          {superAdmin.username}
          {isCurrentUser && <span className="ml-2 text-xs font-sans text-muted-foreground">(você)</span>}
        </span>
        <span className="text-xs text-muted-foreground">Senha definida pelo .env do servidor</span>
      </div>
    )
  }

  function handleReset() {
    setResetPending(true)
    resetSuperAdminPassword(superAdmin.id)
      .then((result) => {
        onCredentialRevealed({ username: superAdmin.username, password: result.password })
        toast.success('Nova senha gerada.')
        router.refresh()
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a nova senha.')
      })
      .finally(() => setResetPending(false))
  }

  function handleViewPassword(confirmPassword: string) {
    setViewPending(true)
    getSuperAdminPassword(superAdmin.id, confirmPassword)
      .then((result) => {
        onCredentialRevealed({ username: superAdmin.username, password: result.password })
        setConfirmViewOpen(false)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível mostrar a senha.')
      })
      .finally(() => setViewPending(false))
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <span className="font-mono text-sm">
        {superAdmin.username}
        {isCurrentUser && <span className="ml-2 text-xs font-sans text-muted-foreground">(você)</span>}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirmViewOpen(true)} disabled={viewPending} className="gap-1.5">
          <Eye className="size-3.5" />
          {viewPending ? 'Carregando...' : 'Ver senha atual'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmResetOpen(true)} disabled={resetPending} className="gap-1.5">
          <KeyRound className="size-3.5" />
          {resetPending ? 'Gerando...' : 'Gerar nova senha'}
        </Button>
      </div>

      <ConfirmPasswordDialog open={confirmViewOpen} onOpenChange={setConfirmViewOpen} onConfirm={handleViewPassword} pending={viewPending} />

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova senha?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha atual de &ldquo;{superAdmin.username}&rdquo; deixará de funcionar imediatamente.
              {isCurrentUser && ' Essa é a sua própria conta — anote a nova senha antes de sair.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Gerar nova senha</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SuperAdminsSection({
  superAdmins,
  currentUsername,
  bootstrapUsername,
}: {
  superAdmins: SuperAdmin[]
  currentUsername: string
  bootstrapUsername: string | null
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [revealedCredential, setRevealedCredential] = useState<Credential | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administradores supremos</CardTitle>
        <CardDescription>Têm o mesmo nível de acesso que você. Use com cuidado.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {revealedCredential && (
          <GeneratedPasswordBanner credential={revealedCredential} onDismiss={() => setRevealedCredential(null)} />
        )}

        <Button onClick={() => setCreateOpen(true)} className="w-fit gap-1.5">
          <ShieldPlus className="size-4" />
          Novo usuário supremo
        </Button>

        <NovoSuperAdminDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setRevealedCredential} />

        <div className="flex flex-col gap-2">
          {superAdmins.map((superAdmin) => (
            <SuperAdminRow
              key={superAdmin.id}
              superAdmin={superAdmin}
              isCurrentUser={superAdmin.username === currentUsername}
              isBootstrapAdmin={bootstrapUsername !== null && superAdmin.username === bootstrapUsername}
              onCredentialRevealed={setRevealedCredential}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ProjetosAtrasadosAlert({ projetosResumo }: { projetosResumo: ProjetoResumo[] }) {
  const atrasados = useMemo(() => {
    return projetosResumo
      .map((projeto) => ({ projeto, status: calcularStatusAtualizacao(projeto.ultima_atualizacao, projeto.prazo_atualizacao_dias) }))
      .filter((item) => item.status.atrasado)
      .sort((a, b) => (b.status.diasDesdeUltimaAtualizacao ?? Number.MAX_SAFE_INTEGER) - (a.status.diasDesdeUltimaAtualizacao ?? Number.MAX_SAFE_INTEGER))
  }, [projetosResumo])

  if (atrasados.length === 0) return null

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-5 shrink-0 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          {atrasados.length} projeto{atrasados.length === 1 ? '' : 's'} atrasado{atrasados.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {atrasados.map(({ projeto, status }) => (
          <Link
            key={projeto.id}
            href={`/admin/projetos/${projeto.id}`}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-destructive/10"
          >
            <span className="min-w-0 truncate text-foreground">
              {projeto.nome} <span className="text-muted-foreground">— {projeto.secretaria_nome}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-destructive">
              {status.diasDesdeUltimaAtualizacao === null
                ? 'nunca atualizado'
                : `${status.diasDesdeUltimaAtualizacao} dias sem atualizar`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function SuperAdminDashboard({
  secretarias,
  admins,
  superAdmins,
  currentUsername,
  bootstrapUsername,
  projetosResumo,
}: {
  secretarias: Secretaria[]
  admins: SecretariaAdmin[]
  superAdmins: SuperAdmin[]
  currentUsername: string
  bootstrapUsername: string | null
  projetosResumo: ProjetoResumo[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [busca, setBusca] = useState('')

  const secretariasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return secretarias
    return secretarias.filter((secretaria) => {
      if (secretaria.nome.toLowerCase().includes(q)) return true
      return projetosResumo.some((projeto) => projeto.secretaria_id === secretaria.id && projeto.nome.toLowerCase().includes(q))
    })
  }, [secretarias, projetosResumo, busca])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Secretarias</h2>
          <p className="text-sm text-muted-foreground">
            {secretarias.length} secretaria{secretarias.length === 1 ? '' : 's'} cadastrada{secretarias.length === 1 ? '' : 's'}
            {' | '}
            {projetosResumo.length} projeto{projetosResumo.length === 1 ? '' : 's'} cadastrado{projetosResumo.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjetosPorSecretariaButton secretarias={secretarias} />
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Nova secretaria
          </Button>
        </div>
      </div>

      <ProjetosAtrasadosAlert projetosResumo={projetosResumo} />

      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por secretaria ou projeto..."
          className="h-10 pl-10"
        />
      </div>

      <NovaSecretariaDialog open={createOpen} onOpenChange={setCreateOpen} secretarias={secretarias} />

      <div className="flex justify-start">
        <Link href="/admin/audit-log" className={buttonVariants({ variant: 'outline', className: 'gap-1.5' })}>
          <ScrollText className="size-4" />
          Ver registro de auditoria completo
        </Link>
      </div>

      {secretariasFiltradas.length === 0 && busca.trim() ? (
        <p className="text-sm text-muted-foreground">Nenhuma secretaria ou projeto encontrado para &ldquo;{busca}&rdquo;.</p>
      ) : (
        <SecretariaGrid secretarias={secretariasFiltradas} admins={admins} />
      )}

      <SuperAdminsSection superAdmins={superAdmins} currentUsername={currentUsername} bootstrapUsername={bootstrapUsername} />
    </div>
  )
}
