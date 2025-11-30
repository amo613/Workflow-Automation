# Workflow Execution Flow - Vollständige Analyse

## Übersicht

Diese Datei dokumentiert den kompletten Flow von Workflow-Trigger bis zur UI-Anzeige, um sicherzustellen, dass alle Daten korrekt und zur richtigen Zeit am richtigen Ort verarbeitet werden.

---

## Phase 1: Workflow Trigger

### 1.1 Trigger Service (`src/services/full-workflow/trigger.service.js`)

**Flow:**

1. `triggerWorkflow(workflowId, userId, input)` wird aufgerufen
2. Inngest Event wird gesendet: `inngest.send({ name: 'workflow/triggered', data: {...} })`
3. **WICHTIG:** Sofort nach Event-Send wird ein "pending" Cache-Eintrag erstellt:
   - Cache Key: `workflow-execution:${eventId}`
   - Status: `'pending'`
   - `nodeOutputs: {}`, `executedEdges: []`, `executionLog: []`
   - Wird in Memory Cache (TTL: 5min) und Redis (TTL: 1h) gespeichert
4. `eventId` wird zurückgegeben

**✅ Gut:** Pending Cache wird sofort erstellt → Frontend sieht sofort, dass Workflow läuft

**⚠️ Potenzielle Probleme:**

- `triggerByWebhook()` erstellt KEINEN pending Cache! → Webhook-Trigger könnten 404-Fehler bekommen
- Redis-Cache wird asynchron erstellt (gut), aber wenn Redis langsam ist, könnte Memory Cache fehlen

---

## Phase 2: Inngest Function Execution

### 2.1 Inngest Function (`src/services/full-workflow/inngest-functions.js`)

**Flow:**

1. Event `'workflow/triggered'` wird empfangen
2. **Step 1:** Workflow aus DB laden (`getFullWorkflow()`)
3. **Step 2:** Cache-Updater-Funktion wird erstellt:
   ```javascript
   const updateCacheIncremental = partialResult => {
     // Erstellt Cache-Eintrag mit status: 'running'
     // nodeOutputs, executedEdges, executionLog werden aktualisiert
   };
   ```
4. **Step 3:** `executeWorkflow()` wird aufgerufen mit `updateCacheIncremental` als Parameter
5. Nach erfolgreicher Execution:
   - Finaler Cache-Eintrag mit `success: true` und `completedAt`
   - Status wird NICHT mehr auf 'completed' gesetzt (fehlt!)
6. Bei Fehler:
   - Partial results werden gecacht
   - Error-Message und Stack werden gespeichert

**✅ Gut:**

- Incremental caching funktioniert
- Partial results werden bei Fehlern gespeichert

**⚠️ Potenzielle Probleme:**

1. **KRITISCH:** Finaler Cache-Eintrag hat `success: true`, aber `status` fehlt! → Frontend erkennt nicht, dass Workflow fertig ist
2. Cache-Updater wird bei jedem Node aufgerufen, aber `executedEdges` ist ein `Set` → muss zu Array konvertiert werden (wird gemacht: `Array.from()`)
3. Bei Fehler wird `result` verwendet, aber `result` könnte `undefined` sein, wenn Fehler vor Execution auftritt

---

## Phase 3: Workflow Execution

### 3.1 Executor Service (`src/services/full-workflow/executor.service.js`)

**Flow:**

1. `executeWorkflow()` initialisiert:
   - VariableContext
   - Findet Start-Node (Trigger-Node oder Start-Node)
   - Baut Adjacency-List für Graph-Traversal
   - Erstellt `executionLog: []`, `visited: Set()`, `executedEdges: Set()`

2. `executeNodeRecursive()` wird rekursiv aufgerufen:
   - **Cycle Detection:** Prüft ob Node bereits besucht wurde
   - **Node Execution:**
     - `executeNode(node, templateContext, context)` wird aufgerufen
     - Output wird in `context.setNodeOutput(nodeId, output)` gespeichert
     - Performance wird getrackt (asynchron)
   - **Execution Log:**
     - Erfolg: `{ nodeId, type, status: 'completed', timestamp }`
     - Fehler: `{ nodeId, type, status: 'failed', error, timestamp }`
   - **Incremental Cache Update:**
     - Wird nach JEDEM Node aufgerufen (wenn `incrementalCacheUpdater` vorhanden)
     - Übergibt: `{ nodeOutputs, executedEdges, executionLog }`
   - **Edge Tracking:**
     - Alle ausgehenden Edges werden zu `executedEdges` hinzugefügt
     - Edge-ID wird generiert: `edge.id || reactflow__edge-${source}-${target}`

