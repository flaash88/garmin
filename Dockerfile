# =============================================================================
# Takt — Abbilder für den Betrieb.
#
# Zwei Endstufen aus einem Bau:
#
#   laufen     der Webdienst. Eigenständiges Bündel, kein Quelltext, kein
#              vollständiges node_modules.
#   werkzeuge  Abgleich, Wochenbriefing, Wanderungen, Einrichtung der
#              Coach-Rolle. Braucht Quelltext und die Abhängigkeiten.
#
# Der Webdienst bleibt damit schlank, ohne dass die Werkzeuge ein eigenes
# Abbild brauchen.
# =============================================================================

FROM node:22-alpine AS abhaengigkeiten
WORKDIR /takt
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile


FROM node:22-alpine AS bauen
WORKDIR /takt
RUN corepack enable
COPY --from=abhaengigkeiten /takt/node_modules ./node_modules
COPY . .
# Der Build braucht keine Datenbank: die Verbindung entsteht erst beim ersten
# Zugriff, und alles hinter der Anmeldung wird je Anfrage erzeugt.
RUN pnpm build

# Die native Binärdatei des Agent SDK muss im Bündel liegen.
#
# Sie kommt als optionale Abhängigkeit je Plattform und wurde beim ersten Bau
# stillschweigend ausgelassen; der Build lief durch, und erst der erste Chat
# scheiterte mit «Native CLI binary for linux-x64 not found». Diese Prüfung
# lässt den Bau scheitern statt ein kaputtes Abbild auszuliefern.
RUN set -eu; \
    if [ -z "$(find .next/standalone -name claude -type f -print -quit)" ]; then \
      echo "FEHLER: Die native Binärdatei des Agent SDK fehlt im Bündel." >&2; \
      echo "  Erwartet unter .next/standalone/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk-*/" >&2; \
      echo "  Ursache meist: Installation mit --omit=optional oder --no-optional," >&2; \
      echo "  oder outputFileTracingIncludes in next.config.ts greift nicht mehr." >&2; \
      exit 1; \
    fi; \
    if ! find node_modules/.pnpm -maxdepth 1 -name "@anthropic-ai+claude-agent-sdk-*" -print -quit | grep -q .; then \
      echo "FEHLER: Kein Plattformpaket des Agent SDK installiert." >&2; \
      exit 1; \
    fi; \
    echo "Agent-Binärdatei im Bündel: ok"


# --- Webdienst ---------------------------------------------------------------
FROM node:22-alpine AS laufen
WORKDIR /takt

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# tini, damit Signale ankommen und keine Zombies bleiben. curl für den
# Gesundheitstest des Verbunds.
RUN apk add --no-cache tini curl

COPY --from=bauen --chown=node:node /takt/.next/standalone ./
COPY --from=bauen --chown=node:node /takt/.next/static ./.next/static
COPY --from=bauen --chown=node:node /takt/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]


# --- Werkzeuge ---------------------------------------------------------------
FROM node:22-alpine AS werkzeuge
WORKDIR /takt

ENV NODE_ENV=production

RUN apk add --no-cache tini postgresql16-client

# pnpm mit ins Abbild. Ohne das laufen die Befehle aus package.json —
# `pnpm db:migrate`, `pnpm abgleich`, `pnpm briefing` — im gebauten Abbild
# nicht, und es bliebe nur der Aufruf über node_modules/.bin. Die Dokumentation
# nennt beide Wege; beide sollen auch tragen.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY --from=bauen --chown=node:node /takt/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json drizzle.config.ts ./
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node lib ./lib
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node datenbank ./datenbank

USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node_modules/.bin/tsx", "scripts/zeitplan.ts"]
