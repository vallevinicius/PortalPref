'use client'

import { Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { Projeto } from '@/lib/data'

export function ProjetoCardGrid({ projetos }: { projetos: Projeto[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projetos
    return projetos.filter((p) => p.nome.toLowerCase().includes(q))
  }, [projetos, query])

  if (projetos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado ainda.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por nome..."
          className="h-10 pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum projeto encontrado para &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((projeto) => (
            <Link
              key={projeto.id}
              href={`/admin/projetos/${projeto.id}`}
              className="flex flex-col gap-1.5 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="font-medium text-foreground">{projeto.nome}</span>
              {projeto.descricao && <span className="text-sm text-muted-foreground">{projeto.descricao}</span>}
              <span className="mt-1 text-xs text-muted-foreground">
                {projeto.indicadores.length === 0
                  ? 'Nenhum número lançado ainda'
                  : `${projeto.indicadores.length} valor${projeto.indicadores.length === 1 ? '' : 'es'} registrado${projeto.indicadores.length === 1 ? '' : 's'}`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
