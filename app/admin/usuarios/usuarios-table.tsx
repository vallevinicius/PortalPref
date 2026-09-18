'use client'

import { ChevronDown, Mail, Pencil, Plus, Search, Trash2, UserX, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { assignProjetoUser, deleteUser, enviarRedefinicaoSenha, unassignProjetoUser, updateUserProfile } from '@/lib/actions/users'
import type { ProjetoResumo, UsuarioResumo } from '@/lib/data'
import { getSecretariaIcon } from '@/lib/secretaria-icon'

function cargoLabel(role: UsuarioResumo['role']) {
  return role === 'secretaria_admin' ? 'Secretário' : 'Responsável de projeto'
}

const PROJETOS_VISIVEIS = 2

function ProjetosCell({ usuario }: { usuario: UsuarioResumo }) {
  const [expandido, setExpandido] = useState(false)

  if (usuario.role === 'secretaria_admin' || usuario.projetos.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const podeRecolher = usuario.projetos.length > PROJETOS_VISIVEIS
  const visiveis = expandido || !podeRecolher ? usuario.projetos : usuario.projetos.slice(0, PROJETOS_VISIVEIS)
  const ocultos = podeRecolher && !expandido ? usuario.projetos.length - PROJETOS_VISIVEIS : 0

  return (
    <div className="flex max-w-xs flex-wrap gap-1">
      {visiveis.map((projeto) => (
        <Badge key={projeto.id} variant="outline" className="font-normal">
          {projeto.nome}
        </Badge>
      ))}
      {podeRecolher && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {expandido ? 'ver menos' : `+${ocultos} mais`}
        </button>
      )}
    </div>
  )
}

function ProjetosDoUsuario({ usuario, projetosDaSecretaria }: { usuario: UsuarioResumo; projetosDaSecretaria: ProjetoResumo[] }) {
  const router = useRouter()
  const [novoProjetoId, setNovoProjetoId] = useState('')
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [isAdding, startAdding] = useTransition()

  const projetosDisponiveis = useMemo(
    () => projetosDaSecretaria.filter((p) => !usuario.projetos.some((atual) => atual.id === p.id)),
    [projetosDaSecretaria, usuario.projetos],
  )

  function handleRemove(projetoId: number) {
    setPendingId(projetoId)
    unassignProjetoUser(usuario.id, projetoId)
      .then(() => {
        toast.success('Projeto removido do responsável.')
        router.refresh()
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível remover o projeto.')
      })
      .finally(() => setPendingId(null))
  }

  function handleAdd() {
    if (!novoProjetoId) return
    startAdding(async () => {
      try {
        await assignProjetoUser(usuario.id, Number(novoProjetoId))
        setNovoProjetoId('')
        toast.success('Projeto adicionado ao responsável.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível adicionar o projeto.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Projetos sob responsabilidade</Label>
      {usuario.projetos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum projeto vinculado.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {usuario.projetos.map((projeto) => (
            <li
              key={projeto.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm"
            >
              <span className="text-foreground">{projeto.nome}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemove(projeto.id)}
                disabled={pendingId === projeto.id || (usuario.projetos.length === 1 && projetosDisponiveis.length === 0)}
                aria-label={`Remover ${projeto.nome}`}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {projetosDisponiveis.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Select value={novoProjetoId} onValueChange={(value) => setNovoProjetoId(value ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Adicionar outro projeto...">
                  {(value: string | null) => (value ? projetosDisponiveis.find((p) => String(p.id) === value)?.nome : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projetosDisponiveis.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!novoProjetoId || isAdding} className="gap-1.5">
            <Plus className="size-3.5" />
            {isAdding ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      )}
    </div>
  )
}

function EditarUsuarioDialog({
  usuario,
  projetosDaSecretaria,
  open,
  onOpenChange,
}: {
  usuario: UsuarioResumo
  projetosDaSecretaria: ProjetoResumo[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [username, setUsername] = useState(usuario.username)
  const [email, setEmail] = useState(usuario.email ?? '')
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setUsername(usuario.username)
      setEmail(usuario.email ?? '')
    }
    onOpenChange(nextOpen)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await updateUserProfile(usuario.id, username, email)
        toast.success('Usuário atualizado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o usuário.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>{cargoLabel(usuario.role)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-usuario-nome">Nome de usuário</Label>
            <Input id="editar-usuario-nome" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-usuario-email">E-mail</Label>
            <Input id="editar-usuario-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </form>

        {usuario.role === 'projeto_admin' && (
          <>
            <div className="h-px bg-border" />
            <ProjetosDoUsuario usuario={usuario} projetosDaSecretaria={projetosDaSecretaria} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ExcluirUsuarioDialog({
  usuario,
  open,
  onOpenChange,
}: {
  usuario: UsuarioResumo
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteUser(usuario.id)
        onOpenChange(false)
        toast.success('Usuário excluído.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o usuário.')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso vai excluir o acesso de &ldquo;{usuario.username}&rdquo; ({cargoLabel(usuario.role)}). Essa ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RedefinirSenhaDialog({
  usuario,
  open,
  onOpenChange,
}: {
  usuario: UsuarioResumo
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [sendingReset, setSendingReset] = useState(false)

  function handleSendReset() {
    setSendingReset(true)
    enviarRedefinicaoSenha(usuario.id)
      .then(() => {
        toast.success(`E-mail de redefinição enviado para ${usuario.username}.`)
        onOpenChange(false)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail de redefinição.')
      })
      .finally(() => setSendingReset(false))
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar e-mail de redefinição de senha?</AlertDialogTitle>
          <AlertDialogDescription>
            Vamos mandar um código de confirmação para o e-mail de &ldquo;{usuario.username}&rdquo;. A senha atual
            continua funcionando até a pessoa concluir a redefinição.
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
  )
}

function UsuarioRow({ usuario, projetos, canEdit }: { usuario: UsuarioResumo; projetos: ProjetoResumo[]; canEdit: boolean }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const projetosDaSecretaria = useMemo(
    () => projetos.filter((p) => p.secretaria_id === usuario.secretaria_id),
    [projetos, usuario.secretaria_id],
  )

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium text-foreground">{usuario.username}</td>
      <td className="px-3 py-2 text-muted-foreground">{usuario.email ?? '—'}</td>
      <td className="px-3 py-2">
        <Badge variant={usuario.role === 'secretaria_admin' ? 'default' : 'secondary'}>{cargoLabel(usuario.role)}</Badge>
      </td>
      <td className="px-3 py-2">
        <ProjetosCell usuario={usuario} />
      </td>
      <td className="px-3 py-2 text-right">
        {canEdit ? (
          <>
            <Button variant="ghost" size="icon-sm" onClick={() => setResetOpen(true)} aria-label={`Redefinir senha de ${usuario.username}`}>
              <Mail className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)} aria-label={`Editar ${usuario.username}`}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteOpen(true)} aria-label={`Excluir ${usuario.username}`}>
              <Trash2 className="size-3.5" />
            </Button>
            <RedefinirSenhaDialog usuario={usuario} open={resetOpen} onOpenChange={setResetOpen} />
            <EditarUsuarioDialog usuario={usuario} projetosDaSecretaria={projetosDaSecretaria} open={editOpen} onOpenChange={setEditOpen} />
            <ExcluirUsuarioDialog usuario={usuario} open={deleteOpen} onOpenChange={setDeleteOpen} />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

function UsuariosTabela({ usuarios, projetos, canEdit }: { usuarios: UsuarioResumo[]; projetos: ProjetoResumo[]; canEdit: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Usuário</th>
            <th className="px-3 py-2 font-medium">E-mail</th>
            <th className="px-3 py-2 font-medium">Cargo</th>
            <th className="px-3 py-2 font-medium">Projeto</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <UsuarioRow key={usuario.id} usuario={usuario} projetos={projetos} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

type GrupoSecretaria = {
  secretariaId: number | null
  secretariaNome: string | null
  usuarios: UsuarioResumo[]
}

function agruparPorSecretaria(usuarios: UsuarioResumo[]): GrupoSecretaria[] {
  const grupos = new Map<string, GrupoSecretaria>()

  for (const usuario of usuarios) {
    const chave = usuario.secretaria_id !== null ? String(usuario.secretaria_id) : 'sem-secretaria'
    if (!grupos.has(chave)) {
      grupos.set(chave, { secretariaId: usuario.secretaria_id, secretariaNome: usuario.secretaria_nome, usuarios: [] })
    }
    grupos.get(chave)!.usuarios.push(usuario)
  }

  for (const grupo of grupos.values()) {
    grupo.usuarios.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'secretaria_admin' ? -1 : 1
      return a.username.localeCompare(b.username)
    })
  }

  return Array.from(grupos.values()).sort((a, b) => {
    if (a.secretariaNome === null) return 1
    if (b.secretariaNome === null) return -1
    return a.secretariaNome.localeCompare(b.secretariaNome)
  })
}

function GrupoSecretariaCard({ grupo, projetos, canEdit }: { grupo: GrupoSecretaria; projetos: ProjetoResumo[]; canEdit: boolean }) {
  const [open, setOpen] = useState(true)
  const Icon = grupo.secretariaNome ? getSecretariaIcon(grupo.secretariaNome) : UserX

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 border-b border-border bg-muted/40 px-4 py-3 text-left"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Icon className="size-4" />
        </div>
        <div className="flex flex-1 items-baseline gap-2">
          <CardTitle className="text-sm">{grupo.secretariaNome ?? 'Sem secretaria vinculada'}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {grupo.usuarios.length} usuário{grupo.usuarios.length === 1 ? '' : 's'}
          </span>
        </div>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <CardContent className="p-0">
          <UsuariosTabela usuarios={grupo.usuarios} projetos={projetos} canEdit={canEdit} />
        </CardContent>
      )}
    </Card>
  )
}

export function UsuariosTable({
  usuarios,
  projetos,
  canEdit,
}: {
  usuarios: UsuarioResumo[]
  projetos: ProjetoResumo[]
  canEdit: boolean
}) {
  const [busca, setBusca] = useState('')

  const usuariosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter((usuario) => {
      if (usuario.username.toLowerCase().includes(q)) return true
      if (usuario.email?.toLowerCase().includes(q)) return true
      if (usuario.secretaria_nome?.toLowerCase().includes(q)) return true
      if (usuario.projetos.some((p) => p.nome.toLowerCase().includes(q))) return true
      return false
    })
  }, [usuarios, busca])

  const grupos = useMemo(() => agruparPorSecretaria(usuariosFiltrados), [usuariosFiltrados])

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por usuário, e-mail, secretaria ou projeto..."
          className="h-10 pl-10"
        />
      </div>

      {grupos.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {busca.trim() ? `Nenhum usuário encontrado para "${busca}".` : 'Nenhum usuário cadastrado ainda.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((grupo) => (
            <GrupoSecretariaCard key={grupo.secretariaId ?? 'sem-secretaria'} grupo={grupo} projetos={projetos} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
