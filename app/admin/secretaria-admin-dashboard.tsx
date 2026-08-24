'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProjeto } from '@/lib/actions/projetos'
import type { Projeto } from '@/lib/data'
import { ProjetoCardGrid } from './projeto-card-grid'

function formatTelefone(value: string) {
  const digitos = value.replace(/\D/g, '').slice(0, 11)
  if (digitos.length === 0) return ''
  if (digitos.length <= 2) return `(${digitos}`
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

export function NovoProjetoForm({ secretariaId }: { secretariaId?: number }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [responsavelTelefone, setResponsavelTelefone] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createProjeto(nome, descricao, responsavelNome, responsavelTelefone, secretariaId)
        setNome('')
        setDescricao('')
        setResponsavelNome('')
        setResponsavelTelefone('')
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
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Criando...' : 'Novo projeto'}
        </Button>
      </div>
    </form>
  )
}

export function SecretariaAdminDashboard({ projetos }: { projetos: Projeto[] }) {
  return (
    <div className="flex flex-col gap-6">
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
    </div>
  )
}
