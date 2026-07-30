"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectOption = { label: string; value: string };

type SelectProps = {
  className?: string;
  defaultValue?: string;
  error?: string | undefined;
  label: string;
  name: string;
  // Uncontrolled by default (defaultValue + internal state, like a native
  // <select>). Pass value+onValueChange together to also mirror the current
  // selection into a parent (e.g. driving a live preview panel) - value
  // still flows one-way in from the parent, this component keeps owning the
  // hidden input/open state either way.
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  required?: boolean;
  value?: string;
};

type Position = { left: number; top: number; width: number };

const MENU_GAP = 8;
const VIEWPORT_MARGIN = 8;

function optionElements(root: HTMLElement | null) {
  return Array.from(root?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
}

/**
 * Custom accessible single-select listbox, built to fix a real legibility
 * bug: this app is dark-only, but a native <select>'s open <option> list is
 * rendered by the OS/browser's own UI, which defaults to a LIGHT popup
 * background - combined with this app's white text color (inherited into
 * <option> in Chromium), every option rendered white-on-white, effectively
 * invisible. `color-scheme: dark` (globals.css) helps other native controls,
 * but per-option control (selected state, hover, focus ring matching the
 * design system) isn't reliably achievable across browsers by styling a
 * native <option> at all - so this never uses <option> in the first place.
 *
 * Same architecture as DropdownMenu (portal + fixed position computed from
 * the trigger's own rect, flip/clamp against the viewport, reposition on
 * scroll/resize) - a real <select> replacement, not a decorated native one:
 * role="listbox"/"option", aria-expanded/aria-controls/aria-selected, full
 * keyboard support, ESC/outside-click to close, focus returns to trigger. A
 * hidden input carries the actual value so this still works inside a plain
 * <form action={...}> server action with zero extra client wiring.
 */
export function Select({
  className,
  defaultValue = "",
  error,
  label,
  name,
  onValueChange,
  options,
  placeholder = "Selecione uma opção",
  required = false,
  value: controlledValue,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [position, setPosition] = useState<Position | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const listboxId = useId();
  const labelId = useId();
  const errorId = useId();
  const triggerId = useId();

  const value = controlledValue ?? internalValue;
  const selectedOption = options.find((option) => option.value === value) ?? null;

  function close() {
    setOpen(false);
  }

  function selectValue(nextValue: string) {
    setInternalValue(nextValue);
    onValueChange?.(nextValue);
    close();
  }

  function updatePosition() {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const listHeight = listRef.current?.offsetHeight ?? 0;
    let top = rect.bottom + MENU_GAP;

    if (top + listHeight > window.innerHeight - VIEWPORT_MARGIN) {
      const above = rect.top - MENU_GAP - listHeight;

      if (above >= VIEWPORT_MARGIN) {
        top = above;
      }
    }

    setPosition({ left: rect.left, top, width: rect.width });
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();
  }, [open]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const insideTrigger = Boolean(rootRef.current?.contains(target));
      const insideList = Boolean(listRef.current?.contains(target));

      if (!insideTrigger && !insideList) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    document.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      document.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const items = optionElements(listRef.current);
    const selected = items.find((item) => item.dataset.value === value);
    (selected ?? items[0])?.focus();
  }, [open, value]);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = optionElements(listRef.current);

    if (items.length === 0) {
      return;
    }

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const activeValue = active?.dataset.value;

      if (activeValue !== undefined) {
        selectValue(activeValue);
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <span className="block text-sm font-semibold text-foreground" id={labelId}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
      </span>

      <div className="relative" ref={rootRef}>
        <input name={name} required={required} type="hidden" value={value} />
        <button
          aria-controls={listboxId}
          aria-describedby={error ? errorId : undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          className={cn(
            "flex min-h-12 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border bg-white/[0.055] px-4 text-left text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none transition-colors focus-visible:border-action/70 focus-visible:shadow-[0_0_0_4px_rgba(255,106,0,0.12)]",
            error ? "border-danger/60" : "border-white/[0.08] hover:border-white/14",
          )}
          id={triggerId}
          onClick={() => setOpen((next) => !next)}
          onKeyDown={handleTriggerKeyDown}
          ref={triggerRef}
          type="button"
        >
          <span className={cn("truncate", !selectedOption && "text-muted-2")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown aria-hidden="true" className="shrink-0 text-muted-2" size={16} />
        </button>
      </div>

      {error ? (
        <span className="block text-xs leading-5 text-danger" id={errorId}>
          {error}
        </span>
      ) : null}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-labelledby={labelId}
              className="fixed z-50 max-h-72 overflow-y-auto rounded-[var(--radius-card)] border border-white/[0.10] bg-matte/98 p-1.5 shadow-[var(--shadow-lift)] outline-none"
              id={listboxId}
              onKeyDown={handleListKeyDown}
              ref={listRef}
              role="listbox"
              style={{
                left: position?.left ?? -9999,
                top: position?.top ?? -9999,
                visibility: position ? "visible" : "hidden",
                width: position?.width,
              }}
              tabIndex={-1}
            >
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <div
                    aria-selected={isSelected}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium outline-none transition-colors",
                      isSelected
                        ? "bg-action/14 text-action-soft"
                        : "text-foreground hover:bg-white/[0.07] focus:bg-white/[0.07]",
                    )}
                    data-value={option.value}
                    key={option.value}
                    onClick={() => selectValue(option.value)}
                    role="option"
                    tabIndex={-1}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? (
                      <Check aria-hidden="true" className="shrink-0 text-action-soft" size={14} />
                    ) : null}
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
