'use client'

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Clock, Gauge, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createIndicador,
  deleteIndicador,
  deleteIndicadorGrupo,
  removeIndicadorEscala,
  renameIndicadorGrupo,
  setIndicadorEscala,
} from '@/lib/actions/indicadores'
import { deleteProjeto, setPrazoAtualizacao, updateProjeto } from '@/lib/actions/projetos'
import type { Indicador, IndicadorEscala, Projeto } from '@/lib/data'
import { formatTelefone } from '@/lib/format-telefone'
import { PRAZO_PRESETS } from '@/lib/prazo-atualizacao'

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

const ESCALA_NIVEIS = [
  { label: 'Ruim', color: '#971010' },
  { label: 'Razoável', color: '#cf6428' },
  { label: 'Bom', color: '#cca821' },
  { label: 'Ótimo', color: '#55a35f' },
  { label: 'Excelente', color: '#146530' },
]

function classificarValor(valor: number, escala: IndicadorEscala) {
  const intervalo = escala.valor_maximo - escala.valor_minimo
  if (intervalo <= 0) return null
  const fracao = Math.min(1, Math.max(0, (valor - escala.valor_minimo) / intervalo))
  const indice = Math.min(4, Math.floor(fracao * 5))
  return ESCALA_NIVEIS[escala.crescente_melhor ? indice : 4 - indice]
}

function EscalaBadge({ valor, escala }: { valor: number; escala: IndicadorEscala }) {
  const nivel = classificarValor(valor, escala)
  if (!nivel) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: nivel.color }} />
      {nivel.label}
    </span>
  )
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

type RangeKey = 'dias' | 'semanas' | 'mes' | '6meses' | '1ano' | 'total'

const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'dias', label: 'Dias' },
  { key: 'semanas', label: 'Semanas' },
  { key: 'mes', label: 'Mês' },
  { key: '6meses', label: '6 Meses' },
  { key: '1ano', label: '1 Ano' },
  { key: 'total', label: 'Total' },
]

function pontoDate(ponto: Indicador) {
  return new Date(`${ponto.data_referencia}T00:00:00`)
}

