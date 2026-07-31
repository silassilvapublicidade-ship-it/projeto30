"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, Ref } from "react";
import { createPortal } from "react-dom";
import { Download, Minus, Plus, RotateCcw, X, ZoomIn } from "lucide-react";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const WHEEL_STEP = 0.4;
const BUTTON_STEP = 1;
const DOUBLE_TAP_WINDOW_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 24;

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type DownloadState = "idle" | "loading" | "success" | "error";

type TipImageViewerProps = {
  alt: string;
  downloadUrl: string;
  imageUrl: string;
  title: string;
};

/**
 * Self-contained fullscreen viewer for a tip's artwork: owns its own
 * open/close state, renders the clickable inline preview *and* the Portal'd
 * lightbox, so a page only has to drop in one component instead of wiring
 * trigger + overlay + gesture state itself.
 */
export function TipImageViewer({ alt, downloadUrl, imageUrl, title }: TipImageViewerProps) {
  const [open, setOpen] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<"loading" | "loaded" | "error">("loading");
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <figure className="space-y-2">
        <button
          aria-label={`Ampliar imagem: ${title}`}
          className="group relative mx-auto block w-full overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-black focus-visible:outline-action-soft"
          onClick={() => setOpen(true)}
          ref={triggerRef}
          type="button"
        >
          {previewStatus === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/[0.03]">
              <span
                aria-hidden="true"
                className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
              />
            </div>
          ) : null}
          {previewStatus === "error" ? (
            <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-2">
              Não foi possível carregar a imagem.
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- intentionally bypassing next/image so the hero renders at its true stored resolution/aspect ratio (see optimizeTipImage) instead of a container-forced crop.
            <img
              alt={alt}
              className="mx-auto max-h-[70vh] w-auto max-w-full object-contain transition-transform duration-[var(--motion-base)] group-hover:scale-[1.01]"
              onError={() => setPreviewStatus("error")}
              onLoad={() => setPreviewStatus("loaded")}
              src={imageUrl}
            />
          )}
          <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-black/60 px-3 py-1.5 text-xs font-semibold text-foreground opacity-0 backdrop-blur transition-opacity duration-[var(--motion-base)] group-hover:opacity-100">
            <ZoomIn aria-hidden="true" size={14} />
            Ampliar
          </span>
        </button>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-2">
          <span>Clique na imagem para ampliar</span>
          <span className="flex gap-3">
            <button
              className="font-semibold text-muted underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setOpen(true)}
              type="button"
            >
              Ver em tela cheia
            </button>
            <a
              className="font-semibold text-muted underline-offset-2 hover:text-foreground hover:underline"
              download
              href={downloadUrl}
            >
              Baixar imagem
            </a>
          </span>
        </figcaption>
      </figure>

      {open ? (
        <Lightbox
          alt={alt}
          downloadUrl={downloadUrl}
          imageUrl={imageUrl}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
          title={title}
        />
      ) : null}
    </>
  );
}

