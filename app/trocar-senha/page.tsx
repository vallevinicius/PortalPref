import { TrocarSenhaForm } from './trocar-senha-form'

export default function TrocarSenhaPage() {
  return (
    <main className="portal-shell relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-8 text-foreground sm:px-6">
      <div aria-hidden="true" className="portal-grid absolute inset-0 opacity-40" />
      <div
        aria-hidden="true"
        className="portal-orbit absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-foreground/10"
      />
      <TrocarSenhaForm />
    </main>
  )
}
