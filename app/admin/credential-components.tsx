'use client'

import { Check, Copy, Eye, KeyRound } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSecretariaUser, getSecretariaUserPassword, resetSecretariaUserPassword } from '@/lib/actions/users'
import type { SecretariaAdmin } from '@/lib/data'

export type Credential = { username: string; password: string }

export function GeneratedPasswordBanner({ credential, onDismiss }: { credential: Credential; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(credential.password)
    setCopied(true)
    toast.success('Senha copiada para a área de transferência.')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-4">
      <p className="text-sm font-medium text-foreground">
        Senha de acesso de <span className="font-mono">{credential.username}</span>:
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

export function NovoUsuarioForm({ secretariaId, onCreated }: { secretariaId: number; onCreated: (credential: Credential) => void }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const credential = await createSecretariaUser(username, secretariaId)
        setUsername('')
        onCreated(credential)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível criar o usuário.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="novo-usuario-nome">Usuário de acesso</Label>
        <Input id="novo-usuario-nome" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex.: saude.admin" required />
      </div>
      <Button type="submit" disabled={isPending} className="gap-1.5">
        <KeyRound className="size-3.5" />
        {isPending ? 'Criando...' : 'Criar usuário + gerar senha'}
      </Button>
    </form>
  )
}

export function SecretariaUserPanel({ secretariaId, admin }: { secretariaId: number; admin: SecretariaAdmin | null }) {
  const router = useRouter()
  const [resetPending, setResetPending] = useState(false)
  const [viewPending, setViewPending] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [revealedCredential, setRevealedCredential] = useState<Credential | null>(null)

  function handleReset() {
    if (!admin) return
    setResetPending(true)
    resetSecretariaUserPassword(admin.id)
      .then((result) => {
        setRevealedCredential({ username: admin.username, password: result.password })
        toast.success('Nova senha gerada.')
        router.refresh()
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a nova senha.')
      })
      .finally(() => setResetPending(false))
  }

  function handleViewPassword() {
    if (!admin) return
    setViewPending(true)
    getSecretariaUserPassword(admin.id)
      .then((result) => {
        setRevealedCredential({ username: admin.username, password: result.password })
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível mostrar a senha.')
      })
      .finally(() => setViewPending(false))
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Usuário de acesso</h3>

      {revealedCredential && (
        <GeneratedPasswordBanner credential={revealedCredential} onDismiss={() => setRevealedCredential(null)} />
      )}

      {admin ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <span className="font-mono text-sm">{admin.username}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleViewPassword} disabled={viewPending} className="gap-1.5">
              <Eye className="size-3.5" />
              {viewPending ? 'Carregando...' : 'Ver senha atual'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmResetOpen(true)} disabled={resetPending} className="gap-1.5">
              <KeyRound className="size-3.5" />
              {resetPending ? 'Gerando...' : 'Gerar nova senha'}
            </Button>
          </div>
        </div>
      ) : (
        <NovoUsuarioForm secretariaId={secretariaId} onCreated={setRevealedCredential} />
      )}

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova senha?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha atual de &ldquo;{admin?.username}&rdquo; deixará de funcionar imediatamente.
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
