# Workflow Editor Enhancements Implementation Plan

## Phase 1: Integrierter Array-Iterator (Priorität: Höchste) ✅ IN PROGRESS

### Problem

Wenn ein Node ein Array zurückgibt (z.B. HTTP Request → `{data: [{username: "user1", email: "email1"}, ...]}`), sollen die einzelnen Felder der Array-Items in der Variablen-Liste verfügbar sein, damit man `{{data[0].username}}` oder `{{data.username}}` verwenden kann.

### Lösung

**Array-Extraktion:**

- `{{data}}` → Komplettes Array
- `{{data[0].username}}` → Erster Username: `"user1"`
- `{{data.username}}` → Array aller Usernames: `["user1", "user2", ...]` (als JSON-String für Templates)

**Variable-Anzeige im UI:**

1. `data` → Das komplette Array
2. `data[0].username`, `data[1].username`, ... → Einzelne Items (als Beispiele, max. 3-5)
3. `data.username` → Array-Extraktion (alle Usernames als Array)
4. `data.email` → Array-Extraktion (alle Emails als Array)

### Implementierung

#### Backend

1. **`src/services/full-workflow/variable-context.service.js`**:
   - `getAvailableVariables()` erweitern, um Arrays zu erkennen
   - Wenn ein Feld ein Array ist:
     - Array selbst hinzufügen: `data`
     - Index-basierte Beispiele: `data[0].username`, `data[1].username` (max. 3-5)
     - Array-Extraktionen: `data.username`, `data.email` (alle Felder aus Array-Items extrahieren)

2. **`src/utils/template-engine.js`**:
   - `getNestedValue()` erweitern für Array-Extraktion
   - Neue Funktion `extractArrayField()`: Wenn `data` ein Array ist und `data.username` aufgerufen wird, extrahiere alle `username`-Werte
   - `resolveTemplate()` erweitern: `{{data.username}}` erkennt Array und gibt `["user1", "user2", ...]` zurück (als JSON-String)

#### Frontend

3. **`ui/src/utils/variableUtils.js`**:
   - `getAvailableVariables()` erweitern, um Arrays zu erkennen
   - Gleiche Logik wie Backend: Array selbst, Index-Beispiele, Array-Extraktionen

4. **`ui/src/components/full-workflow/sidebar/InputPanel.jsx`**:
   - Array-Variablen visuell kennzeichnen (z.B. Badge "Array")
   - Array-Extraktionen gruppiert anzeigen

### Dateien

- `src/services/full-workflow/variable-context.service.js`: `getAvailableVariables()` erweitern
- `src/utils/template-engine.js`: Array-Extraktion in `resolveTemplate()` und `getNestedValue()`
- `ui/src/utils/variableUtils.js`: `getAvailableVariables()` erweitern für UI
- `ui/src/components/full-workflow/sidebar/InputPanel.jsx`: Array-Felder anzeigen (optional: visuelle Kennzeichnung)

---

## Phase 2: Email Node

### Features

- E-Mails senden über SMTP
- HTML/Plain Text Support
- Attachments aus vorherigen Nodes
- Credentials in Settings (verschlüsselt, wie OpenAI API Key)

### Dateien

- `src/models/user-email-credentials.model.js`: Neue Tabelle für verschlüsselte SMTP-Credentials
- `src/services/email.service.js`: Email-Service mit nodemailer
- `src/services/full-workflow/node-handlers/email.handler.js`: Email Node Handler
- `src/controllers/email.controller.js`: API für Credentials-Management
- `src/routes/email.routes.js`: Fastify Routes
- `ui/src/components/full-workflow/nodes/EmailNode.jsx`: React Flow Node
- `ui/src/components/full-workflow/sidebar/configs/EmailConfig.jsx`: Konfiguration
- `ui/src/components/full-workflow/sidebar/SettingsTab.jsx`: Email Credentials Manager
- Migration: `drizzle/0009_email_credentials.sql`

---

## Phase 3: Schedule/Cron Trigger

### Features

- Zeitbasierte Trigger (täglich, wöchentlich, etc.)
- Cron-Expressions Support
- Presets: "Daily", "Weekly", "Monthly"
- BullMQ Repeating Jobs (wie Google Sheets Trigger)

### Dateien

