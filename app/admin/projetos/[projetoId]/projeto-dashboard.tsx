'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
import { createIndicador, deleteIndicador } from '@/lib/actions/indicadores'
import { deleteProjeto } from '@/lib/actions/projetos'
import type { Indicador, Projeto } from '@/lib/data'

const LINE_COLOR = '#006e6d'
const GRID_COLOR = '#e1e0d9'
const MUTED_TEXT = '#898781'

function formatValor(valor: number, unidade: string | null) {
  const numero = new Intl.NumberFormat('pt-BR').format(valor)
  return unidade ? `${numero} ${unidade}` : numero
}

function formatDataCurta(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatDataLonga(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR')
}

function ChartTooltip({
  active,
  payload,
  unidade,
}: {
  active?: boolean
  payload?: { payload: Indicador }[]
  unidade: string | null
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-sm shadow-md ring-1 ring-foreground/10">
      <p className="font-semibold text-foreground">{formatValor(point.valor, unidade)}</p>
      <p className="text-xs text-muted-foreground">{formatDataLonga(point.data_referencia)}</p>
    </div>
  )
}

function IndicadorChart({ titulo, pontos }: { titulo: string; pontos: Indicador[] }) {
  const unidade = pontos[0]?.unidade ?? null
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <p className="mb-3 text-sm font-medium text-foreground">{titulo}</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pontos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="data_referencia"
              tickFormatter={formatDataCurta}
              tick={{ fontSize: 11, fill: MUTED_TEXT }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: MUTED_TEXT }} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<ChartTooltip unidade={unidade} />} />
            <Line
              type="monotone"
              dataKey="valor"
              stroke={LINE_COLOR}
              strokeWidth={2}
              dot={{ r: 4, fill: LINE_COLOR, stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: LINE_COLOR, stroke: '#ffffff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function IndicadorStatTile({ titulo, ponto }: { titulo: string; ponto: Indicador }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground">{formatValor(ponto.valor, ponto.unidade)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatDataLonga(ponto.data_referencia)}</p>
    </div>
  )
}

function todayLocalISODate() {
  const hoje = new Date()
  const yyyy = hoje.getFullYear()
  const mm = String(hoje.getMonth() + 1).padStart(2, '0')
  const dd = String(hoje.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function NovoIndicadorForm({ projetoId, projetoNome }: { projetoId: number; projetoNome: string }) {
  const router = useRouter()
  const [valor, setValor] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createIndicador(projetoId, projetoNome, Number(valor), '', todayLocalISODate())
        setValor('')
        toast.success('Número adicionado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o número.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="valor" className="text-xs">Quantidade</Label>
        <Input id="valor" type="number" step="any" value={valor} onChange={(e) => setValor(e.target.value)} className="h-8 w-40" required autoFocus />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Adicionar número'}
      </Button>
    </form>
  )
}

function IndicadoresTable({ indicadores, editable }: { indicadores: Indicador[]; editable: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteIndicador(id)
        toast.success('Número removido.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível remover o número.')
      }
    })
  }

  if (indicadores.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum número lançado ainda.</p>
  }

  const ordenados = [...indicadores].sort((a, b) => b.data_referencia.localeCompare(a.data_referencia))

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Quantidade</th>
            <th className="px-3 py-2">Data</th>
            {editable && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((indicador) => (
            <tr key={indicador.id} className="border-t border-border">
              <td className="px-3 py-2">{formatValor(indicador.valor, indicador.unidade)}</td>
              <td className="px-3 py-2">{formatDataLonga(indicador.data_referencia)}</td>
              {editable && (
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(indicador.id)} disabled={isPending} aria-label="Excluir número">
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DeleteProjetoButton({ projeto }: { projeto: Projeto }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteProjeto(projeto.id)
        toast.success('Projeto excluído.')
        router.push('/admin')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o projeto.')
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={isPending} className="w-fit">
        Excluir projeto
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir &ldquo;{projeto.nome}&rdquo; e todos os seus números. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function ProjetoDashboard({ projeto, editable }: { projeto: Projeto; editable: boolean }) {
  const grupos = useMemo(() => {
    const byTitulo = new Map<string, Indicador[]>()
    for (const indicador of projeto.indicadores) {
      const lista = byTitulo.get(indicador.titulo) ?? []
      lista.push(indicador)
      byTitulo.set(indicador.titulo, lista)
    }
    return Array.from(byTitulo.entries()).map(([titulo, pontos]) => ({
      titulo,
      pontos: [...pontos].sort((a, b) => a.data_referencia.localeCompare(b.data_referencia)),
    }))
  }, [projeto.indicadores])

  return (
    <div className="flex flex-col gap-6">
      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum número lançado ainda por este projeto.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {grupos.map((grupo) =>
            grupo.pontos.length >= 2 ? (
              <IndicadorChart key={grupo.titulo} titulo={grupo.titulo} pontos={grupo.pontos} />
            ) : (
              <IndicadorStatTile key={grupo.titulo} titulo={grupo.titulo} ponto={grupo.pontos[0]} />
            ),
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Todos os valores</h3>
        <IndicadoresTable indicadores={projeto.indicadores} editable={editable} />
      </div>

      {editable && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Lançar número</h3>
          <NovoIndicadorForm projetoId={projeto.id} projetoNome={projeto.nome} />
          <DeleteProjetoButton projeto={projeto} />
        </div>
      )}
    </div>
  )
}
