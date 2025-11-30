# Error Handling Flow - Aktuelle Analyse

## Übersicht

Diese Datei analysiert den aktuellen Error-Handling-Flow im Workflow-System, um einen Plan für Phase 9 (Error Recovery & Fallback-Pfade) zu erstellen.

---

## Phase 1: Node-Level Error Handling

### Aktueller Flow

**1. Node Execution (`src/services/full-workflow/node-handlers/index.js`)**

- Jeder Node-Handler kann einen Error werfen
- Errors werden nicht abgefangen auf Node-Handler-Ebene
- Errors propagieren direkt nach oben

**2. Executor Error Handling (`src/services/full-workflow/executor.service.js`)**

```javascript
// In executeNodeRecursive():
try {
  nodeOutput = await executeNode(node, templateContext, context);
  // ... success handling
} catch (error) {
  // 1. Error wird in executionLog gepusht
  executionLog.push({
    nodeId,
    type: node.type,
    status: 'failed',
    error: error.message,
    timestamp: new Date().toISOString(),
  });

  // 2. Cache wird mit failed Node aktualisiert
  if (incrementalCacheUpdater) {
    incrementalCacheUpdater({...});
  }

  // 3. Error wird weitergeworfen → Workflow stoppt komplett
  throw error;
}
```

**Aktuelles Verhalten:**

- ✅ Error wird geloggt
- ✅ Error wird in executionLog gespeichert
- ✅ Frontend sieht failed Node (dank incremental cache)
- ❌ Workflow stoppt komplett (keine Recovery)
- ❌ Keine Retry-Logik
- ❌ Keine Fallback-Pfade
- ❌ Keine "Continue on Error" Option

---

## Phase 2: Parallel Execution Error Handling

### Aktueller Flow

**In `executeNodeRecursive()` bei parallelen Branches:**

```javascript
const parallelExecutions = nextNodes.map((nextNode, index) => {
  return executeNodeRecursive(...).catch(error => {
    // Error wird geloggt, aber nicht geworfen
    logger.error('Error in parallel branch execution', {...});

    // Error-Info wird zurückgegeben statt Exception
    return {
      error: true,
      errorMessage: error.message,
      nodeId: nextNode.target,
    };
  });
});

const results = await Promise.all(parallelExecutions);
// Alle Branches werden ausgeführt, auch bei Fehlern
```

**Aktuelles Verhalten:**

- ✅ Parallele Branches stoppen nicht bei Fehler
- ✅ Fehlerhafte Branches geben Error-Info zurück
- ❌ Keine Retry-Logik
- ❌ Keine Fallback-Pfade
- ❌ Merge Node bekommt Error-Info, aber keine Recovery

---

## Phase 3: Workflow-Level Error Handling

### Aktueller Flow

**In `executeWorkflow()` (`src/services/full-workflow/executor.service.js`):**

```javascript
try {
  const executionResult = await executeNodeRecursive(...);
  return {
    success: true,
    executionLog,
    result: executionResult,
    // ...
  };
} catch (error) {
  // Error wird geloggt und weitergeworfen
  logger.error('Error executing workflow', {...});
  throw error; // → Stoppt gesamten Workflow
}
```

**Aktuelles Verhalten:**

- ❌ Workflow stoppt bei erstem Fehler
- ❌ Keine partielle Execution möglich
- ❌ Keine Error-Recovery

---

## Phase 4: Inngest Function Error Handling

### Aktueller Flow

**In `executeFullWorkflowFunction()` (`src/services/full-workflow/inngest-functions.js`):**

```javascript
try {
  result = await step.run('execute-workflow', async () => {
    return await executeWorkflow(...);
  });
  executionSuccess = true;
} catch (error) {
  executionSuccess = false;
  executionError = error;

  // Partial results werden gecacht
  if (result && (result.nodeOutputs || result.executedEdges)) {
    // Cache mit failed status
    memoryCache.set(cacheKey, {
      success: false,
      error: error.message,
      errorStack: error.stack,
      // ...
    });
  }

  throw error; // → Inngest retry logic greift (3 retries)
}
```

**Aktuelles Verhalten:**

- ✅ Partial results werden gecacht
- ✅ Frontend sieht failed Execution
- ✅ Inngest retry logic (3 retries)
- ❌ Retry ist auf Workflow-Level, nicht Node-Level
- ❌ Keine intelligente Retry-Logik (z.B. nur bei bestimmten Errors)

---

## Phase 5: Frontend Error Display

### Aktueller Flow

