# Inngest Integration - Vollständige Dokumentation

## Übersicht

Diese Anwendung nutzt **Inngest** als Serverless-Workflow-Orchestrierungs-Engine für komplexe Workflows. Inngest ermöglicht es, Workflows asynchron auszuführen, mit automatischen Retries, Step-by-Step-Execution und besserer Observability.

## Warum Inngest?

### Entscheidung: Inngest vs. BullMQ

**BullMQ** wird für einfache, synchrone Jobs verwendet (z.B. Phone Calls, Email Jobs).  
**Inngest** wird für komplexe, mehrstufige Workflows verwendet (Full Workflows mit mehreren Nodes).

**Vorteile von Inngest:**

- Automatische Retries mit exponentieller Backoff
- Step-by-Step-Execution mit Checkpointing
- Bessere Observability und Debugging
- Serverless-Architektur (keine eigene Queue-Infrastruktur nötig)
- Automatische Fehlerbehandlung und Logging

**Nachteile:**

- Externe Abhängigkeit (Cloud-Service)
- Setup erforderlich (Dev Server oder Cloud Account)

## Architektur

### Workflow-Execution-Flow

```
User triggert Workflow
    ↓
Full Workflow Controller
    ↓
Trigger Service (trigger.service.js)
    ↓
Inngest Event: 'workflow/triggered'
    ↓
Inngest Function: executeFullWorkflowFunction
    ↓
Executor Service (executor.service.js)
    ↓
Node Handlers (node-handlers/)
    ↓
Workflow Output
```

### Dateien-Struktur

```
src/
├── config/
│   └── inngest.js                    # Inngest Client Konfiguration
├── routes/
│   └── inngest.routes.js             # Inngest Fastify Routes
└── services/
    └── full-workflow/
        ├── trigger.service.js        # Workflow-Triggering via Inngest
        ├── inngest-functions.js      # Inngest Functions Definition
        └── executor.service.js        # Workflow Execution Logic
```

## Setup

### 1. Inngest Account erstellen

