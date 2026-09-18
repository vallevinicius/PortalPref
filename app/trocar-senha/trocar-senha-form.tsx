'use client'

import { Eye, EyeOff, KeyRound, LockKeyhole, Mail } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { definirNovaSenha, reenviarCodigoVerificacao } from '@/lib/actions/auth'

const MIN_LENGTH = 6
const CODE_LENGTH = 6

export function TrocarSenhaForm() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [isResending, setIsResending] = useState(false)

  function handleSubmit(event: React.FormEvent) {
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
    definirNovaSenha(codigo, novaSenha)
      .then(() => {
        toast.success('Senha definida com sucesso.')
        router.push('/admin')
        router.refresh()
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível definir a senha.')
      })
      .finally(() => setIsPending(false))
  }

  function handleResend() {
    setIsResending(true)
    reenviarCodigoVerificacao()
      .then(() => {
        toast.success('Um novo código foi enviado para o seu e-mail.')
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível reenviar o código.')
      })
      .finally(() => setIsResending(false))
  }

  return (
    <Card className="relative z-10 w-full max-w-[29rem] border-border/70 bg-card/95 shadow-2xl shadow-background/40 backdrop-blur-md">
      <CardHeader className="items-center gap-5 px-6 pb-2 pt-8 text-center sm:px-10 sm:pt-10">
        <div className="relative inline-flex items-center justify-center rounded-2xl border border-accent/30 bg-primary px-6 py-4 shadow-lg shadow-primary/20">
          <Image
            src="/Pref.png"
            alt="Prefeitura Municipal de Saquarema"
            width={296}
            height={100}
            className="h-10 w-auto sm:h-11"
            priority
          />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">
            Defina sua nova senha
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Sua conta foi criada com uma senha padrão. Enviamos um código de confirmação para o seu e-mail cadastrado
            — digite-o abaixo e escolha uma senha só sua antes de continuar.
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 px-6 pb-7 pt-6 sm:px-10">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="codigo-verificacao">Código de confirmação</Label>
            <div className="relative">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="codigo-verificacao"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="h-11 pl-10 font-mono tracking-[0.3em]"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                maxLength={CODE_LENGTH}
                required
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Confira o número que chegou no seu e-mail.</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={isResending}
                className="h-auto p-0 text-xs font-medium text-primary hover:bg-transparent hover:underline"
              >
                {isResending ? 'Reenviando...' : 'Reenviar código'}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="nova-senha"
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmar-senha">Confirme a nova senha</Label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmar-senha"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Digite a senha novamente"
                className="h-11 pl-10"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                minLength={MIN_LENGTH}
                required
              />
            </div>
          </div>

          <Button type="submit" size="lg" disabled={isPending} className="h-12 w-full gap-2 bg-primary font-semibold shadow-md shadow-primary/20 hover:bg-primary/90">
            <KeyRound data-icon="inline-start" />
            {isPending ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