function formatDiaMes(data: Date) {
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`
}

function formatMesAno(ano: number, mes: number) {
  return `${MESES[mes]}/${String(ano).slice(2)}`
}

// Desloca a data de referência ("hoje") para trás em janelas inteiras do período,
// permitindo navegar para períodos mais antigos (offset > 0).
function shiftReferenceDate(hoje: Date, range: RangeKey, offset: number): Date {
  const data = new Date(hoje)
  if (offset === 0) return data
  if (range === 'dias') data.setDate(data.getDate() - offset * 7)
  else if (range === 'mes') data.setDate(data.getDate() - offset * 30)
  else if (range === 'semanas') data.setDate(data.getDate() - offset * 56)
  else if (range === '6meses') data.setMonth(data.getMonth() - offset * 6)
  return data
}

function buildBucketedData(pontos: Indicador[], range: RangeKey, anoReferencia: number, offset: number): Bucket[] {
  const hojeBase = new Date()
  hojeBase.setHours(0, 0, 0, 0)
  const hoje = shiftReferenceDate(hojeBase, range, offset)

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

  if (range === '1ano') {
    return MESES.map((mes, indiceMes) => {
      const pontosNoMes = pontos.filter((ponto) => {
        const data = pontoDate(ponto)
        return data.getFullYear() === anoReferencia && data.getMonth() === indiceMes
      })
      if (pontosNoMes.length === 0) {
        return { label: mes, valor: null, data_referencia: null }
      }
      const total = pontosNoMes.reduce((soma, ponto) => soma + ponto.valor, 0)
      return {
        label: mes,
        valor: total,
        data_referencia: pontosNoMes[pontosNoMes.length - 1].data_referencia,
      }
    })
  }

  if (range === 'total') {
    const anos = pontos.map((ponto) => pontoDate(ponto).getFullYear())
    const anoMinimo = Math.min(...anos)
    const anoMaximo = Math.max(...anos)
    return Array.from({ length: anoMaximo - anoMinimo + 1 }, (_, indice) => {
      const anoBucket = anoMinimo + indice
      const pontosNoAno = pontos.filter((ponto) => pontoDate(ponto).getFullYear() === anoBucket)
      if (pontosNoAno.length === 0) {
        return { label: String(anoBucket), valor: null, data_referencia: null }
      }
      const total = pontosNoAno.reduce((soma, ponto) => soma + ponto.valor, 0)
      return {
        label: String(anoBucket),
        valor: total,
        data_referencia: pontosNoAno[pontosNoAno.length - 1].data_referencia,
      }
    })
  }

  const numMeses = 6
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

function YearSwitcher({ ano, onChange }: { ano: number; onChange: (proximoAno: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(ano - 1)} aria-label="Ano anterior">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="w-10 text-center text-sm font-medium text-foreground">{ano}</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(ano + 1)} aria-label="Próximo ano">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

function formatPeriodoLabel(range: RangeKey, offset: number): string {
  const hojeBase = new Date()
  hojeBase.setHours(0, 0, 0, 0)
  const fim = shiftReferenceDate(hojeBase, range, offset)

  if (range === '6meses') {
    const absFim = fim.getFullYear() * 12 + fim.getMonth()
    const absInicio = absFim - 5
    const anoInicio = Math.floor(absInicio / 12)
    const mesInicio = ((absInicio % 12) + 12) % 12
    return `${formatMesAno(anoInicio, mesInicio)} – ${formatMesAno(fim.getFullYear(), fim.getMonth())}`
  }

  const inicio = new Date(fim)
  if (range === 'dias') inicio.setDate(inicio.getDate() - 6)
  else if (range === 'mes') inicio.setDate(inicio.getDate() - 29)
  else if (range === 'semanas') inicio.setDate(inicio.getDate() - 55)

  return `${formatDiaMes(inicio)} – ${formatDiaMes(fim)}`
}

function PeriodSwitcher({ range, offset, onChange }: { range: RangeKey; offset: number; onChange: (proximoOffset: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(offset + 1)} aria-label="Período anterior">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-26 text-center text-xs font-medium text-foreground">{formatPeriodoLabel(range, offset)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(Math.max(0, offset - 1))}
        disabled={offset === 0}
        aria-label="Próximo período"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

function IndicadorChart({
  titulo,
  pontos,
  projetoId,
  editable,
  escala,
}: {
  titulo: string
  pontos: Indicador[]
  projetoId: number
  editable: boolean
  escala: IndicadorEscala | undefined
}) {
  const unidade = pontos[0]?.unidade ?? null
  const primeiro = pontos[0].valor
  const ultimo = pontos[pontos.length - 1].valor
  const delta = ultimo - primeiro
  const deltaPct = primeiro !== 0 ? (delta / Math.abs(primeiro)) * 100 : null
  const [range, setRange] = useState<RangeKey>('1ano')
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [offset, setOffset] = useState(0)
  const dadosBucket = useMemo(() => buildBucketedData(pontos, range, ano, offset), [pontos, range, ano, offset])
  const totalPeriodo = useMemo(
    () => dadosBucket.reduce((soma, bucket) => soma + (bucket.valor ?? 0), 0),
    [dadosBucket],
  )
  const tickInterval = dadosBucket.length > 15 ? Math.ceil(dadosBucket.length / 10) - 1 : 0

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-foreground">{titulo}</p>
          {editable && <RenomearGraficoButton projetoId={projetoId} tituloAtual={titulo} />}
          {editable && <EscalaConfigButton projetoId={projetoId} titulo={titulo} escala={escala} />}
          {editable && <DeleteGraficoButton projetoId={projetoId} titulo={titulo} />}
        </div>
        <DeltaBadge delta={delta} deltaPct={deltaPct} />
      </div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-foreground">{formatValor(totalPeriodo, unidade)}</p>
        {escala && <EscalaBadge valor={totalPeriodo} escala={escala} />}
      </div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <RangeSwitcher
          range={range}
          onChange={(proximoRange) => {
            setRange(proximoRange)
            setOffset(0)
          }}
        />
        {range === '1ano' && <YearSwitcher ano={ano} onChange={setAno} />}
        {range !== '1ano' && range !== 'total' && <PeriodSwitcher range={range} offset={offset} onChange={setOffset} />}
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

function EscalaConfigButton({
  projetoId,
  titulo,
  escala,
}: {
  projetoId: number
  titulo: string
  escala: IndicadorEscala | undefined
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [minimo, setMinimo] = useState('')
  const [maximo, setMaximo] = useState('')
  const [direcao, setDirecao] = useState<'melhor' | 'pior'>('melhor')
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setMinimo(escala ? String(escala.valor_minimo) : '')
      setMaximo(escala ? String(escala.valor_maximo) : '')
      setDirecao(escala && !escala.crescente_melhor ? 'pior' : 'melhor')
    }
    setOpen(nextOpen)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await setIndicadorEscala(projetoId, titulo, Number(minimo), Number(maximo), direcao === 'melhor')
        setOpen(false)
        toast.success('Escala configurada.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível configurar a escala.')
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeIndicadorEscala(projetoId, titulo)
        setOpen(false)
        toast.success('Escala removida.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível remover a escala.')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleOpenChange(true)} aria-label="Configurar escala">
        <Gauge className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escala de classificação</DialogTitle>
            <DialogDescription>
              Defina a faixa de valores desse gráfico para classificar automaticamente em Ruim, Razoável, Bom, Ótimo ou Excelente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="escala-minimo">Valor mínimo</Label>
                <Input id="escala-minimo" type="number" step="any" value={minimo} onChange={(e) => setMinimo(e.target.value)} required autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="escala-maximo">Valor máximo</Label>
                <Input id="escala-maximo" type="number" step="any" value={maximo} onChange={(e) => setMaximo(e.target.value)} required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="escala-direcao">Direção</Label>
              <Select value={direcao} onValueChange={(value) => setDirecao(value as 'melhor' | 'pior')}>
                <SelectTrigger id="escala-direcao" className="w-full">
                  <SelectValue>
                    {(value: string | null) => (value === 'pior' ? 'Quanto maior, pior' : 'Quanto maior, melhor')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="melhor">Quanto maior, melhor</SelectItem>
                  <SelectItem value="pior">Quanto maior, pior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className={escala ? 'sm:justify-between' : undefined}>
              {escala && (
                <Button type="button" variant="outline" onClick={handleRemove} disabled={isPending}>
                  Remover escala
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar escala'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
  const [data, setData] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createIndicador(projetoId, titulo, Number(valor), '', data || todayLocalISODate())
        setValor('')
        setData('')
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
      <Input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        max={todayLocalISODate()}
        aria-label={`Data para ${titulo} (opcional, padrão hoje)`}
        className="h-8 w-[9.5rem]"
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
  const [data, setData] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createIndicador(projetoId, nome, Number(valor), '', data || todayLocalISODate())
        setNome('')
        setValor('')
        setData('')
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="novo-grafico-data">Data (opcional — se vazio, usa hoje)</Label>
              <Input
                id="novo-grafico-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                max={todayLocalISODate()}
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

function DeleteGraficoButton({ projetoId, titulo }: { projetoId: number; titulo: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteIndicadorGrupo(projetoId, titulo)
        setOpen(false)
        toast.success('Gráfico excluído.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o gráfico.')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Excluir gráfico">
        <Trash2 className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir gráfico?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir &ldquo;{titulo}&rdquo; e todos os números lançados nele. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const VALORES_POR_PAGINA = 5

function DeleteIndicadorButton({ indicador }: { indicador: Indicador }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteIndicador(indicador.id)
        setOpen(false)
        toast.success('Número removido.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível remover o número.')
      }
    })
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Excluir número">
        <Trash2 className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este número?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir o valor &ldquo;{formatValor(indicador.valor, indicador.unidade)}&rdquo; de{' '}
              {formatDataLonga(indicador.data_referencia)} do gráfico &ldquo;{indicador.titulo}&rdquo;. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function IndicadoresTable({ indicadores, editable }: { indicadores: Indicador[]; editable: boolean }) {
  const [pagina, setPagina] = useState(1)

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
                    <DeleteIndicadorButton indicador={indicador} />
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

export function EditarProjetoButton({ projeto }: { projeto: Projeto }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState(projeto.nome)
  const [descricao, setDescricao] = useState(projeto.descricao ?? '')
  const [responsavelNome, setResponsavelNome] = useState(projeto.responsavel_nome ?? '')
  const [responsavelTelefone, setResponsavelTelefone] = useState(projeto.responsavel_telefone ?? '')
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setNome(projeto.nome)
      setDescricao(projeto.descricao ?? '')
      setResponsavelNome(projeto.responsavel_nome ?? '')
      setResponsavelTelefone(projeto.responsavel_telefone ?? '')
    }
    setOpen(nextOpen)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await updateProjeto(projeto.id, nome, descricao, responsavelNome, responsavelTelefone)
        setOpen(false)
        toast.success('Projeto atualizado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o projeto.')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleOpenChange(true)} aria-label="Editar projeto">
        <Pencil className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar projeto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editar-projeto-nome">Nome do projeto</Label>
              <Input id="editar-projeto-nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editar-projeto-descricao">Briefing do projeto</Label>
              <Textarea
                id="editar-projeto-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Breve descrição do que é o projeto (opcional)"
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="editar-projeto-responsavel-nome">Nome completo do responsável</Label>
                <Input
                  id="editar-projeto-responsavel-nome"
                  value={responsavelNome}
                  onChange={(e) => setResponsavelNome(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="editar-projeto-responsavel-telefone">Telefone de contato</Label>
                <Input
                  id="editar-projeto-responsavel-telefone"
                  type="tel"
                  inputMode="numeric"
                  value={responsavelTelefone}
                  onChange={(e) => setResponsavelTelefone(formatTelefone(e.target.value))}
                  placeholder="(22) 90000-0000"
                  maxLength={15}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={isPending} className="mt-1">
              {isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PrazoAtualizacaoButton({ projetoId, prazoAtual }: { projetoId: number; prazoAtual: number | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [prazo, setPrazo] = useState(prazoAtual !== null ? String(prazoAtual) : '30')
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setPrazo(prazoAtual !== null ? String(prazoAtual) : '30')
    setOpen(nextOpen)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await setPrazoAtualizacao(projetoId, Number(prazo))
        setOpen(false)
        toast.success('Prazo de atualização configurado.')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível configurar o prazo.')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleOpenChange(true)} aria-label="Configurar prazo de atualização">
        <Clock className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prazo de atualização</DialogTitle>
            <DialogDescription>
              De quanto em quanto tempo (em dias) esse projeto precisa receber um número novo. Se passar do prazo, um alerta aparece
              para o responsável e para a prefeita.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prazo-atualizacao-dias">Prazo</Label>
              <Select value={prazo} onValueChange={(value) => setPrazo(value ?? '30')}>
                <SelectTrigger id="prazo-atualizacao-dias" className="w-full" autoFocus>
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

export function ProjetoDashboard({
  projeto,
  editable,
  canDeleteProject = editable,
}: {
  projeto: Projeto
  editable: boolean
  canDeleteProject?: boolean
}) {
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

  const escalasPorTitulo = useMemo(() => {
    const map = new Map<string, IndicadorEscala>()
    for (const escala of projeto.escalas) map.set(escala.titulo, escala)
    return map
  }, [projeto.escalas])

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
              escala={escalasPorTitulo.get(grupo.titulo)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Todos os valores</h3>
        <IndicadoresTable indicadores={projeto.indicadores} editable={editable} />
      </div>

      {canDeleteProject && (
        <div className="flex flex-col gap-3">
          <DeleteProjetoButton projeto={projeto} />
        </div>
      )}
    </div>
  )
}