**In `FullWorkflowEditor.jsx`:**

```javascript
// Nodes werden basierend auf executionLog aktualisiert
if (logEntry.status === 'failed') {
  node.data.status = 'failed';
  // Error-Message wird NICHT angezeigt (nur Status)
}

// Failed Executions werden in History angezeigt
// User kann auf failed Execution klicken → Error wird angezeigt
```

**Aktuelles Verhalten:**

- ✅ Failed Nodes werden rot markiert
- ✅ Failed Executions in History sichtbar
- ✅ Error-Message in Execution History
- ❌ Keine Error-Details direkt am Node
- ❌ Keine Retry-Button am Node
- ❌ Keine "Continue" Option

---

## Identifizierte Probleme

### 🔴 KRITISCH

1. **Workflow stoppt bei erstem Fehler:**
   - Wenn ein Node fehlschlägt, stoppt der gesamte Workflow
   - Keine Möglichkeit, trotz Fehler weiterzumachen
   - Keine "Continue on Error" Option

2. **Keine Retry-Logik:**
   - Fehlerhafte Nodes werden nicht automatisch retried
   - Inngest retry ist auf Workflow-Level (retryt gesamten Workflow)
   - Keine Node-Level Retry-Logik

3. **Keine Fallback-Pfade:**
   - Keine Möglichkeit, bei Fehler zu einem alternativen Node zu springen
   - Keine Error-Handler Nodes

4. **Fehler-Informationen unvollständig:**
   - Frontend sieht nur `status: 'failed'`
   - Error-Message nicht direkt am Node sichtbar
   - Keine Error-Details (Stack, Type, etc.)

### 🟡 WICHTIG

5. **Parallele Branches:**
   - Fehlerhafte Branches geben Error-Info zurück
   - Aber: Merge Node weiß nicht, wie damit umzugehen
   - Keine Recovery-Strategie für fehlerhafte Branches

6. **Error-Typen nicht unterschieden:**
   - Alle Errors werden gleich behandelt
   - Keine Unterscheidung zwischen:
     - Transient Errors (retry sinnvoll)
     - Permanent Errors (retry sinnlos)
     - User Errors (kein retry)
     - System Errors (retry sinnvoll)

---

## Aktuelle Error-Flow-Zusammenfassung

```
1. Node Handler wirft Error
   ↓
2. executeNodeRecursive() fängt Error
   ├─> Error in executionLog pushen
   ├─> Cache mit failed Node aktualisieren
   └─> Error weiterwerfen
   ↓
3. executeWorkflow() fängt Error
   ├─> Error loggen
   └─> Error weiterwerfen → Workflow stoppt
   ↓
4. Inngest Function fängt Error
   ├─> Partial results cachen
   ├─> Statistics tracken
   └─> Error weiterwerfen → Inngest retry (3x)
   ↓
5. Frontend
   ├─> Sieht failed Node (rot)
   ├─> Sieht failed Execution in History
   └─> Keine Recovery-Optionen
```

---

## Was fehlt für Phase 9

### 1. Node-Level Error-Config

- **Continue on Error:** Workflow läuft weiter, Node wird als failed markiert
- **Stop on Error:** Workflow stoppt (aktuelles Verhalten)
- **Retry on Error:** Node wird X-mal retried mit Delay
- **Go to Fallback Node:** Springt zu alternativem Node

### 2. Retry-Logik

- **Retry Count:** Wie oft soll retried werden?
- **Retry Delay:** Delay zwischen Retries (exponential backoff?)
- **Retry Conditions:** Nur bei bestimmten Error-Typen retry?

### 3. Fallback-Pfade

- **Error Handler Node:** Spezieller Node für Error-Handling
- **Fallback Node:** Alternative Node bei Fehler
- **Error Routing:** Basierend auf Error-Type zu unterschiedlichen Nodes

### 4. Error-Details

- **Error-Type:** Transient, Permanent, User, System
- **Error-Message:** Detaillierte Fehlermeldung
- **Error-Stack:** Stack-Trace für Debugging
- **Error-Context:** Welche Inputs haben zum Fehler geführt?

### 5. UI-Features

- **Error-Details am Node:** Tooltip/Modal mit Error-Info
- **Retry-Button:** Manueller Retry am Node
- **Continue-Button:** Workflow trotz Fehler fortsetzen
- **Error-History:** Alle Errors eines Nodes anzeigen

---

## Nächste Schritte

Basierend auf dieser Analyse wird ein detaillierter Implementierungsplan für Phase 9 erstellt.
