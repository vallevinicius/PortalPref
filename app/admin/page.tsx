import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession } from '@/lib/auth'
import { LogoutButton } from './logout-button'

export default async function AdminPage() {
  const session = await getSession()

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Painel do administrador</h1>
        <LogoutButton />
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Sessão ativa</CardTitle>
          <CardDescription>Você está autenticado com acesso total ao portal.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Usuário: {session?.username}</p>
          <p>Papel: {session?.role}</p>
        </CardContent>
      </Card>
    </main>
  )
}