function Lightbox({
  alt,
  downloadUrl,
  imageUrl,
  onClose,
  title,
}: {
  alt: string;
  downloadUrl: string;
  imageUrl: string;
  onClose: () => void;
  title: string;
}) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");

  const scaleRef = useRef(scale);
  const posRef = useRef(pos);
  useLayoutEffect(() => {
    scaleRef.current = scale;
    posRef.current = pos;
  }, [scale, pos]);

  const pointers = useRef(new Map<number, Point>());
  const dragOrigin = useRef<{ pointerId: number; startPos: Point; startX: number; startY: number } | null>(null);
  const pinchOrigin = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  const getBoundsForScale = useCallback((nextScale: number) => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage || nextScale <= 1) {
      return { maxX: 0, maxY: 0 };
    }
    const rect = img.getBoundingClientRect();
    const baseWidth = rect.width / scaleRef.current;
    const baseHeight = rect.height / scaleRef.current;
    const stageRect = stage.getBoundingClientRect();
    return {
      maxX: Math.max(0, (baseWidth * nextScale - stageRect.width) / 2),
      maxY: Math.max(0, (baseHeight * nextScale - stageRect.height) / 2),
    };
  }, []);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const stage = stageRef.current;
      const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      if (!stage) {
        setScale(clamped);
        return;
      }
      const rect = stage.getBoundingClientRect();
      const originX = clientX - rect.left - rect.width / 2;
      const originY = clientY - rect.top - rect.height / 2;
      const factor = clamped / scaleRef.current;
      const { maxX, maxY } = getBoundsForScale(clamped);
      const nextX = clamp(originX - (originX - posRef.current.x) * factor, -maxX, maxX);
      const nextY = clamp(originY - (originY - posRef.current.y) * factor, -maxY, maxY);
      setScale(clamped);
      setPos(clamped === MIN_SCALE ? { x: 0, y: 0 } : { x: nextX, y: nextY });
    },
    [getBoundsForScale],
  );

  const zoomCentered = useCallback(
    (nextScale: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, nextScale);
    },
    [zoomAt],
  );

  const zoomIn = useCallback(() => zoomCentered(scaleRef.current + BUTTON_STEP), [zoomCentered]);
  const zoomOut = useCallback(() => zoomCentered(scaleRef.current - BUTTON_STEP), [zoomCentered]);
  const reset = useCallback(() => {
    setScale(MIN_SCALE);
    setPos({ x: 0, y: 0 });
  }, []);

  const toggleZoomAt = useCallback(
    (clientX: number, clientY: number) => {
      zoomAt(clientX, clientY, scaleRef.current > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE);
    },
    [zoomAt],
  );

  // --- focus trap + restore, ESC, body scroll lock ---
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const container = overlayRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose identity intentionally excluded: this effect must only run once per mount to set up the trap/lock/restore lifecycle, not re-run whenever the caller's onClose reference changes.
  }, []);

  // --- wheel zoom ---
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      zoomAt(event.clientX, event.clientY, scaleRef.current + delta);
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // --- pointer handlers: pan + pinch + double-tap ---
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchOrigin.current = {
        distance: Math.hypot(b!.x - a!.x, b!.y - a!.y),
        scale: scaleRef.current,
      };
      dragOrigin.current = null;
      return;
    }

    if (pointers.current.size === 1) {
      const now = Date.now();
      const tap = lastTap.current;
      if (
        tap &&
        now - tap.time < DOUBLE_TAP_WINDOW_MS &&
        Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < DOUBLE_TAP_DISTANCE_PX
      ) {
        toggleZoomAt(event.clientX, event.clientY);
        lastTap.current = null;
        return;
      }
      lastTap.current = { time: now, x: event.clientX, y: event.clientY };

      if (scaleRef.current > MIN_SCALE) {
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        dragOrigin.current = {
          pointerId: event.pointerId,
          startPos: posRef.current,
          startX: event.clientX,
          startY: event.clientY,
        };
        setIsDragging(true);
      }
    }
  }, [toggleZoomAt]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.current.size === 2 && pinchOrigin.current) {
        const [a, b] = Array.from(pointers.current.values());
        const distance = Math.hypot(b!.x - a!.x, b!.y - a!.y);
        const nextScale = clamp(
          pinchOrigin.current.scale * (distance / pinchOrigin.current.distance),
          MIN_SCALE,
          MAX_SCALE,
        );
        const midX = (a!.x + b!.x) / 2;
        const midY = (a!.y + b!.y) / 2;
        zoomAt(midX, midY, nextScale);
        return;
      }

      const drag = dragOrigin.current;
      if (drag && drag.pointerId === event.pointerId) {
        const { maxX, maxY } = getBoundsForScale(scaleRef.current);
        setPos({
          x: clamp(drag.startPos.x + (event.clientX - drag.startX), -maxX, maxX),
          y: clamp(drag.startPos.y + (event.clientY - drag.startY), -maxY, maxY),
        });
      }
    },
    [getBoundsForScale, zoomAt],
  );

  const endPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchOrigin.current = null;
    }
    if (dragOrigin.current?.pointerId === event.pointerId) {
      dragOrigin.current = null;
      setIsDragging(false);
    }
  }, []);

  async function handleDownload() {
    setDownloadState("loading");
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filenameMatch?.[1] ?? "dica.webp";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setDownloadState("success");
    } catch {
      setDownloadState("error");
    }
  }

  const zoomPercent = Math.round(scale * 100);

  return createPortal(
    <div
      aria-label={`Imagem em tela cheia: ${title}`}
      aria-modal="true"
      className="fixed inset-0 z-[200] flex touch-none flex-col bg-black/95"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
      ref={overlayRef}
      role="dialog"
    >
      <h2 className="sr-only" id={titleId}>
        {title}
      </h2>

      <div className="flex items-center justify-end gap-2 p-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <LightboxButton disabled={scale <= MIN_SCALE} label="Reduzir zoom" onClick={zoomOut}>
          <Minus aria-hidden="true" size={18} />
        </LightboxButton>
        <span className="min-w-12 select-none text-center font-mono text-xs text-muted-2" data-testid="zoom-level">
          {zoomPercent}%
        </span>
        <LightboxButton disabled={scale >= MAX_SCALE} label="Ampliar zoom" onClick={zoomIn}>
          <Plus aria-hidden="true" size={18} />
        </LightboxButton>
        <LightboxButton disabled={scale === MIN_SCALE && pos.x === 0 && pos.y === 0} label="Restaurar zoom" onClick={reset}>
          <RotateCcw aria-hidden="true" size={16} />
        </LightboxButton>
        <LightboxButton
          label={
            downloadState === "loading"
              ? "Baixando imagem..."
              : downloadState === "error"
                ? "Erro ao baixar, tentar novamente"
                : "Baixar imagem"
          }
          loading={downloadState === "loading"}
          onClick={handleDownload}
        >
          <Download aria-hidden="true" size={18} />
        </LightboxButton>
        <LightboxButton autoFocus label="Fechar" onClick={onClose} ref={closeButtonRef}>
          <X aria-hidden="true" size={20} />
        </LightboxButton>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onPointerCancel={endPointer}
        onPointerDown={handlePointerDown}
        onPointerLeave={endPointer}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        ref={stageRef}
      >
        {imgStatus === "loading" ? (
          <span
            aria-hidden="true"
            className="absolute size-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
          />
        ) : null}
        {imgStatus === "error" ? (
          <div className="flex flex-col items-center gap-3 text-sm text-muted-2">
            Não foi possível carregar a imagem.
            <button
              className="rounded-full border border-white/[0.12] px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-white/[0.06]"
              onClick={() => {
                setImgStatus("loading");
                setRetryCount((count) => count + 1);
              }}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- lightbox must load the exact stored bytes at full resolution, bypassing next/image's automatic re-encoding/width buckets.
          <img
            alt={alt}
            className="max-h-full max-w-full touch-none select-none object-contain"
            draggable={false}
            key={retryCount}
            onError={() => setImgStatus("error")}
            onLoad={() => setImgStatus("loaded")}
            ref={imgRef}
            src={retryCount > 0 ? `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}retry=${retryCount}` : imageUrl}
            style={{
              cursor: scale > MIN_SCALE ? (isDragging ? "grabbing" : "grab") : "zoom-in",
              transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})`,
              transition: isDragging ? "none" : "transform var(--motion-base) var(--ease-premium)",
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function LightboxButton({
  autoFocus,
  children,
  disabled,
  label,
  loading,
  onClick,
  ref,
}: {
  autoFocus?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      aria-label={label}
      autoFocus={autoFocus}
      className="flex size-10 items-center justify-center rounded-full border border-white/[0.12] bg-black/60 text-foreground backdrop-blur transition-colors duration-[var(--motion-base)] hover:bg-white/[0.12] focus-visible:outline-action-soft disabled:pointer-events-none disabled:opacity-40"
      disabled={disabled || loading}
      onClick={onClick}
      ref={ref}
      title={label}
      type="button"
    >
      {loading ? (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white/80" />
      ) : (
        children
      )}
    </button>
  );
}
