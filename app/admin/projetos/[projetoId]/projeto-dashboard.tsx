'use client'

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Minus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatDataLonga(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR')
}

interface MonthlyPoint {
  mes: string
  valor: number | null
  data_referencia: string | null
}

function ChartTooltip({
  active,
  payload,
  unidade,
}: {
  active?: boolean
  payload?: { payload: MonthlyPoint }[]
  unidade: string | null
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  if (point.valor === null || point.data_referencia === null) return null
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-sm shadow-md ring-1 ring-foreground/10">
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
        <p className="font-semibold text-foreground">{formatValor(point.valor, unidade)}</p>
      </div>
      <p className="text-xs text-muted-foreground">{formatDataLonga(point.data_referencia)}</p>
    </div>
  )
}

function DeltaBadge({ delta, deltaPct }: { delta: number; deltaPct: number | null }) {
  if (delta === 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="size-3" />
        estável
      </span>
    )
  }

  const subiu = delta > 0
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
        subiu ? 'bg-accent/15 text-[#00504c]' : 'bg-destructive/10 text-destructive',
      )}
    >
      {subiu ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {deltaPct !== null ? `${Math.abs(deltaPct).toFixed(0)}%` : Math.abs(delta)}
    </span>
  )
}

function BarValueLabel(props: Record<string, unknown> & { unidade: string | null }) {
  const { x, y, width, value, unidade } = props
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof value !== 'number') {
    return null
  }
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0b0b0b">
      {formatValor(value, unidade)}
    </text>
  )
}

function buildMonthlyData(pontos: Indicador[], ano: number): MonthlyPoint[] {
  const porMes = new Map<number, Indicador>()
  for (const ponto of pontos) {
    const data = new Date(`${ponto.data_referencia}T00:00:00`)
    if (data.getFullYear() === ano) {
      porMes.set(data.getMonth(), ponto)
    }
  }

  return MESES.map((mes, indiceMes) => {
    const ponto = porMes.get(indiceMes)
    return {
      mes,
      valor: ponto ? ponto.valor : null,
      data_referencia: ponto?.data_referencia ?? null,
    }
  })
}

function YearSwitcher({ ano, onChange }: { ano: number; onChange: (proximoAno: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(ano - 1)} aria-label="Ano anterior">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="w-11 text-center text-sm font-medium text-foreground">{ano}</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(ano + 1)} aria-label="Próximo ano">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

function IndicadorChart({ titulo, pontos }: { titulo: string; pontos: Indicador[] }) {
  const unidade = pontos[0]?.unidade ?? null
  const primeiro = pontos[0].valor
  const ultimo = pontos[pontos.length - 1].valor
  const delta = ultimo - primeiro
  const deltaPct = primeiro !== 0 ? (delta / Math.abs(primeiro)) * 100 : null
  const anoInicial = new Date(`${pontos[pontos.length - 1].data_referencia}T00:00:00`).getFullYear()
  const [ano, setAno] = useState(anoInicial)
  const dadosMensais = useMemo(() => buildMonthlyData(pontos, ano), [pontos, ano])

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        <DeltaBadge delta={delta} deltaPct={deltaPct} />
      </div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-foreground">{formatValor(ultimo, unidade)}</p>
        <YearSwitcher ano={ano} onChange={setAno} />
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dadosMensais} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: MUTED_TEXT }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
              interval={0}
            />
            <YAxis tick={{ fontSize: 11, fill: MUTED_TEXT }} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<ChartTooltip unidade={unidade} />} cursor={{ fill: 'rgba(0,110,109,0.07)' }} />
            <Bar dataKey="valor" fill={LINE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22}>
              <LabelList dataKey="valor" content={(props) => <BarValueLabel {...props} unidade={unidade} />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
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
          {grupos.map((grupo) => (
            <IndicadorChart key={grupo.titulo} titulo={grupo.titulo} pontos={grupo.pontos} />
          ))}
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
