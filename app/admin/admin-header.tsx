import Image from 'next/image'
import { LogoutButton } from './logout-button'

export function AdminHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="relative flex flex-col items-center gap-3 pt-2 text-center">
      <div className="absolute right-0 top-0">
        <LogoutButton />
      </div>
      <div className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-4 shadow-lg shadow-primary/20">
        <Image src="/Pref.png" alt="Prefeitura Municipal de Saquarema" width={296} height={100} className="h-10 w-auto sm:h-11" priority />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Portal de Dados Integrados</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}
