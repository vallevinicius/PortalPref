'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteSecretaria, updateSecretaria } from '@/lib/actions/secretarias'

export function SecretariaActions({ secretariaId, nome, projetosCount }: { secretariaId: number; nome: string; projetosCount: number }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [novoNome, setNovoNome] = useState(nome)
  const [isPending, startTransition] = useTransition()

  function handleEdit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const resultado = await updateSecretaria(secretariaId, novoNome)
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      setEditOpen(false)
      toast.success('Secretaria atualizada.')
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const resultado = await deleteSecretaria(secretariaId)
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success('Secretaria excluída.')
      router.push('/admin')
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setNovoNome(nome)
            setEditOpen(true)
          }}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-3.5" />
          Excluir
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar secretaria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editar-secretaria-nome">Nome da secretaria</Label>
              <Input id="editar-secretaria-nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required autoFocus />
            </div>
            <Button type="submit" disabled={isPending || !novoNome.trim() || novoNome.trim() === nome}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga definitivamente a secretaria, {projetosCount} projeto{projetosCount === 1 ? '' : 's'} com todos os seus gráficos e
              números, e os usuários vinculados somente a ela. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Excluindo...' : 'Excluir secretaria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
