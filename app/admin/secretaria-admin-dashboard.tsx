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

function NovoProjetoForm() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createProjeto(nome, descricao)
        setNome('')
        setDescricao('')
        toast.success('Projeto criado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível criar o projeto.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="novo-projeto-nome">Nome do projeto</Label>
        <Input id="novo-projeto-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Conexão Universitária" required />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="novo-projeto-descricao">Descrição (opcional)</Label>
        <Input id="novo-projeto-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Criando...' : 'Novo projeto'}
      </Button>
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
