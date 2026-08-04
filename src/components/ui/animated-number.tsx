"use client";

import { useEffect, useRef, useState } from "react";

import { shouldAnimateNumberChange } from "@/features/dashboard/animated-number.core";
import { cn } from "@/lib/utils";

const ANIMATION_DURATION_MS = 600;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Numero que anima em contagem quando (e so quando) o valor real muda de
 * verdade entre visitas (Refinamento premium, Parte B item 4) - primeira
 * entrada da sessao ou mudanca real de valor, nunca do zero a cada
 * navegacao. sessionStorage (por storageKey) e o unico estado usado para
 * lembrar "o que o cliente ja viu" - nada no servidor precisa saber disso.
 * O texto visivel anima, mas o valor real fica sempre disponivel para
 * leitor de tela via o span .sr-only, nunca atras da animacao.
 */
export function AnimatedNumber({
  className,
  formatter,
  storageKey,
  value,
}: {
  className?: string;
  formatter?: (value: number) => string;
  storageKey: string;
  value: number;
}) {
  const format = formatter ?? ((n: number) => n.toLocaleString("pt-BR"));
  const [displayValue, setDisplayValue] = useState(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const key = `p30:animated-number:${storageKey}`;
    const raw = window.sessionStorage.getItem(key);
    const previousValue = raw !== null && raw !== "" ? Number(raw) : null;
    window.sessionStorage.setItem(key, String(value));

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = shouldAnimateNumberChange({ previousValue, value }) && !prefersReducedMotion;

    // displayValue ja nasce igual a value (useState(value)) - so precisamos
    // agir aqui quando a transicao REALMENTE deve ser animada; sem
    // animacao, o valor renderizado no primeiro paint ja e o correto.
    if (!animate) {
      return undefined;
    }

    const start = previousValue ?? 0;
    const startTime = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / ANIMATION_DURATION_MS);
      setDisplayValue(Math.round(start + (value - start) * easeOutCubic(progress)));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [storageKey, value]);

  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden="true">{format(displayValue)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
