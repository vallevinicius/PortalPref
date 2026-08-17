'use client'

import { Eye, KeyRound, Plus, ScrollText, ShieldPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmPasswordDialog, GeneratedPasswordBanner, type Credential } from './credential-components'
import { createSecretaria } from '@/lib/actions/secretarias'
import { createSuperAdmin, getSuperAdminPassword, resetSuperAdminPassword } from '@/lib/actions/users'
import type { Secretaria, SecretariaAdmin, SuperAdmin } from '@/lib/data'
import { getSecretariaIcon } from '@/lib/secretaria-icon'

function NovaSecretariaDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createSecretaria(nome)
        setNome('')
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
        if (!next) setNome('')
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova secretaria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nova-secretaria-nome">Nome da secretaria</Label>
            <Input id="nova-secretaria-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Secretaria de Saúde" required />
          </div>
          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? 'Criando...' : 'Criar secretaria'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
  onCredentialRevealed,
}: {
  superAdmin: SuperAdmin
  isCurrentUser: boolean
  onCredentialRevealed: (credential: Credential) => void
}) {
  const router = useRouter()
  const [resetPending, setResetPending] = useState(false)
  const [viewPending, setViewPending] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [confirmViewOpen, setConfirmViewOpen] = useState(false)

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

function SuperAdminsSection({ superAdmins, currentUsername }: { superAdmins: SuperAdmin[]; currentUsername: string }) {
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
              onCredentialRevealed={setRevealedCredential}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SuperAdminDashboard({
  secretarias,
  admins,
  superAdmins,
  currentUsername,
}: {
  secretarias: Secretaria[]
  admins: SecretariaAdmin[]
  superAdmins: SuperAdmin[]
  currentUsername: string
}) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Secretarias</h2>
          <p className="text-sm text-muted-foreground">
            {secretarias.length} cadastrada(s) — clique em uma abaixo para gerenciar o usuário e ver os números.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          Nova secretaria
        </Button>
      </div>

      <NovaSecretariaDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="flex justify-start">
        <Link href="/admin/audit-log" className={buttonVariants({ variant: 'outline', className: 'gap-1.5' })}>
          <ScrollText className="size-4" />
          Ver audit log completo
        </Link>
      </div>

      <SecretariaGrid secretarias={secretarias} admins={admins} />

      <SuperAdminsSection superAdmins={superAdmins} currentUsername={currentUsername} />
    </div>
  )
}
