"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type Credential = { username: string; password: string };

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
