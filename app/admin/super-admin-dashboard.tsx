'use client'

import { AlertTriangle, KeyRound, Mail, PieChart as PieChartIcon, Plus, ScrollText, Search, ShieldPlus, Trash2, Users, UserPlus } from 'lucide-react'
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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
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
import { GeneratedPasswordBanner, type Credential } from './credential-components'
import { createSecretaria } from '@/lib/actions/secretarias'
import { cn } from '@/lib/utils'
import { createProjetoUser, createSecretariaUser, createSuperAdmin, deleteUser, enviarRedefinicaoSenha } from '@/lib/actions/users'
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

type Cargo = 'secretario' | 'responsavel_projeto'

function SecretariaCombobox({
  id,
  label,
  secretarias,
  value,
  onChange,
  disabled,
  placeholder = 'Digite para buscar...',
}: {
  id: string
  label: string
  secretarias: Secretaria[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const nomePorId = useMemo(() => new Map(secretarias.map((s) => [String(s.id), s.nome])), [secretarias])
  const itens = useMemo(() => secretarias.map((s) => String(s.id)), [secretarias])

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        items={itens}
        value={value || null}
        onValueChange={(next) => onChange(next ?? '')}
        itemToStringLabel={(itemValue: string) => nomePorId.get(itemValue) ?? itemValue}
        disabled={disabled}
      >
        <ComboboxInputGroup>
          <ComboboxInput id={id} placeholder={placeholder} />
          <ComboboxIcon />
        </ComboboxInputGroup>
        <ComboboxContent>
          <ComboboxEmpty>Nenhuma secretaria encontrada.</ComboboxEmpty>
          <ComboboxList>
            {(itemValue: string) => (
              <ComboboxItem key={itemValue} value={itemValue}>
                {nomePorId.get(itemValue) ?? itemValue}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

function NovoUsuarioDialog({
  open,
  onOpenChange,
  secretarias,
  admins,
  projetosResumo,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  secretarias: Secretaria[]
  admins: SecretariaAdmin[]
  projetosResumo: ProjetoResumo[]
  onCreated: (credential: Credential) => void
}) {
  const router = useRouter()
  const [cargo, setCargo] = useState<Cargo>('secretario')
  const [secretariaFiltroId, setSecretariaFiltroId] = useState('')
  const [alvoId, setAlvoId] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()

  const secretariasDisponiveis = useMemo(
    () => secretarias.filter((s) => !admins.some((admin) => admin.secretaria_id === s.id)),
    [secretarias, admins],
  )

  const projetosDaSecretaria = useMemo(
    () => (secretariaFiltroId ? projetosResumo.filter((p) => String(p.secretaria_id) === secretariaFiltroId) : []),
    [projetosResumo, secretariaFiltroId],
  )

  function resetForm() {
    setCargo('secretario')
    setSecretariaFiltroId('')
    setAlvoId('')
    setUsername('')
    setEmail('')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!alvoId) return
    startTransition(async () => {
      try {
        const credential =
          cargo === 'secretario'
            ? await createSecretariaUser(username, email, Number(alvoId))
            : await createProjetoUser(username, email, Number(alvoId))
        resetForm()
        onOpenChange(false)
        onCreated(credential)
        toast.success('Usuário criado.')
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
        if (!next) resetForm()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="novo-usuario-cargo">Cargo</Label>
            <Select
              value={cargo}
              onValueChange={(value) => {
                setCargo((value ?? 'secretario') as Cargo)
                setSecretariaFiltroId('')
                setAlvoId('')
              }}
            >
              <SelectTrigger id="novo-usuario-cargo" className="w-full">
                <SelectValue>{(value: string | null) => (value === 'responsavel_projeto' ? 'Responsável de projeto' : 'Secretário')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="secretario">Secretário</SelectItem>
                <SelectItem value="responsavel_projeto">Responsável de projeto</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {cargo === 'secretario'
                ? 'Pode criar projetos e usuários responsáveis dentro da secretaria.'
                : 'Só acompanha os projetos designados a ele. Não pode criar projetos nem usuários.'}
            </p>
          </div>

          {cargo === 'secretario' ? (
            <div className="flex flex-col gap-1.5">
              <SecretariaCombobox
                id="novo-usuario-secretaria"
                label="Secretaria"
                secretarias={secretariasDisponiveis}
                value={alvoId}
                onChange={setAlvoId}
              />
              {secretariasDisponiveis.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todas as secretarias já têm um secretário. Para trocar o acesso de uma delas, gere uma nova senha em vez de criar outro usuário.
                </p>
              )}
            </div>
          ) : (
            <>
              <SecretariaCombobox
                id="novo-usuario-secretaria-filtro"
                label="Secretaria"
                secretarias={secretarias}
                value={secretariaFiltroId}
                onChange={(next) => {
                  setSecretariaFiltroId(next)
                  setAlvoId('')
                }}
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="novo-usuario-projeto">Projeto</Label>
                <Select value={alvoId} onValueChange={(value) => setAlvoId(value ?? '')} disabled={!secretariaFiltroId}>
                  <SelectTrigger id="novo-usuario-projeto" className="w-full">
                    <SelectValue
                      placeholder={secretariaFiltroId ? 'Selecione o projeto' : 'Selecione a secretaria primeiro'}
                    >
                      {(value: string | null) => (value ? projetosDaSecretaria.find((p) => String(p.id) === value)?.nome : null)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projetosDaSecretaria.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {secretariaFiltroId && projetosDaSecretaria.length === 0 && (
                  <p className="text-xs text-muted-foreground">Essa secretaria ainda não tem projetos cadastrados.</p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="novo-usuario-nome">Nome de usuário</Label>
            <Input
              id="novo-usuario-nome"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex.: saude.admin"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="novo-usuario-email">E-mail de acesso</Label>
            <Input
              id="novo-usuario-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex.: fulano@prefeitura.gov.br"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isPending || !alvoId || !username.trim() || !email.trim()}
            className="mt-1 gap-1.5"
          >
            <KeyRound className="size-3.5" />
            {isPending ? 'Criando...' : 'Criar usuário + gerar senha'}
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

type NivelAcesso = 'completo' | 'visualizacao'

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
  const [nivelAcesso, setNivelAcesso] = useState<NivelAcesso>('completo')
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setUsername('')
    setNivelAcesso('completo')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const credential = await createSuperAdmin(username, nivelAcesso === 'completo')
        resetForm()
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
        if (!next) resetForm()
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="novo-supremo-nivel">Nível de acesso</Label>
            <Select value={nivelAcesso} onValueChange={(value) => setNivelAcesso((value ?? 'completo') as NivelAcesso)}>
              <SelectTrigger id="novo-supremo-nivel" className="w-full">
                <SelectValue>{(value: string | null) => (value === 'visualizacao' ? 'Apenas visualização' : 'Completo (editar)')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completo">Completo (editar)</SelectItem>
                <SelectItem value="visualizacao">Apenas visualização</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {nivelAcesso === 'completo'
                ? 'Vê e gerencia todas as secretarias, com o mesmo nível de acesso que o seu.'
                : 'Só acompanha os números de todas as secretarias. Não pode criar, editar ou excluir nada (ex.: perfil da prefeita).'}
            </p>
          </div>
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
  canEdit,
}: {
  superAdmin: SuperAdmin
  isCurrentUser: boolean
  isBootstrapAdmin: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const [sendingReset, setSendingReset] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (isBootstrapAdmin) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <span className="font-mono text-sm">
          {superAdmin.username}
          {isCurrentUser && <span className="ml-2 text-xs font-sans text-muted-foreground">(você)</span>}
        </span>
        <span className="text-xs text-muted-foreground">Senha definida pela Equipe LAB-ISA</span>
      </div>
    )
  }

  function handleSendReset() {
    setSendingReset(true)
    enviarRedefinicaoSenha(superAdmin.id)
      .then(() => {
        toast.success(`E-mail de redefinição enviado para ${superAdmin.username}.`)
        setConfirmResetOpen(false)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail de redefinição.')
      })
      .finally(() => setSendingReset(false))
  }

  function handleDelete() {
    setDeleting(true)
    deleteUser(superAdmin.id)
      .then(() => {
        toast.success(`Usuário supremo "${superAdmin.username}" excluído.`)
        setConfirmDeleteOpen(false)
        router.refresh()
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o usuário.')
      })
      .finally(() => setDeleting(false))
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <span className="flex items-center gap-2 font-mono text-sm">
        {superAdmin.username}
        {isCurrentUser && <span className="text-xs font-sans text-muted-foreground">(você)</span>}
        {!superAdmin.canEdit && <Badge variant="secondary" className="font-sans font-normal">Apenas visualização</Badge>}
      </span>
      {canEdit && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmResetOpen(true)} disabled={sendingReset} className="gap-1.5">
            <Mail className="size-3.5" />
            {sendingReset ? 'Enviando...' : 'Redefinir senha por e-mail'}
          </Button>
          {!isCurrentUser && (
            <Button variant="outline" size="icon-sm" onClick={() => setConfirmDeleteOpen(true)} aria-label={`Excluir ${superAdmin.username}`}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar e-mail de redefinição de senha?</AlertDialogTitle>
            <AlertDialogDescription>
              Vamos mandar um código de confirmação para o e-mail de &ldquo;{superAdmin.username}&rdquo;. A senha atual
              continua funcionando até a pessoa concluir a redefinição.
              {isCurrentUser && ' Essa é a sua própria conta.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendReset} disabled={sendingReset}>
              {sendingReset ? 'Enviando...' : 'Enviar e-mail'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isCurrentUser && (
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir usuário supremo?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai excluir o acesso de &ldquo;{superAdmin.username}&rdquo; como administrador supremo. Essa ação não
                pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function SuperAdminsSection({
  superAdmins,
  currentUsername,
  bootstrapUsername,
  canEdit,
}: {
  superAdmins: SuperAdmin[]
  currentUsername: string
  bootstrapUsername: string | null
  canEdit: boolean
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

        {canEdit && (
          <>
            <Button onClick={() => setCreateOpen(true)} className="w-fit gap-1.5">
              <ShieldPlus className="size-4" />
              Novo usuário supremo
            </Button>
            <NovoSuperAdminDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setRevealedCredential} />
          </>
        )}

        <div className="flex flex-col gap-2">
          {superAdmins.map((superAdmin) => (
            <SuperAdminRow
              key={superAdmin.id}
              superAdmin={superAdmin}
              isCurrentUser={superAdmin.username === currentUsername}
              isBootstrapAdmin={bootstrapUsername !== null && superAdmin.username === bootstrapUsername}
              canEdit={canEdit}
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
  canEdit,
}: {
  secretarias: Secretaria[]
  admins: SecretariaAdmin[]
  superAdmins: SuperAdmin[]
  currentUsername: string
  bootstrapUsername: string | null
  projetosResumo: ProjetoResumo[]
  canEdit: boolean
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false)
  const [revealedCredential, setRevealedCredential] = useState<Credential | null>(null)
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
          <Link href="/admin/usuarios" className={buttonVariants({ variant: 'outline', className: 'gap-1.5' })}>
            <Users className="size-4" />
            Ver usuários
          </Link>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setNovoUsuarioOpen(true)} className="gap-1.5">
                <UserPlus className="size-4" />
                Novo usuário
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                Nova secretaria
              </Button>
            </>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          Sua conta tem acesso apenas de visualização: você acompanha os números de todas as secretarias, mas não pode criar, editar ou excluir nada.
        </p>
      )}

      {revealedCredential && (
        <GeneratedPasswordBanner credential={revealedCredential} onDismiss={() => setRevealedCredential(null)} />
      )}

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

      {canEdit && (
        <>
          <NovaSecretariaDialog open={createOpen} onOpenChange={setCreateOpen} secretarias={secretarias} />

          <NovoUsuarioDialog
            open={novoUsuarioOpen}
            onOpenChange={setNovoUsuarioOpen}
            secretarias={secretarias}
            admins={admins}
            projetosResumo={projetosResumo}
            onCreated={setRevealedCredential}
          />
        </>
      )}

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

      <SuperAdminsSection superAdmins={superAdmins} currentUsername={currentUsername} bootstrapUsername={bootstrapUsername} canEdit={canEdit} />
    </div>
  )
}
