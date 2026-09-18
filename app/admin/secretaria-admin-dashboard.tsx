'use client'

import { UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { createProjeto } from '@/lib/actions/projetos'
import { createProjetoUser } from '@/lib/actions/users'
import type { Projeto } from '@/lib/data'
import { formatTelefone } from '@/lib/format-telefone'
import { PRAZO_PRESETS } from '@/lib/prazo-atualizacao'
import { ProjetoCardGrid } from './projeto-card-grid'

export function NovoProjetoForm({ secretariaId }: { secretariaId?: number }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [responsavelTelefone, setResponsavelTelefone] = useState('')
  const [prazoAtualizacaoDias, setPrazoAtualizacaoDias] = useState('30')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createProjeto(
          nome,
          descricao,
          responsavelNome,
          responsavelTelefone,
          Number(prazoAtualizacaoDias),
          secretariaId,
        )
        setNome('')
        setDescricao('')
        setResponsavelNome('')
        setResponsavelTelefone('')
        setPrazoAtualizacaoDias('30')
        toast.success('Projeto criado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível criar o projeto.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`novo-projeto-nome-${secretariaId ?? 'propria'}`}>Nome do projeto</Label>
          <Input
            id={`novo-projeto-nome-${secretariaId ?? 'propria'}`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Conexão Universitária"
            required
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`novo-projeto-descricao-${secretariaId ?? 'propria'}`}>Descrição (opcional)</Label>
          <Input
            id={`novo-projeto-descricao-${secretariaId ?? 'propria'}`}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Breve descrição"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`novo-projeto-responsavel-nome-${secretariaId ?? 'propria'}`}>Nome completo do responsável</Label>
          <Input
            id={`novo-projeto-responsavel-nome-${secretariaId ?? 'propria'}`}
            value={responsavelNome}
            onChange={(e) => setResponsavelNome(e.target.value)}
            placeholder="Nome completo"
            required
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`novo-projeto-responsavel-telefone-${secretariaId ?? 'propria'}`}>Telefone de contato</Label>
          <Input
            id={`novo-projeto-responsavel-telefone-${secretariaId ?? 'propria'}`}
            type="tel"
            inputMode="numeric"
            value={responsavelTelefone}
            onChange={(e) => setResponsavelTelefone(formatTelefone(e.target.value))}
            placeholder="(22) 90000-0000"
            maxLength={15}
            required
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`novo-projeto-prazo-${secretariaId ?? 'propria'}`}>Prazo de atualização</Label>
          <Select value={prazoAtualizacaoDias} onValueChange={(value) => setPrazoAtualizacaoDias(value ?? '30')}>
            <SelectTrigger id={`novo-projeto-prazo-${secretariaId ?? 'propria'}`} className="w-full">
              <SelectValue>
                {(value: string | null) => PRAZO_PRESETS.find((preset) => String(preset.dias) === value)?.label ?? 'Selecione'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRAZO_PRESETS.map((preset) => (
                <SelectItem key={preset.dias} value={String(preset.dias)}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Criando...' : 'Novo projeto'}
        </Button>
      </div>
    </form>
  )
}

function NovoUsuarioProjetoDialog({
  projetos,
  open,
  onOpenChange,
  onCreated,
}: {
  projetos: Projeto[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (credential: Credential) => void
}) {
  const router = useRouter()
  const [projetoId, setProjetoId] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setProjetoId('')
    setUsername('')
    setEmail('')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!projetoId) return
    startTransition(async () => {
      try {
        const credential = await createProjetoUser(username, email, Number(projetoId))
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
            <Label htmlFor="novo-usuario-projeto-secretaria">Projeto</Label>
            <Select value={projetoId} onValueChange={(value) => setProjetoId(value ?? '')}>
              <SelectTrigger id="novo-usuario-projeto-secretaria" className="w-full">
                <SelectValue placeholder="Selecione o projeto">
                  {(value: string | null) => (value ? projetos.find((p) => String(p.id) === value)?.nome : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projetos.length === 0 && (
              <p className="text-xs text-muted-foreground">Crie um projeto primeiro para poder designar um responsável.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="novo-usuario-projeto-secretaria-nome">Nome de usuário</Label>
            <Input
              id="novo-usuario-projeto-secretaria-nome"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex.: joao.responsavel"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="novo-usuario-projeto-secretaria-email">E-mail de acesso</Label>
            <Input
              id="novo-usuario-projeto-secretaria-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex.: fulano@prefeitura.gov.br"
              required
            />
          </div>

          <Button type="submit" disabled={isPending || !projetoId || !username.trim() || !email.trim()} className="mt-1">
            {isPending ? 'Criando...' : 'Criar usuário + gerar senha'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SecretariaAdminDashboard({ projetos }: { projetos: Projeto[] }) {
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false)
  const [revealedCredential, setRevealedCredential] = useState<Credential | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end gap-2">
        <Link href="/admin/usuarios" className={buttonVariants({ variant: 'outline', className: 'gap-1.5' })}>
          <Users className="size-4" />
          Ver usuários
        </Link>
        <Button variant="outline" onClick={() => setNovoUsuarioOpen(true)} className="gap-1.5">
          <UserPlus className="size-4" />
          Novo usuário
        </Button>
      </div>

      {revealedCredential && (
        <GeneratedPasswordBanner credential={revealedCredential} onDismiss={() => setRevealedCredential(null)} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Novo projeto</CardTitle>
          <CardDescription>Crie um projeto da sua secretaria para começar a lançar números.</CardDescription>
        </CardHeader>
        <CardContent>
          <NovoProjetoForm />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Seus projetos</h3>
        <ProjetoCardGrid projetos={projetos} />
      </div>

      <NovoUsuarioProjetoDialog
        projetos={projetos}
        open={novoUsuarioOpen}
        onOpenChange={setNovoUsuarioOpen}
        onCreated={setRevealedCredential}
      />
    </div>
  )
}
