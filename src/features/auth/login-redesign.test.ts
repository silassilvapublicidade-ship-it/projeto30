import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripJsComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

const authDir = ["src", "app", "(auth)"];

describe("Calendar removed from auth screens (not deleted from the app)", () => {
  it("AuthShell no longer imports or renders RhythmRail", () => {
    const source = stripJsComments(readSource("src", "components", "auth", "auth-shell.tsx"));
    expect(source).not.toContain("RhythmRail");
    expect(source).not.toContain("rhythm-rail");
  });

  it("RhythmRail itself still exists and is still used by onboarding and the public landing page - it was not deleted", () => {
    const rhythmRailSource = readSource("src", "components", "brand", "rhythm-rail.tsx");
    expect(rhythmRailSource).toContain("export function RhythmRail");

    const onboarding = readSource("src", "components", "member", "onboarding-flow.tsx");
    expect(onboarding).toContain("RhythmRail");

    const publicSections = readSource("src", "components", "public", "public-sections.tsx");
    expect(publicSections).toContain("RhythmRail");
  });

  it("none of the 4 auth pages render the 30-day rail", () => {
    for (const route of ["login", "cadastro", "recuperar-senha", "nova-senha"]) {
      const source = readSource(...authDir, route, "page.tsx");
      expect(source, `${route}/page.tsx should not reference RhythmRail`).not.toContain("RhythmRail");
    }
  });
});

describe("Auth pages moved out of the marketing (public) route group", () => {
  it("all 4 auth pages live under (auth), not (public) - URLs are unchanged since route groups don't affect the path", () => {
    for (const route of ["login", "cadastro", "recuperar-senha", "nova-senha"]) {
      expect(() => readSource(...authDir, route, "page.tsx")).not.toThrow();
    }
  });

  it("the auth layout does not pull in the marketing header/footer", () => {
    const layout = stripJsComments(readSource(...authDir, "layout.tsx"));
    expect(layout).not.toContain("PublicHeader");
    expect(layout).not.toContain("PublicFooter");
  });
});

