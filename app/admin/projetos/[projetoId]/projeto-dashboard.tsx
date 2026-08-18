'use client'

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createIndicador, deleteIndicador, renameIndicadorGrupo } from '@/lib/actions/indicadores'
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

interface Bucket {
  label: string
  valor: number | null
  data_referencia: string | null
}

function ChartTooltip({
  active,
  payload,
  unidade,
}: {
  active?: boolean
  payload?: { payload: Bucket }[]
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

type RangeKey = 'dias' | 'semanas' | 'mes' | '6meses' | '1ano'

const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'dias', label: 'Dias' },
  { key: 'semanas', label: 'Semanas' },
  { key: 'mes', label: 'Mês' },
  { key: '6meses', label: '6 Meses' },
  { key: '1ano', label: '1 Ano' },
]

function pontoDate(ponto: Indicador) {
  return new Date(`${ponto.data_referencia}T00:00:00`)
}

function formatDiaMes(data: Date) {
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`
}

function buildBucketedData(pontos: Indicador[], range: RangeKey): Bucket[] {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (range === 'dias' || range === 'mes') {
    const numDias = range === 'dias' ? 7 : 30
    const totalPorDia = new Map<string, number>()
    for (const ponto of pontos) {
      totalPorDia.set(ponto.data_referencia, (totalPorDia.get(ponto.data_referencia) ?? 0) + ponto.valor)
    }

    return Array.from({ length: numDias }, (_, indice) => {
      const dia = new Date(hoje)
      dia.setDate(dia.getDate() - (numDias - 1 - indice))
      const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
      const total = totalPorDia.get(iso)
      return {
        label: formatDiaMes(dia),
        valor: total ?? null,
        data_referencia: total !== undefined ? iso : null,
      }
    })
  }

  if (range === 'semanas') {
    const numSemanas = 8
    return Array.from({ length: numSemanas }, (_, indice) => {
      const deslocamento = numSemanas - 1 - indice
      const inicio = new Date(hoje)
      inicio.setDate(inicio.getDate() - deslocamento * 7 - 6)
      const fim = new Date(hoje)
      fim.setDate(fim.getDate() - deslocamento * 7)
      const pontosNaSemana = pontos.filter((ponto) => {
        const data = pontoDate(ponto)
        return data >= inicio && data <= fim
      })
      if (pontosNaSemana.length === 0) {
        return { label: formatDiaMes(inicio), valor: null, data_referencia: null }
      }
      const total = pontosNaSemana.reduce((soma, ponto) => soma + ponto.valor, 0)
      return {
        label: formatDiaMes(inicio),
        valor: total,
        data_referencia: pontosNaSemana[pontosNaSemana.length - 1].data_referencia,
      }
    })
  }

  const numMeses = range === '6meses' ? 6 : 12
  return Array.from({ length: numMeses }, (_, indice) => {
    const deslocamento = numMeses - 1 - indice
    const refAno = hoje.getFullYear()
    const refMes = hoje.getMonth() - deslocamento
    const pontosNoMes = pontos.filter((ponto) => {
      const data = pontoDate(ponto)
      const mesAbsoluto = data.getFullYear() * 12 + data.getMonth()
      return mesAbsoluto === refAno * 12 + refMes
    })
    const mesNormalizado = ((refMes % 12) + 12) % 12
    if (pontosNoMes.length === 0) {
      return { label: MESES[mesNormalizado], valor: null, data_referencia: null }
    }
    const total = pontosNoMes.reduce((soma, ponto) => soma + ponto.valor, 0)
    return {
      label: MESES[mesNormalizado],
      valor: total,
      data_referencia: pontosNoMes[pontosNoMes.length - 1].data_referencia,
    }
  })
}

function RangeSwitcher({ range, onChange }: { range: RangeKey; onChange: (proximoRange: RangeKey) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
      {RANGE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onChange(preset.key)}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
            preset.key === range
              ? 'bg-card text-foreground shadow-sm ring-1 ring-foreground/10'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

function IndicadorChart({
  titulo,
  pontos,
  projetoId,
  editable,
}: {
  titulo: string
  pontos: Indicador[]
  projetoId: number
  editable: boolean
}) {
  const unidade = pontos[0]?.unidade ?? null
  const total = pontos.reduce((soma, ponto) => soma + ponto.valor, 0)
  const primeiro = pontos[0].valor
  const ultimo = pontos[pontos.length - 1].valor
  const delta = ultimo - primeiro
  const deltaPct = primeiro !== 0 ? (delta / Math.abs(primeiro)) * 100 : null
  const [range, setRange] = useState<RangeKey>('1ano')
  const dadosBucket = useMemo(() => buildBucketedData(pontos, range), [pontos, range])
  const tickInterval = dadosBucket.length > 15 ? Math.ceil(dadosBucket.length / 10) - 1 : 0

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-foreground">{titulo}</p>
          {editable && <RenomearGraficoButton projetoId={projetoId} tituloAtual={titulo} />}
        </div>
        <DeltaBadge delta={delta} deltaPct={deltaPct} />
      </div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-foreground">{formatValor(total, unidade)}</p>
      </div>
      <div className="mb-3">
        <RangeSwitcher range={range} onChange={setRange} />
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dadosBucket} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: MUTED_TEXT }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis tick={{ fontSize: 11, fill: MUTED_TEXT }} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<ChartTooltip unidade={unidade} />} cursor={{ fill: 'rgba(0,110,109,0.07)' }} />
            <Bar dataKey="valor" fill={LINE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22}>
              <LabelList dataKey="valor" content={(props) => <BarValueLabel {...props} unidade={unidade} />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {editable && <NovoIndicadorForm projetoId={projetoId} titulo={titulo} />}
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

function NovoIndicadorForm({ projetoId, titulo }: { projetoId: number; titulo: string }) {
  const router = useRouter()
  const [valor, setValor] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createIndicador(projetoId, titulo, Number(valor), '', todayLocalISODate())
        setValor('')
        toast.success('Número adicionado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o número.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
      <Input
        type="number"
        step="any"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Novo valor"
        aria-label={`Novo valor para ${titulo}`}
        className="h-8 flex-1"
        required
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Adicionar'}
      </Button>
    </form>
  )
}

function NovoGraficoButton({ projetoId }: { projetoId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createIndicador(projetoId, nome, Number(valor), '', todayLocalISODate())
        setNome('')
        setValor('')
        setOpen(false)
        toast.success('Gráfico criado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível criar o gráfico.')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-3.5" />
        Adicionar gráfico
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo gráfico</DialogTitle>
            <DialogDescription>Escolha um nome para o novo gráfico ou estatística deste projeto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="novo-grafico-nome">Nome do gráfico</Label>
              <Input
                id="novo-grafico-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Número de vistorias"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="novo-grafico-valor">Quantidade inicial</Label>
              <Input
                id="novo-grafico-valor"
                type="number"
                step="any"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Criando...' : 'Criar gráfico'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RenomearGraficoButton({ projetoId, tituloAtual }: { projetoId: number; tituloAtual: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState(tituloAtual)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setNome(tituloAtual)
    setOpen(nextOpen)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await renameIndicadorGrupo(projetoId, tituloAtual, nome)
        setOpen(false)
        toast.success('Gráfico renomeado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível renomear o gráfico.')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleOpenChange(true)} aria-label="Renomear gráfico">
        <Pencil className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear gráfico</DialogTitle>
            <DialogDescription>O novo nome vale para todos os números já lançados neste gráfico.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="renomear-grafico-nome">Nome do gráfico</Label>
              <Input
                id="renomear-grafico-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

const VALORES_POR_PAGINA = 5

function IndicadoresTable({ indicadores, editable }: { indicadores: Indicador[]; editable: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pagina, setPagina] = useState(1)

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
  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / VALORES_POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * VALORES_POR_PAGINA
  const itensDaPagina = ordenados.slice(inicio, inicio + VALORES_POR_PAGINA)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Gráfico</th>
              <th className="px-3 py-2">Quantidade</th>
              <th className="px-3 py-2">Data</th>
              {editable && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {itensDaPagina.map((indicador) => (
              <tr key={indicador.id} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">{indicador.titulo}</td>
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
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground">
            Página {paginaAtual} de {totalPaginas}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
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
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Gráficos</h3>
        {editable && <NovoGraficoButton projetoId={projeto.id} />}
      </div>

      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum número lançado ainda por este projeto.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {grupos.map((grupo) => (
            <IndicadorChart
              key={grupo.titulo}
              titulo={grupo.titulo}
              pontos={grupo.pontos}
              projetoId={projeto.id}
              editable={editable}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Todos os valores</h3>
        <IndicadoresTable indicadores={projeto.indicadores} editable={editable} />
      </div>

      {editable && (
        <div className="flex flex-col gap-3">
          <DeleteProjetoButton projeto={projeto} />
        </div>
      )}
    </div>
  )
}