1. Gehe zu [inngest.com](https://www.inngest.com)
2. Erstelle einen Account
3. Erstelle eine neue App
4. Notiere die **App ID** (wird in `.env` benötigt)

### 2. Environment Variables

#### Development (`.env.development`)

```env
# Inngest Configuration
INNGEST_APP_ID=acquisitions-app
# WICHTIG: In Development KEINE Signing Keys setzen!
# Das würde Inngest in Cloud-Mode zwingen
```

#### Production (`.env.production`)

```env
# Inngest Configuration
INNGEST_APP_ID=acquisitions-app
INNGEST_SIGNING_KEY=sign_xxxxxxxxxxxxx  # Aus Inngest Dashboard
INNGEST_EVENT_KEY=xxxxxxxxxxxxx          # Aus Inngest Dashboard
```

### 3. Inngest Dev Server (Development)

**WICHTIG:** In Development muss der Inngest Dev Server lokal laufen!

```bash
# Installiere Inngest CLI
npm install -g inngest

# Starte Dev Server
inngest dev
```

Der Dev Server läuft standardmäßig auf `http://localhost:8288`.

**Docker Setup:**
Wenn die App in Docker läuft, muss der Dev Server auf dem Host laufen. Die App nutzt `host.docker.internal:8288`, um auf den Dev Server zuzugreifen.

### 4. Inngest Dashboard (Production)

In Production nutzt die App Inngest Cloud. Die App muss öffentlich erreichbar sein (z.B. via ngrok oder Deployment).

**App URL konfigurieren:**

1. Gehe zu Inngest Dashboard
2. Öffne deine App
3. Setze die **App URL** auf deine öffentliche URL (z.B. `https://your-app.com`)
4. Die App muss unter `/api/inngest` erreichbar sein

## Konfiguration

### Inngest Client (`src/config/inngest.js`)

Der Inngest Client wird automatisch konfiguriert basierend auf `NODE_ENV`:

**Development:**

- `isDev: true` - Nutzt Dev Server
- `baseUrl: http://host.docker.internal:8288` - Dev Server URL
- `signingKey: undefined` - Keine Signing Key (Dev Mode)

**Production:**

- `signingKey: INNGEST_SIGNING_KEY` - Aus Environment Variable
- `eventKey: INNGEST_EVENT_KEY` - Aus Environment Variable
- Nutzt Inngest Cloud (keine baseUrl nötig)

### Inngest Routes (`src/routes/inngest.routes.js`)

Die Routes registrieren die Inngest Functions bei Fastify:

- **Path:** `/api/inngest`
- **Functions:** `executeFullWorkflowFunction`
- **Plugin:** `inngest/fastify`

**Development:**

- `skipSignatureValidation: true` - Keine Signatur-Validierung
- `signingKey: null` - Explizit null setzen

**Production:**

- `signingKey: inngest.signingKey` - Signatur-Validierung aktiviert

## Inngest Functions

### executeFullWorkflowFunction

**Event:** `workflow/triggered`

**Steps:**

1. **load-workflow** - Lädt Workflow aus Datenbank
2. **execute-workflow** - Führt Workflow aus

**Retries:** 3 (automatisch mit exponentieller Backoff)

**Input:**

```javascript
{
  workflowId: number,
  userId: number,
  input: object  // Workflow Input Data
}
```

**Output:**

```javascript
{
  success: true,
  workflowId: number,
  result: object  // Execution Result
}
```

## Workflow Triggering

### Via API

```javascript
POST /api/full-workflows/:id/trigger
{
  "input": {
    // Workflow Input Data
  }
}
```

### Via Code

```javascript
import { triggerWorkflow } from '#services/full-workflow/trigger.service.js';

await triggerWorkflow(workflowId, userId, input);
```

## Development vs. Production

### Development

- **Dev Server** läuft lokal auf `localhost:8288`
- **Keine Signing Keys** nötig
- **Keine Cloud-Authentifizierung**
- **Schnelles Iterieren** möglich

**Setup:**

1. Starte Inngest Dev Server: `inngest dev`
2. Starte deine App
3. Dev Server scannt automatisch nach Functions

### Production

- **Inngest Cloud** wird genutzt
- **Signing Keys** erforderlich
- **App muss öffentlich erreichbar sein**
- **Signatur-Validierung** aktiviert

**Setup:**

1. Setze `INNGEST_SIGNING_KEY` und `INNGEST_EVENT_KEY` in `.env.production`
2. Setze App URL im Inngest Dashboard
3. Deploye deine App
4. Inngest Cloud verbindet sich mit deiner App

## Troubleshooting

### "Expected server kind cloud, got dev"

**Problem:** Inngest versucht Cloud-Mode zu nutzen, aber Dev Server läuft.

**Lösung:**

1. Prüfe, ob `INNGEST_SIGNING_KEY` in Development gesetzt ist → Entfernen!
2. Prüfe, ob `isDev: true` in `inngest.js` gesetzt ist
3. Prüfe, ob Dev Server läuft: `inngest dev`

### "url_not_found" oder "internal_server_error"

**Problem:** Inngest kann die App nicht erreichen.

**Lösung:**

1. **Development:** Prüfe, ob App auf `http://host.docker.internal:8288` erreichbar ist
2. **Production:** Prüfe, ob App öffentlich erreichbar ist und App URL im Dashboard korrekt ist
3. Prüfe, ob `/api/inngest` Route registriert ist

### Functions werden nicht gefunden

**Problem:** Dev Server findet keine Functions.

**Lösung:**

1. Prüfe, ob `inngest.routes.js` in `fastify-app.js` registriert ist
2. Prüfe, ob Functions in `inngest.routes.js` registriert sind
3. Prüfe Logs: `Inngest routes registered`

### Signing Key Fehler in Production

**Problem:** Signatur-Validierung schlägt fehl.

**Lösung:**

1. Prüfe, ob `INNGEST_SIGNING_KEY` korrekt gesetzt ist
2. Prüfe, ob Signing Key im Inngest Dashboard korrekt ist
3. Prüfe, ob App URL im Dashboard korrekt ist

## Best Practices

1. **Development:** Nutze immer Dev Server für lokale Entwicklung
2. **Production:** Setze immer Signing Keys für Sicherheit
3. **Error Handling:** Nutze Inngest's automatische Retries
4. **Logging:** Nutze Step-Logging für besseres Debugging
5. **Testing:** Teste Functions lokal mit Dev Server vor Deployment

## Monitoring

### Inngest Dashboard

- **Events:** Alle getriggerten Events
- **Functions:** Alle registrierten Functions
- **Runs:** Alle Function-Executions mit Logs
- **Errors:** Alle Fehler mit Stack Traces

### Application Logs

Die App loggt alle Inngest-Operationen:

- `Inngest client initialized`
- `Inngest routes registered`
- `Triggering workflow via Inngest`
- `Executing full workflow via Inngest`
- `Workflow executed successfully`

## Migration von BullMQ zu Inngest

Für neue Workflows wird Inngest empfohlen. Bestehende BullMQ Jobs bleiben unverändert.

**Wann Inngest nutzen:**

- Komplexe, mehrstufige Workflows
- Workflows mit vielen Nodes
- Workflows mit Conditional Logic
- Workflows mit Retries nötig

**Wann BullMQ nutzen:**

- Einfache, synchrone Jobs
- Phone Calls, Emails
- Einzelne, atomare Operationen
