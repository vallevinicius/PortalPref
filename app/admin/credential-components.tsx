"use client";

import { Check, Copy, Eye, KeyRound, UserCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignProjetoUser,
  createProjetoUser,
  createSecretariaUser,
  getProjetoUserPassword,
  getSecretariaUserPassword,
  resetProjetoUserPassword,
  resetSecretariaUserPassword,
  unassignProjetoUser,
} from "@/lib/actions/users";
import type { AssignableProjetoUser, ProjetoAdmin, SecretariaAdmin } from "@/lib/data";

export type Credential = { username: string; password: string };

export function ConfirmPasswordDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
  pending: boolean;
}) {
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onConfirm(password);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPassword("");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirme sua senha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-own-password">
              Digite sua senha para ver esta senha
            </Label>
            <Input
              id="confirm-own-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          <Button type="submit" disabled={pending || !password}>
            {pending ? "Verificando..." : "Confirmar e ver senha"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GeneratedPasswordBanner({
  credential,
  onDismiss,
}: {
  credential: Credential;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(credential.password);
    setCopied(true);
    toast.success("Senha copiada para a área de transferência.");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-4">
      <p className="text-sm font-medium text-foreground">
        Senha de acesso de{" "}
        <span className="font-mono">{credential.username}</span>:
      </p>
      <div className="flex items-center gap-2">
        <code className="rounded-md bg-background px-3 py-1.5 font-mono text-sm ring-1 ring-border">
          {credential.password}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

export function NovoUsuarioForm({
  secretariaId,
  onCreated,
}: {
  secretariaId: number;
  onCreated: (credential: Credential) => void;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const credential = await createSecretariaUser(username, secretariaId);
        setUsername("");
        onCreated(credential);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível criar o usuário.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Input
          id="novo-usuario-nome"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ex.: saude.admin"
          required
        />
      </div>
      <Button type="submit" disabled={isPending} className="gap-1.5">
        <KeyRound className="size-3.5" />
        {isPending ? "Criando..." : "Criar usuário + gerar senha"}
      </Button>
    </form>
  );
}

export function SecretariaUserPanel({
  secretariaId,
  admin,
}: {
  secretariaId: number;
  admin: SecretariaAdmin | null;
}) {
  const router = useRouter();
  const [resetPending, setResetPending] = useState(false);
  const [viewPending, setViewPending] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmViewOpen, setConfirmViewOpen] = useState(false);
  const [revealedCredential, setRevealedCredential] =
    useState<Credential | null>(null);

  function handleReset() {
    if (!admin) return;
    setResetPending(true);
    resetSecretariaUserPassword(admin.id)
      .then((result) => {
        setRevealedCredential({
          username: admin.username,
          password: result.password,
        });
        toast.success("Nova senha gerada.");
        router.refresh();
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível gerar a nova senha.",
        );
      })
      .finally(() => setResetPending(false));
  }

  function handleViewPassword(confirmPassword: string) {
    if (!admin) return;
    setViewPending(true);
    getSecretariaUserPassword(admin.id, confirmPassword)
      .then((result) => {
        setRevealedCredential({
          username: admin.username,
          password: result.password,
        });
        setConfirmViewOpen(false);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível mostrar a senha.",
        );
      })
      .finally(() => setViewPending(false));
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Usuário de acesso</h3>

      {revealedCredential && (
        <GeneratedPasswordBanner
          credential={revealedCredential}
          onDismiss={() => setRevealedCredential(null)}
        />
      )}

      {admin ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <span className="font-mono text-sm">{admin.username}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmViewOpen(true)}
              disabled={viewPending}
              className="gap-1.5"
            >
              <Eye className="size-3.5" />
              {viewPending ? "Carregando..." : "Ver senha atual"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmResetOpen(true)}
              disabled={resetPending}
              className="gap-1.5"
            >
              <KeyRound className="size-3.5" />
              {resetPending ? "Gerando..." : "Gerar nova senha"}
            </Button>
          </div>
        </div>
      ) : (
        <NovoUsuarioForm
          secretariaId={secretariaId}
          onCreated={setRevealedCredential}
        />
      )}

      <ConfirmPasswordDialog
        open={confirmViewOpen}
        onOpenChange={setConfirmViewOpen}
        onConfirm={handleViewPassword}
        pending={viewPending}
      />

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova senha?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha atual de &ldquo;{admin?.username}&rdquo; deixará de
              funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Gerar nova senha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function NovoProjetoUsuarioForm({
  projetoId,
  onCreated,
}: {
  projetoId: number;
  onCreated: (credential: Credential) => void;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const credential = await createProjetoUser(username, projetoId);
        setUsername("");
        onCreated(credential);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível criar o usuário.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Input
          id={`novo-projeto-usuario-nome-${projetoId}`}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ex.: joao.responsavel"
          required
        />
      </div>
      <Button type="submit" disabled={isPending} className="gap-1.5">
        <KeyRound className="size-3.5" />
        {isPending ? "Criando..." : "Criar usuário + gerar senha"}
      </Button>
    </form>
  );
}

export function DesignarProjetoUsuarioForm({
  projetoId,
  usuarios,
  onAssigned,
}: {
  projetoId: number;
  usuarios: AssignableProjetoUser[];
  onAssigned: (username: string) => void;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    startTransition(async () => {
      try {
        const result = await assignProjetoUser(Number(userId), projetoId);
        setUserId("");
        onAssigned(result.username);
        toast.success("Usuário designado para o projeto.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível designar o usuário.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Select value={userId} onValueChange={(value) => setUserId(value ?? "")}>
          <SelectTrigger id={`designar-projeto-usuario-${projetoId}`} className="w-full">
            <SelectValue placeholder="Selecione um usuário já criado">
              {(value: string | null) => {
                const usuario = usuarios.find((u) => String(u.id) === value);
                return usuario?.username ?? "Selecione um usuário já criado";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {usuarios.map((usuario) => (
              <SelectItem key={usuario.id} value={String(usuario.id)}>
                {usuario.username}
                {usuario.projetos_atuais.length > 0 ? ` (em: ${usuario.projetos_atuais.join(", ")})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isPending || !userId} className="gap-1.5">
        <UserCheck className="size-3.5" />
        {isPending ? "Designando..." : "Designar usuário"}
      </Button>
    </form>
  );
}

export function ProjetoUserPanel({
  projetoId,
  admin,
  assignableUsers,
}: {
  projetoId: number;
  admin: ProjetoAdmin | null;
  assignableUsers: AssignableProjetoUser[];
}) {
  const router = useRouter();
  const [resetPending, setResetPending] = useState(false);
  const [viewPending, setViewPending] = useState(false);
  const [unassignPending, setUnassignPending] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmViewOpen, setConfirmViewOpen] = useState(false);
  const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
  const [revealedCredential, setRevealedCredential] =
    useState<Credential | null>(null);
  const [mode, setMode] = useState<"criar" | "designar">("criar");

  function handleReset() {
    if (!admin) return;
    setResetPending(true);
    resetProjetoUserPassword(admin.id, projetoId)
      .then((result) => {
        setRevealedCredential({
          username: admin.username,
          password: result.password,
        });
        toast.success("Nova senha gerada.");
        router.refresh();
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível gerar a nova senha.",
        );
      })
      .finally(() => setResetPending(false));
  }

  function handleViewPassword(confirmPassword: string) {
    if (!admin) return;
    setViewPending(true);
    getProjetoUserPassword(admin.id, projetoId, confirmPassword)
      .then((result) => {
        setRevealedCredential({
          username: admin.username,
          password: result.password,
        });
        setConfirmViewOpen(false);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível mostrar a senha.",
        );
      })
      .finally(() => setViewPending(false));
  }

  function handleUnassign() {
    if (!admin) return;
    setUnassignPending(true);
    unassignProjetoUser(admin.id, projetoId)
      .then(() => {
        toast.success("Usuário removido deste projeto.");
        router.refresh();
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível remover o usuário deste projeto.",
        );
      })
      .finally(() => setUnassignPending(false));
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Usuário responsável do projeto</h3>

      {revealedCredential && (
        <GeneratedPasswordBanner
          credential={revealedCredential}
          onDismiss={() => setRevealedCredential(null)}
        />
      )}

      {admin ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <span className="font-mono text-sm">{admin.username}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmViewOpen(true)}
              disabled={viewPending}
              className="gap-1.5"
            >
              <Eye className="size-3.5" />
              {viewPending ? "Carregando..." : "Ver senha atual"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmResetOpen(true)}
              disabled={resetPending}
              className="gap-1.5"
            >
              <KeyRound className="size-3.5" />
              {resetPending ? "Gerando..." : "Gerar nova senha"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmUnassignOpen(true)}
              disabled={unassignPending}
              className="gap-1.5"
            >
              <UserMinus className="size-3.5" />
              {unassignPending ? "Removendo..." : "Remover deste projeto"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="inline-flex w-fit rounded-lg border border-border p-0.5">
            <Button
              type="button"
              variant={mode === "criar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("criar")}
            >
              Criar novo usuário
            </Button>
            <Button
              type="button"
              variant={mode === "designar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("designar")}
            >
              Usar usuário existente
            </Button>
          </div>

          {mode === "criar" ? (
            <NovoProjetoUsuarioForm
              projetoId={projetoId}
              onCreated={setRevealedCredential}
            />
          ) : assignableUsers.length > 0 ? (
            <DesignarProjetoUsuarioForm
              projetoId={projetoId}
              usuarios={assignableUsers}
              onAssigned={() => {}}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum usuário responsável de projeto disponível para designar.
            </p>
          )}
        </div>
      )}

      <ConfirmPasswordDialog
        open={confirmViewOpen}
        onOpenChange={setConfirmViewOpen}
        onConfirm={handleViewPassword}
        pending={viewPending}
      />

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova senha?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha atual de &ldquo;{admin?.username}&rdquo; deixará de
              funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Gerar nova senha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUnassignOpen} onOpenChange={setConfirmUnassignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover responsável deste projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{admin?.username}&rdquo; deixará de ter acesso a este projeto. Se ele for
              responsável por outros projetos, o acesso a eles não é afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnassign}>
              Remover deste projeto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