describe("Premium visual system", () => {
  const shell = stripJsComments(readSource("src", "components", "auth", "auth-shell.tsx"));
  const visualPanel = readSource("src", "components", "auth", "auth-visual-panel.tsx");
  const backdrop = readSource("src", "components", "auth", "auth-backdrop.tsx");

  it("desktop headline and motivational copy match the brief", () => {
    expect(visualPanel).toContain("30 dias podem mudar a direção da sua vida.");
    expect(visualPanel).toContain("Você não precisa mudar tudo hoje.");
    expect(visualPanel).toContain("Precisa apenas continuar.");
  });

  it("exactly 3 micro-indicators, no invented metrics", () => {
    expect(visualPanel).toContain("Constância diária");
    expect(visualPanel).toContain("Evolução visível");
    expect(visualPanel).toContain("Uma jornada de cada vez");
    expect(visualPanel).not.toMatch(/\d+%|\d+[,.]?\d*\s*(usuários|alunos|pessoas)/i);
  });

  it("the visual panel is desktop-only", () => {
    expect(shell).toContain("hidden lg:flex");
  });

  it("mobile shows a short, different headline instead of the full desktop copy", () => {
    expect(shell).toContain("Continue o que você começou.");
    expect(shell).not.toContain("30 dias podem mudar a direção da sua vida.");
  });

  it("background is pure CSS/SVG - no photography, no external image requests", () => {
    expect(backdrop).not.toContain("next/image");
    expect(backdrop).not.toMatch(/src=["']https?:\/\//);
    expect(backdrop).not.toContain(".jpg");
    expect(backdrop).not.toContain(".webp");
  });

  it("the giant '30' is graphic (very low opacity), not competing text", () => {
    expect(backdrop).toMatch(/text-white\/\[0\.0[0-9]+\]/);
  });
});

describe("Card hierarchy matches the spec order (logo, title, support text, fields, forgot password, submit, divider, magic link, footer)", () => {
  const shell = readSource("src", "components", "auth", "auth-shell.tsx");
  const forms = readSource("src", "components", "auth", "auth-forms.tsx");

  it("AuthShell renders logo, cardTitle and cardDescription before the form (children)", () => {
    const logoIndex = shell.indexOf("<BrandLogo");
    const titleIndex = shell.indexOf("{cardTitle}");
    const descriptionIndex = shell.indexOf("{cardDescription}");
    const childrenIndex = shell.indexOf("{children}");
    expect(logoIndex).toBeGreaterThan(-1);
    expect(logoIndex).toBeLessThan(titleIndex);
    expect(titleIndex).toBeLessThan(descriptionIndex);
    expect(descriptionIndex).toBeLessThan(childrenIndex);
  });

  it("LoginForm places 'Esqueci minha senha' between the password field and the submit button", () => {
    const passwordIdx = forms.indexOf('name="password"');
    const forgotIdx = forms.indexOf("Esqueci minha senha");
    const submitIdx = forms.indexOf("<SubmitButton>Entrar</SubmitButton>");
    expect(passwordIdx).toBeGreaterThan(-1);
    expect(passwordIdx).toBeLessThan(forgotIdx);
    expect(forgotIdx).toBeLessThan(submitIdx);
  });
});

describe("Password field - show/hide, Caps Lock, autocomplete", () => {
  const forms = readSource("src", "components", "auth", "auth-forms.tsx");

  it("has an accessible show/hide toggle with aria-label and aria-pressed", () => {
    expect(forms).toContain('aria-pressed={visible}');
    expect(forms).toMatch(/aria-label=\{visible \? "Ocultar senha" : "Mostrar senha"\}/);
  });

  it("toggling changes the input's type between password and text", () => {
    expect(forms).toContain('type={visible ? "text" : "password"}');
  });

  it("detects Caps Lock via the standard getModifierState API", () => {
    expect(forms).toContain('getModifierState("CapsLock")');
    expect(forms).toContain("Caps Lock está ativado.");
  });

  it("login password uses current-password, signup/new-password use new-password autocomplete", () => {
    expect(forms).toMatch(/autoComplete="current-password"/);
    expect(forms).toMatch(/autoComplete="new-password"/);
  });

  it("PasswordInput is reused across login, signup and new-password forms - not a one-off", () => {
    const occurrences = forms.match(/<PasswordInput/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Magic link - toggle instead of two forms shown at once", () => {
  const forms = readSource("src", "components", "auth", "auth-forms.tsx");

  it("LoginForm keeps password and magic-link mutually exclusive via state, not both rendered together", () => {
    expect(forms).toContain('useState<"password" | "magic">("password")');
    expect(forms).toMatch(/mode === "password" \? \(/);
  });

  it("has the exact short explanation copy", () => {
    expect(forms).toContain("Enviaremos um link seguro para o seu e-mail.");
  });

  it("the toggle button label flips depending on the current mode, and lets the user go back", () => {
    expect(forms).toContain('"Entrar com link por e-mail"');
    expect(forms).toContain('"Entrar com senha"');
  });

  it("still posts to the real sendMagicLinkFormAction / signInWithPasswordFormAction Server Actions - no client-only stub", () => {
    expect(forms).toContain("sendMagicLinkFormAction");
    expect(forms).toContain("signInWithPasswordFormAction");
  });
});

describe("All 4 auth actions remain wired to their real Server Actions", () => {
  const forms = readSource("src", "components", "auth", "auth-forms.tsx");

  it("password recovery and update-password forms use the unchanged auth.actions.ts functions", () => {
    expect(forms).toContain("sendPasswordRecoveryFormAction");
    expect(forms).toContain("updatePasswordAction");
    expect(forms).toContain("signUpWithPasswordFormAction");
  });

  it("auth.actions.ts itself was not touched by the redesign (security-sensitive, out of scope)", () => {
    const actions = readSource("src", "features", "auth", "auth.actions.ts");
    expect(actions).toContain("export async function signInWithPasswordFormAction");
    expect(actions).toContain("export async function sendMagicLinkFormAction");
    expect(actions).toContain("export async function sendPasswordRecoveryFormAction");
    expect(actions).toContain("export async function updatePasswordAction");
  });
});

describe("Redirect safety preserved", () => {
  it("getSafeNextPath is untouched and still blocks open redirects / login-to-login loops", () => {
    const source = readSource("src", "lib", "auth", "redirects.ts");
    expect(source).toContain('if (!nextPath.startsWith("/") || nextPath.startsWith("//"))');
    expect(source).toContain('nextPath.startsWith("/login")');
  });

  it("login and cadastro still redirect an already-authenticated user instead of showing the form", () => {
    for (const route of ["login", "cadastro"]) {
      const source = readSource(...authDir, route, "page.tsx");
      expect(source).toContain("getOptionalAuthUser");
      expect(source).toContain("redirect(nextPath)");
    }
  });

  it("nova-senha still requires a session and redirects to login with reason=session otherwise", () => {
    const source = readSource(...authDir, "nova-senha", "page.tsx");
    expect(source).toContain('redirect("/login?reason=session")');
  });
});

describe("Loading and error states", () => {
  const forms = readSource("src", "components", "auth", "auth-forms.tsx");

  it("submit buttons show a pending state via useFormStatus, not a fake instant success", () => {
    expect(forms).toContain("useFormStatus();");
    expect(forms).toContain("loading={pending}");
  });

  it("FormStatus surfaces error/success via the accessible StatusCard (role=alert/status)", () => {
    expect(forms).toContain("<StatusCard");
    const statusCardSource = readSource("src", "components", "ui", "feedback.tsx");
    expect(statusCardSource).toContain('role={tone === "error" ? "alert" : "status"}');
  });
});

describe("Reduced motion", () => {
  it("the global blanket prefers-reduced-motion rule still exists and covers the new animations (which use standard animation/transition props)", () => {
    const css = readSource("src", "app", "globals.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 1ms !important");
  });

  it("new keyframes use opacity/transform only - no motion that would look broken frozen at 1ms", () => {
    const css = readSource("src", "app", "globals.css");
    const glowBlock = css.slice(css.indexOf("@keyframes p30-glow-breathe"), css.indexOf("@keyframes p30-glow-breathe") + 150);
    expect(glowBlock).toContain("opacity");
    const fadeBlock = css.slice(css.indexOf("@keyframes p30-fade-up"), css.indexOf("@keyframes p30-fade-up") + 150);
    expect(fadeBlock).toContain("opacity");
    expect(fadeBlock).toContain("transform");
  });
});

describe("Autofill compatible with the dark theme", () => {
  it("overrides -webkit-autofill so Chrome never shows its light/yellow background", () => {
    const css = readSource("src", "app", "globals.css");
    expect(css).toContain("input:-webkit-autofill");
    expect(css).toContain("-webkit-box-shadow: 0 0 0 1000px");
    expect(css).toContain("-webkit-text-fill-color");
  });
});

describe("PWA readiness", () => {
  it("the auth shell respects safe-area insets for standalone/notch devices", () => {
    const shell = readSource("src", "components", "auth", "auth-shell.tsx");
    expect(shell).toContain("env(safe-area-inset-top)");
    expect(shell).toContain("env(safe-area-inset-bottom)");
  });

  it("uses min-h-dvh (dynamic viewport height), which correctly accounts for the mobile virtual keyboard/browser chrome", () => {
    const shell = readSource("src", "components", "auth", "auth-shell.tsx");
    const layout = readSource(...authDir, "layout.tsx");
    expect(shell + layout).toContain("min-h-dvh");
  });
});
