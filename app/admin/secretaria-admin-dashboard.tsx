'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createIndicador, deleteIndicador } from '@/lib/actions/indicadores'
import { createProjeto, deleteProjeto } from '@/lib/actions/projetos'
import type { Projeto } from '@/lib/data'

function formatValor(valor: number, unidade: string | null) {
  const numero = new Intl.NumberFormat('pt-BR').format(valor)
  return unidade ? `${numero} ${unidade}` : numero
}

function formatData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR')
}

function NovoProjetoForm() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await createProjeto(nome, descricao)
        setNome('')
        setDescricao('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível criar o projeto.')
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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

function NovoIndicadorForm({ projetoId }: { projetoId: number }) {
  const router = useRouter()
  const [titulo, setTitulo] = useState('')
  const [valor, setValor] = useState('')
  const [unidade, setUnidade] = useState('')
  const [data, setData] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await createIndicador(projetoId, titulo, Number(valor), unidade, data)
        setTitulo('')
        setValor('')
        setUnidade('')
        setData('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível salvar o número.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`titulo-${projetoId}`} className="text-xs">Título</Label>
        <Input id={`titulo-${projetoId}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Alunos cadastrados" className="h-8 w-48" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`valor-${projetoId}`} className="text-xs">Valor</Label>
        <Input id={`valor-${projetoId}`} type="number" step="any" value={valor} onChange={(e) => setValor(e.target.value)} className="h-8 w-28" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`unidade-${projetoId}`} className="text-xs">Unidade</Label>
        <Input id={`unidade-${projetoId}`} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="alunos, R$, %" className="h-8 w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`data-${projetoId}`} className="text-xs">Data</Label>
        <Input id={`data-${projetoId}`} type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-8 w-40" required />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Adicionar número'}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  )
}

function ProjetoCard({ projeto }: { projeto: Projeto }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDeleteProjeto() {
    if (!confirm(`Excluir o projeto "${projeto.nome}" e todos os seus números?`)) return
    startTransition(async () => {
      await deleteProjeto(projeto.id)
      router.refresh()
    })
  }

  function handleDeleteIndicador(indicadorId: number) {
    startTransition(async () => {
      await deleteIndicador(indicadorId)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{projeto.nome}</CardTitle>
        {projeto.descricao && <CardDescription>{projeto.descricao}</CardDescription>}
        <CardAction>
          <Button variant="outline" size="sm" onClick={handleDeleteProjeto} disabled={isPending}>
            Excluir projeto
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {projeto.indicadores.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {projeto.indicadores.map((indicador) => (
                  <tr key={indicador.id} className="border-t border-border">
                    <td className="px-3 py-2">{indicador.titulo}</td>
                    <td className="px-3 py-2">{formatValor(indicador.valor, indicador.unidade)}</td>
                    <td className="px-3 py-2">{formatData(indicador.data_referencia)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteIndicador(indicador.id)} disabled={isPending}>
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <NovoIndicadorForm projetoId={projeto.id} />
      </CardContent>
    </Card>
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

      {projetos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado ainda.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {projetos.map((projeto) => (
            <ProjetoCard key={projeto.id} projeto={projeto} />
          ))}
        </div>
      )}
    </div>
  )
}