3. **Spezielle Node-Typen:**
   - **If Node:** Nur ein Pfad wird ausgeführt (true/false)
   - **Wait Node:** Wartet für bestimmte Dauer
   - **Merge Node:** Wartet auf alle parallelen Branches
   - **End Node:** Stoppt Execution

4. **Parallele Execution:**
   - Wenn Node mehrere ausgehende Edges hat (außer If-Node):
     - Jeder Branch bekommt geklonten `VariableContext`
     - `Promise.all()` führt alle Branches parallel aus
     - Outputs werden nach `Promise.all()` in main context kopiert
     - **WICHTIG:** `executedEdges` wird für ALLE ausgehenden Edges gesetzt

**✅ Gut:**

- Cycle Detection verhindert Endlosschleifen
- Parallele Execution funktioniert
- Incremental caching nach jedem Node

**⚠️ Potenzielle Probleme:**

1. **KRITISCH:** `executedEdges` wird als `Set` übergeben, aber im Cache-Updater wird `Array.from()` aufgerufen → sollte funktionieren, aber könnte Race-Conditions geben
2. Bei parallelen Branches werden `executedEdges` mehrfach gesetzt → könnte zu Duplikaten führen (aber Set verhindert das)
3. Wenn ein Node fehlschlägt, wird Exception geworfen → Workflow stoppt komplett (außer bei parallelen Branches)
4. **KRITISCH:** `executedEdges` werden NUR für ausgehende Edges gesetzt, nicht für eingehende! → Wenn Merge Node mehrere eingehende Edges hat, werden diese nicht getrackt

---

## Phase 4: Cache Retrieval

### 4.1 Execution Results Handler (`src/controllers/full-workflow.controller.js`)

**Flow:**

1. Frontend ruft `/api/full-workflows/execution-results?eventId=...` auf
2. Handler sucht in Memory Cache (schnell)
3. Falls nicht gefunden, sucht in Redis
4. Falls gefunden in Redis, wird auch in Memory Cache gespeichert (für nächste Requests)
5. Falls nicht gefunden: 404 mit `status: 'pending'`

**✅ Gut:**

- Memory Cache wird bevorzugt (schnell)
- Redis als Fallback
- 404 wird mit `status: 'pending'` zurückgegeben

**⚠️ Potenzielle Probleme:**

- Wenn Cache zwischen Memory und Redis nicht synchron ist, könnte Frontend inkonsistente Daten sehen

---

## Phase 5: Frontend Polling & UI Updates

### 5.1 FullWorkflowEditor (`ui/src/pages/FullWorkflowEditor.jsx`)

**Flow:**

1. **Trigger:** User klickt "Execute" oder Trigger wird automatisch ausgelöst
2. **Polling Start:**
   - Polling startet sofort (keine Verzögerung mehr)
   - Intervall: 200ms
3. **Polling Logic:**
   - Request an `/api/full-workflows/execution-results?eventId=...`
   - **Status Check:**
     - `status === 'pending' || status === 'running'`:
       - Nodes werden SOFORT aktualisiert basierend auf `executionLog`
       - `executedEdges` werden SOFORT aktualisiert
       - Polling wird fortgesetzt
     - `status === undefined` (finaler Cache):
       - Workflow ist fertig
       - Finale Node-Updates
       - Polling wird gestoppt
   - **404 Handling:** Wird stillschweigend ignoriert (weiterpolling)

4. **Node Updates:**
   - Bei `pending/running`: Nodes werden sofort aktualisiert, sobald sie in `executionLog` erscheinen
   - Bei Completion: Alle Nodes werden final aktualisiert

**✅ Gut:**

- Incremental Updates funktionieren
- 404-Fehler werden ignoriert
- Schnelles Polling (200ms)

**⚠️ Potenzielle Probleme:**

1. **KRITISCH:** Frontend prüft `status === 'pending' || status === 'running'`, aber finaler Cache hat `status: undefined`! → Frontend erkennt Completion nur, wenn `status` fehlt
2. **KRITISCH:** `executedEdges` werden als Array erwartet, aber im Cache könnten sie als Set gespeichert sein → `Array.from()` wird im Cache-Updater gemacht, sollte OK sein
3. Bei parallelen Branches werden Edges möglicherweise mehrfach aktualisiert → könnte zu Flackern führen
4. **KRITISCH:** Wenn ein Node fehlschlägt, wird Exception geworfen → Workflow stoppt, aber Frontend sieht nur den letzten erfolgreichen Node im Cache

---

## Identifizierte Probleme

### 🔴 KRITISCH

1. **Finaler Cache-Eintrag hat kein `status` Feld:**
   - **Problem:** Frontend erkennt Completion nur, wenn `status` fehlt oder nicht `'pending'/'running'` ist
   - **Lösung:** Finaler Cache sollte `status: 'completed'` haben

