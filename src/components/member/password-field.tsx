"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/field";

export function PasswordField({
  autoComplete,
  error,
  hint,
  label,
  name,
}: {
  autoComplete: "current-password" | "new-password";
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
  name: string;
}) {
  const [visible, setVisible] = useState(false);
  const fieldId = useId();

  return (
    <label className="block space-y-2" htmlFor={fieldId}>
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      <span className="relative block">
        <Input
          autoComplete={autoComplete}
          className="pr-12"
          id={fieldId}
          name={name}
          required
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-action-soft"
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
        </button>
      </span>
      {error ? (
        <span className="block text-xs leading-5 text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-xs leading-5 text-muted-2">{hint}</span>
      ) : null}
    </label>
  );
}
