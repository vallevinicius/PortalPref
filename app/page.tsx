'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  AlertTriangle,
  Headphones,
  LockKeyhole,
  LogIn,
  Eye,
  EyeOff,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Page() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: credential, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Não foi possível entrar.')
        return
      }

      router.push('/admin')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="portal-shell relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-8 text-foreground sm:px-6">
      <div aria-hidden="true" className="portal-grid absolute inset-0 opacity-40" />
      <div aria-hidden="true" className="portal-orbit absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-foreground/10" />

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
            <span aria-hidden="true" className="absolute -bottom-1.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-accent" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-primary">
              Prefeitura Municipal de Saquarema
            </p>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">
              Portal de Dados Integrados
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Ambiente institucional de acesso controlado
            </p>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 px-6 pb-7 pt-6 sm:px-10">
          <div role="alert" className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 text-left">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs leading-5 text-destructive">
              Acesso estritamente restrito a servidores e sistemas autorizados da Prefeitura de Saquarema. Todo acesso é monitorado.
            </p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="credential">Usuário</Label>
              <div className="relative">
                <UserRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="credential"
                  name="credential"
                  autoComplete="username"
                  placeholder="Digite sua matrícula ou CPF"
                  className="h-11 pl-10"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha de Acesso</Label>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  className="h-11 pl-10 pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button type="button" variant="ghost" size="icon" aria-label={showPassword ? 'Ocultar senha' : 'Revelar senha'} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox id="remember" name="remember" className="mt-0.5" />
              <Label htmlFor="remember" className="cursor-pointer text-xs font-normal leading-5 text-muted-foreground">
                Lembrar minha credencial neste dispositivo seguro
              </Label>
            </div>

            <Button type="submit" size="lg" disabled={loading} className="h-12 w-full gap-2 bg-primary font-semibold shadow-md shadow-primary/20 hover:bg-primary/90">
              <LogIn data-icon="inline-start" />
              {loading ? 'Autenticando...' : 'Autenticar e Entrar'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-border/60 bg-muted/35 px-6 py-4 sm:px-10">
          <a href="mailto:suporte@saquarema.rj.gov.br" className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary">
            <Headphones aria-hidden="true" className="size-4" />
            <span>Problemas de acesso? Contate o Suporte de TI</span>
          </a>
        </CardFooter>
      </Card>
    </main>
  )
}
