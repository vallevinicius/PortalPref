'use client'

import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { redefinirSenhaComCodigo, solicitarRecuperacaoSenha } from '@/lib/actions/auth'

const MIN_LENGTH = 6
const CODE_LENGTH = 6

export function EsqueciSenhaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [etapa, setEtapa] = useState<'identificar' | 'redefinir'>('identificar')
  const [credencial, setCredencial] = useState('')
  const [codigo, setCodigo] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [isResending, setIsResending] = useState(false)

  function resetForm() {
    setEtapa('identificar')
    setCredencial('')
    setCodigo('')
    setNovaSenha('')
    setConfirmarSenha('')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  function handleSolicitar(event: React.FormEvent) {
    event.preventDefault()
    setIsPending(true)
    solicitarRecuperacaoSenha(credencial)
      .then(() => {
        toast.success('Se essa conta existir, enviamos um código de confirmação por e-mail.')
        setEtapa('redefinir')
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível enviar o código.')
      })
      .finally(() => setIsPending(false))
  }

  function handleReenviar() {
    setIsResending(true)
    solicitarRecuperacaoSenha(credencial)
      .then(() => {
        toast.success('Se essa conta existir, enviamos um novo código por e-mail.')
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível reenviar o código.')
      })
      .finally(() => setIsResending(false))
  }

  function handleRedefinir(event: React.FormEvent) {
    event.preventDefault()

    if (codigo.trim().length !== CODE_LENGTH) {
      toast.error(`Digite o código de ${CODE_LENGTH} dígitos recebido por e-mail.`)
      return
    }
    if (novaSenha.length < MIN_LENGTH) {
      toast.error(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`)
      return
    }
    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não coincidem.')
      return
    }

    setIsPending(true)
    redefinirSenhaComCodigo(credencial, codigo, novaSenha)
      .then(() => {
        toast.success('Senha redefinida com sucesso.')
        handleOpenChange(false)
        router.push('/admin')
        router.refresh()
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.')
      })
      .finally(() => setIsPending(false))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Esqueci minha senha</DialogTitle>
          <DialogDescription>
            {etapa === 'identificar'
              ? 'Digite seu usuário ou e-mail para receber um código de confirmação.'
              : 'Digite o código recebido por e-mail e escolha uma senha nova.'}
          </DialogDescription>
        </DialogHeader>

        {etapa === 'identificar' ? (
          <form onSubmit={handleSolicitar} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esqueci-credencial">Usuário ou e-mail</Label>
              <div className="relative">
                <UserRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="esqueci-credencial"
                  value={credencial}
                  onChange={(e) => setCredencial(e.target.value)}
                  placeholder="Digite seu usuário ou e-mail"
                  className="h-11 pl-10"
                  required
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" disabled={isPending} className="mt-1 gap-1.5">
              <Mail className="size-4" />
              {isPending ? 'Enviando...' : 'Enviar código'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRedefinir} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esqueci-codigo">Código de confirmação</Label>
              <Input
                id="esqueci-codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="h-11 font-mono tracking-[0.3em]"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                maxLength={CODE_LENGTH}
                required
                autoFocus
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Confira o número que chegou no seu e-mail.</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReenviar}
                  disabled={isResending}
                  className="h-auto p-0 text-xs font-medium text-primary hover:bg-transparent hover:underline"
                >
                  {isResending ? 'Reenviando...' : 'Reenviar código'}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esqueci-nova-senha">Nova senha</Label>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="esqueci-nova-senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Digite sua nova senha"
                  className="h-11 pl-10 pr-11"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  minLength={MIN_LENGTH}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showPassword ? 'Ocultar senha' : 'Revelar senha'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esqueci-confirmar-senha">Confirme a nova senha</Label>
              <Input
                id="esqueci-confirmar-senha"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Digite a senha novamente"
                className="h-11"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                minLength={MIN_LENGTH}
                required
              />
            </div>

            <Button type="submit" disabled={isPending} className="mt-1 gap-1.5">
              <KeyRound className="size-4" />
              {isPending ? 'Salvando...' : 'Redefinir senha'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEtapa('identificar')} className="text-xs">
              Usar outro usuário ou e-mail
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
