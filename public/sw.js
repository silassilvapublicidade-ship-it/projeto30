/**
 * Projeto 30 - hand-written service worker (no Serwist/next-pwa/Workbox).
 *
 * Why hand-written: Next.js 16 uses Turbopack by default for both `next dev`
 * and `next build`, and a `next build` with a custom `webpack` config now
 * FAILS outright unless `--webpack` is passed (see
 * node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md,
 * "Turbopack by default"). @serwist/next and next-pwa both work by injecting
 * a webpack() function into next.config.js via a `withX()` wrapper - under
 * Turbopack-by-default that would break `next build` for the whole app, not
 * just the PWA piece. next-pwa is additionally unmaintained since 2022. A
 * small vanilla service worker has zero build-tool coupling and is fully
 * auditable, which matters given how strict the caching rules below are.
 *
 * SAFETY RULES (read before changing anything here):
 *  1. Only GET requests are ever intercepted. Server Actions POST to the
 *     same URL as the page that renders them - intercepting POST/PUT/PATCH/
 *     DELETE here would silently break mutations, auth, and uploads.
 *  2. Page caching uses an ALLOWLIST (NETWORK_FIRST_PAGE_PATHS), not a
 *     blocklist. Anything not explicitly listed - Admin, auth, Diário,
 *     Configurações, onboarding, API routes - is never cached, fails closed.
 *  3. Tip images only get Stale-While-Revalidate when request.referrer
 *     points at the public /app/dicas gallery, never /admin - an admin
 *     previewing a draft's image must not have it persisted to Cache
 *     Storage just because the URL pattern looks the same as a published one.
 */

const SW_VERSION = "v1";
const SHELL_CACHE = `p30-shell-${SW_VERSION}`;
const STATIC_CACHE = `p30-static-${SW_VERSION}`;
const PAGE_CACHE = `p30-pages-${SW_VERSION}`;
const IMAGE_CACHE = `p30-images-${SW_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE];

const OFFLINE_URL = "/offline.html";

const SHELL_ASSETS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/favicon.ico",
];

// Exactly the round's Network First list - Hoje, Jornada, Desafios, Perfil,
// Conquistas, Dicas (dynamic pages). Matches the path and any subpath
// (e.g. /app/desafios/algum-slug), so detail routes are covered too.
const NETWORK_FIRST_PAGE_PATHS = [
  "/app/hoje",
  "/app/jornada",
  "/app/desafios",
  "/app/perfil",
  "/app/conquistas",
  "/app/dicas",
];

function isNetworkFirstPage(pathname) {
  return NETWORK_FIRST_PAGE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/icon.png" ||
      url.pathname === "/apple-icon.png")
  );
}

function isPublicTipImage(request, url) {
  if (!url.pathname.includes("/storage/v1/object/public/tip-cards/")) return false;
  const referrer = request.referrer || "";
  // Never cache an image an admin editor/preview screen referenced - those
  // can be drafts, and the URL alone doesn't reveal publication status.
  if (referrer.includes("/admin")) return false;
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      // Deliberately no self.skipWaiting() here - the new worker waits until
      // the user accepts the update prompt (see sw-registration.tsx), so a
      // deploy never yanks the app out from under a form or upload in
      // progress.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("p30-") && !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await networkPromise) || Response.error();
}

async function networkFirstPage(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function navigationFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Rule 1: never touch anything but GET. This is what keeps Server
  // Actions, auth POSTs, uploads and all mutations completely untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin, non-Supabase-Storage requests: let the browser handle
  // them natively (analytics, fonts CDN if any is ever added, etc.).
  if (url.origin !== self.location.origin && !isPublicTipImage(request, url)) {
    return;
  }

  if (isPublicTipImage(request, url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    if (isNetworkFirstPage(url.pathname)) {
      event.respondWith(networkFirstPage(request, PAGE_CACHE));
    } else {
      // Admin, auth, Diário, Configurações, onboarding and anything else
      // not explicitly allowlisted: real network request every time, no
      // Cache Storage involvement - only step in to swap a hard network
      // failure for the offline shell instead of the browser's own error
      // page.
      event.respondWith(navigationFallback(request));
    }
    return;
  }

  // Everything else (API routes, RSC data requests, Supabase calls, etc.):
  // do not intercept at all.
});

/**
 * Web Push (Modulo F). Everything below is additive to the caching logic
 * above - no existing listener is touched, and push/notificationclick only
 * ever act on notification data, never on cache/fetch.
 *
 * Destination allowlist duplicated by hand from
 * src/features/notifications/notification-destination.core.ts - this file
 * has no build step (see the header comment), so it cannot import that
 * module. Keep both in sync if the allowlist ever changes.
 */
const NOTIFICATION_DESTINATION_TYPES = [
  "hoje",
  "desafios",
  "desafio",
  "jornada",
  "dicas",
  "dica",
  "conquistas",
  "notificacoes",
  "configuracoes_notificacoes",
];

function isSafeSlug(value) {
  return /^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$|^[a-z0-9]$/.test(value);
}

function resolveDestinationPath(destinationType, destinationReferenceId) {
  if (NOTIFICATION_DESTINATION_TYPES.indexOf(destinationType) === -1) {
    return null;
  }

  const ref = (destinationReferenceId || "").trim();

  switch (destinationType) {
    case "hoje":
      return "/app/hoje";
    case "desafios":
      return "/app/desafios";
    case "desafio":
      return ref && isSafeSlug(ref) ? "/app/desafios/" + ref : null;
    case "jornada":
      return "/app/jornada";
    case "dicas":
      return "/app/dicas";
    case "dica":
      return ref && isSafeSlug(ref) ? "/app/dicas/" + ref : null;
    case "conquistas":
      return "/app/conquistas";
    case "notificacoes":
      return "/app/notificacoes";
    case "configuracoes_notificacoes":
      return "/app/configuracoes/notificacoes";
    default:
      return null;
  }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  if (!payload || typeof payload.title !== "string" || typeof payload.body !== "string") {
    return;
  }

  const destinationPath = resolveDestinationPath(payload.destinationType, payload.destinationReferenceId);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      badge: payload.badge || "/icons/icon-192.png",
      body: payload.body,
      data: {
        campaignId: payload.campaignId || null,
        deliveryId: payload.deliveryId || null,
        destinationPath,
        notificationId: payload.notificationId || null,
      },
      icon: payload.icon || "/icons/icon-192.png",
      image: payload.image || undefined,
      tag: payload.tag || undefined,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = (event.notification && event.notification.data) || {};
  const destinationPath = data.destinationPath;

  event.notification.close();

  event.waitUntil(
    (async () => {
      // Best-effort click tracking - never blocks navigation on failure.
      if (data.notificationId || data.deliveryId) {
        try {
          await fetch("/api/notifications/click", {
            body: JSON.stringify({ deliveryId: data.deliveryId, notificationId: data.notificationId }),
            credentials: "include",
            headers: { "content-type": "application/json" },
            method: "POST",
          });
        } catch {
          // Ignored - the click itself must still open the destination.
        }
      }

      if (!destinationPath) {
        return;
      }

      const targetUrl = new URL(destinationPath, self.location.origin).href;
      const windowClients = await clients.matchAll({ includeUncontrolled: true, type: "window" });

      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }

      await clients.openWindow(targetUrl);
    })(),
  );
});