2. **Webhook-Trigger erstellt keinen pending Cache:**
   - **Problem:** `triggerByWebhook()` erstellt keinen pending Cache → Frontend bekommt 404-Fehler
   - **Lösung:** Pending Cache auch in `triggerByWebhook()` erstellen

3. **HTTP Request Handler Fehler:**
   - **Problem:** "HTTP Request URL is required" wird geworfen, wenn URL fehlt
   - **Problem:** Fehler wird nicht im Cache gespeichert → Frontend sieht Node nicht als failed
   - **Lösung:** Fehler-Handling verbessern, damit fehlgeschlagene Nodes im Cache erscheinen

4. **ExecutedEdges für eingehende Edges:**
   - **Problem:** `executedEdges` werden nur für ausgehende Edges gesetzt, nicht für eingehende
   - **Problem:** Merge Node hat mehrere eingehende Edges, aber diese werden nicht getrackt
   - **Lösung:** Auch eingehende Edges tracken (oder anders lösen)

### 🟡 WICHTIG

5. **Cache-Synchronisation:**
   - Memory Cache und Redis könnten nicht synchron sein
   - Lösung: Redis sollte als Source of Truth dienen, Memory Cache als Cache

6. **Parallele Execution Edge-Tracking:**
   - Bei parallelen Branches werden Edges möglicherweise mehrfach gesetzt
   - Lösung: Set verhindert Duplikate, sollte OK sein

7. **Fehler-Handling bei Node-Fehlern:**
   - Wenn ein Node fehlschlägt, wird Exception geworfen → Workflow stoppt
   - Frontend sieht nur bis zum letzten erfolgreichen Node
   - Lösung: Fehler sollten im Cache gespeichert werden, bevor Exception geworfen wird

---

## Empfohlene Fixes

### Fix 1: Finaler Cache-Eintrag mit Status

```javascript
// In inngest-functions.js, nach erfolgreicher Execution:
const cacheData = {
  success: true,
  status: 'completed', // ← HINZUFÜGEN
  workflowId,
  eventId: event.id,
  // ...
};
```

### Fix 2: Webhook-Trigger Pending Cache

```javascript
// In trigger.service.js, triggerByWebhook():
// Nach inngest.send() auch pending Cache erstellen (wie in triggerWorkflow)
```

### Fix 3: HTTP Request Handler Validierung

```javascript
// In http-request.handler.js:
// Validierung sollte früher passieren, bevor Node als "executing" markiert wird
```

### Fix 4: Fehler im Cache speichern

```javascript
// In executor.service.js, catch-Block:
// Vor throw error: Cache-Updater aufrufen mit failed Node
```

### Fix 5: Eingehende Edges tracken

```javascript
// In executor.service.js:
// Auch eingehende Edges zu executedEdges hinzufügen
// Oder: Nur ausgehende Edges tracken (wie aktuell) und Merge Node anders handhaben
```

---

## Flow-Zusammenfassung

```
1. Trigger → triggerWorkflow()
   └─> Inngest Event senden
   └─> Pending Cache erstellen (status: 'pending')

2. Inngest Function → executeFullWorkflowFunction()
   └─> Workflow laden
   └─> Cache-Updater erstellen
   └─> executeWorkflow() aufrufen

3. Executor → executeWorkflow()
   └─> Start-Node finden
   └─> executeNodeRecursive() aufrufen

4. Node Execution → executeNodeRecursive()
   └─> Node ausführen
   └─> Output in Context speichern
   └─> Execution Log aktualisieren
   └─> Cache-Updater aufrufen (incremental)
   └─> Nächste Nodes rekursiv ausführen

5. Cache Update → updateCacheIncremental()
   └─> Memory Cache aktualisieren
   └─> Redis Cache aktualisieren (async)

6. Frontend Polling → FullWorkflowEditor
   └─> Alle 200ms: /api/full-workflows/execution-results?eventId=...
   └─> Status prüfen: pending/running → Nodes updaten, weiterpolling
   └─> Status completed/undefined → Finale Updates, Polling stoppen

7. UI Update → setNodes()
   └─> Nodes basierend auf executionLog aktualisieren
   └─> Status: success/failed basierend auf executionLog
   └─> Outputs aus nodeOutputs setzen
```

---

## Fazit

Der Flow ist grundsätzlich gut strukturiert, aber es gibt einige kritische Probleme:

1. Finaler Cache-Eintrag braucht `status: 'completed'`
2. Webhook-Trigger braucht pending Cache
3. Fehler-Handling muss verbessert werden
4. Eingehende Edges sollten auch getrackt werden

Die meisten Probleme sind leicht zu beheben und betreffen hauptsächlich die Cache-Struktur und das Fehler-Handling.