- `src/services/full-workflow/trigger-polling.service.js`: `handleScheduleTrigger()` hinzufügen
- `src/services/full-workflow/node-handlers/schedule-trigger.handler.js`: Handler (passive, wie webhook-trigger)
- `ui/src/components/full-workflow/nodes/ScheduleTriggerNode.jsx`: React Flow Node
- `ui/src/components/full-workflow/sidebar/configs/ScheduleTriggerConfig.jsx`: Cron-Expression/Preset UI
- `ui/src/pages/FullWorkflowEditor.jsx`: Schedule Trigger Button hinzufügen
- `src/services/full-workflow/executor.service.js`: `schedule-trigger` als Trigger Node erkennen

---

## Phase 4: Workflow-Versionierung

### Features

- Snapshots des Workflows speichern
- Versionen anzeigen und wiederherstellen
- Automatische oder manuelle Versionierung

### Dateien

- `src/models/workflow-version.model.js`: Neue Tabelle `workflow_versions`
- `src/services/workflow-version.service.js`: Version-Management
- `src/controllers/workflow-version.controller.js`: API Endpoints
- `src/routes/workflow-version.routes.js`: Fastify Routes
- `ui/src/pages/FullWorkflowEditor.jsx`: Version-Dropdown und Restore-Button
- Migration: `drizzle/0010_workflow_versions.sql`

---

## Phase 5: Workflow-Export/Import

### Features

- Workflow als JSON exportieren
- Workflow aus JSON importieren
- Validierung beim Import

### Dateien

- `src/controllers/full-workflow.controller.js`: `exportWorkflowHandler()`, `importWorkflowHandler()`
- `src/routes/full-workflow.routes.js`: Export/Import Routes
- `ui/src/pages/FullWorkflowEditor.jsx`: Export/Import Buttons
- `ui/src/components/full-workflow/WorkflowImportModal.jsx`: Import-Modal

---

## Phase 6: Performance-Monitoring

### Features

- Ausführungszeit pro Node messen
- Statistiken anzeigen (Durchschnitt, Min, Max)
- Bottleneck-Erkennung
- Performance-Graph im UI

### Dateien

- `src/services/full-workflow/performance.service.js`: Performance-Tracking
- `src/services/full-workflow/executor.service.js`: `performance.now()` vor/nach Node-Execution
- `src/controllers/full-workflow.controller.js`: Performance-Endpoint
- `ui/src/pages/FullWorkflowEditor.jsx`: Performance-Section in Statistics
- Redis: `workflow:${id}:performance` für Metriken

---

## Phase 7: Caching

### Features

- Node-Outputs cachen basierend auf Input-Hash
- TTL (Time To Live) konfigurierbar
- Cache-Invalidierung
- Manual Clear Cache Button
- Baue es aus bestehendem Cache System

### Dateien

- `src/services/full-workflow/cache.service.js`: Cache-Management
- `src/services/full-workflow/executor.service.js`: Cache-Check vor Node-Execution
- `src/services/full-workflow/node-handlers/index.js`: Cache-Key generieren
- `ui/src/components/full-workflow/sidebar/SettingsTab.jsx`: Cache-Settings pro Node
- Redis: `node-cache:${nodeId}:${inputHash}`

---

## Phase 8: Parallele Ausführung

### Features

- Mehrere Nodes parallel ausführen, wenn sie von derselben Node ausgehen
- Merge Node wartet auf alle parallelen Executions

### Dateien

- `src/services/full-workflow/executor.service.js`: `executeNodeRecursive()` erweitern für Parallel-Execution
- `src/services/full-workflow/node-handlers/merge.handler.js`: Merge Node Handler
- `ui/src/components/full-workflow/nodes/MergeNode.jsx`: React Flow Node
- `ui/src/components/full-workflow/sidebar/configs/MergeConfig.jsx`: Merge-Strategien UI

---

## Phase 9: Error Recovery & Fallback-Pfade

### Features

- Error-Config pro Node: "Continue", "Stop", "Retry", "Go to Fallback Node"
- Retry-Logik mit konfigurierbarer Anzahl und Delay
- Fallback-Node bei Fehler

### Dateien

- `src/services/full-workflow/executor.service.js`: Error-Handling-Logik
- `src/services/full-workflow/node-handlers/error-handler.handler.js`: Error Handler Node
- `ui/src/components/full-workflow/nodes/ErrorHandlerNode.jsx`: React Flow Node
- `ui/src/components/full-workflow/sidebar/configs/ErrorHandlerConfig.jsx`: Error-Config UI
- `ui/src/components/full-workflow/sidebar/configs/*.jsx`: Error-Settings zu allen Node-Configs hinzufügen
