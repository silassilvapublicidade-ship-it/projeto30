"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type DropdownMenuRenderProps = {
  close: () => void;
};

type DropdownMenuProps = {
  align?: "end" | "start";
  children: (context: DropdownMenuRenderProps) => ReactNode;
  className?: string;
  label: string;
  triggerClassName?: string;
};

function focusableMenuItems(root: HTMLElement | null) {
  return Array.from(
    root?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
  );
}

/**
 * Native, dependency-free dropdown/menu primitive (same philosophy as
 * ConfirmDialog: a real implementation of the ARIA menu pattern - roving
 * focus, arrow-key navigation, outside-click and ESC to close, focus
 * returned to the trigger - without pulling in a Radix-style library the
 * project doesn't otherwise have).
 */
export function DropdownMenu({
  align = "end",
  children,
  className,
  label,
  triggerClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const menuId = useId();

  // A plain setter, never a ref access - safe to hand to children() during
  // render. Refocusing the trigger on close happens below, as a genuine
  // side effect keyed on the open -> closed transition, not synchronously
  // inside a closure passed through the render-prop.
  function close() {
    setOpen(false);
  }

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
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    focusableMenuItems(rootRef.current)[0]?.focus();
  }, [open]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = focusableMenuItems(rootRef.current);

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
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative inline-block text-left", className)} ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-[var(--radius-pill)] border border-white/[0.08] bg-white/[0.03] text-lg leading-none text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-action-soft",
          triggerClassName,
        )}
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open ? (
        <div
          className={cn(
            "absolute z-20 mt-2 min-w-[208px] rounded-[var(--radius-card)] border border-white/[0.10] bg-matte/98 p-1.5 shadow-[var(--shadow-lift)] outline-none",
            align === "end" ? "right-0" : "left-0",
          )}
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          role="menu"
        >
          {children({ close })}
        </div>
      ) : null}
    </div>
  );
}

type DropdownMenuItemProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string;
  // Receives the click event so a type="submit" item (posting to a form)
  // can still call event.preventDefault() conditionally - e.g. a
  // window.confirm() guard before letting a destructive form submit.
  onSelect?: (event: MouseEvent<HTMLButtonElement>) => void;
  tone?: "critical" | "danger" | "default";
  type?: "button" | "submit";
};

/**
 * A single menu entry. Renders as a link (href), a form-submit button (type
 * "submit", for the status-transition server actions each row already
 * posts to), or a plain action button (onSelect, e.g. opening the delete
 * modal) - all exposed uniformly as role="menuitem" so arrow-key navigation
 * in the parent DropdownMenu treats them the same way.
 */
export function DropdownMenuItem({
  children,
  className,
  disabled = false,
  href,
  onSelect,
  tone = "default",
  type = "button",
}: DropdownMenuItemProps) {
  const classes = cn(
    "flex w-full items-center rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-medium outline-none transition-colors",
    tone === "danger" && "text-danger hover:bg-danger/12 focus:bg-danger/12",
    tone === "critical" &&
      "text-danger font-semibold hover:bg-danger/18 focus:bg-danger/18 border border-danger/25",
    tone === "default" && "text-foreground hover:bg-white/[0.07] focus:bg-white/[0.07]",
    disabled && "pointer-events-none opacity-40",
    className,
  );

  if (href) {
    return (
      <a aria-disabled={disabled || undefined} className={classes} href={href} role="menuitem" tabIndex={-1}>
        {children}
      </a>
    );
  }

  return (
    <button
      aria-disabled={disabled || undefined}
      className={classes}
      disabled={disabled}
      onClick={onSelect}
      role="menuitem"
      tabIndex={-1}
      type={type}
    >
      {children}
    </button>
  );
}

/**
 * Visual divider before destructive actions (role="separator" so screen
 * readers announce the group change, excluded from arrow-key navigation
 * since it's not a menuitem).
 */
export function DropdownMenuSeparator() {
  return <div className="my-1.5 h-px bg-white/[0.08]" role="separator" />;
}
