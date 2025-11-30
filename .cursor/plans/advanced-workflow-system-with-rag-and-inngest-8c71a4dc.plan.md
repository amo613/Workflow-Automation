<!-- 8c71a4dc-6f96-4def-a948-fad1fd38c577 f28ca03d-54a9-4426-bc5d-ac9e890bf309 -->

# Advanced Workflow System mit RAG und Inngest

## Phase 1: RAG-Implementierung für Knowledge Base

### 1.1 Vektordatenbank-Entscheidung und Setup

- **pgvector vs Pinecone Evaluierung**:
- pgvector: Einfach (bereits PostgreSQL), kostenlos, gute Performance bei <1M Vektoren
- Pinecone: Serverless, besser bei >1M Vektoren, kostenlos bis 100K
- **Entscheidung**: Start mit pgvector (einfacher, bereits vorhanden), später Pinecone-Migration möglich
- **Datenbank-Schema**:
- `knowledge_base_entries` Tabelle mit `id`, `user_id`, `name`, `text`, `embedding` (vector(1536))
- Migration für pgvector Extension
- Index auf `embedding` mit `ivfflat` oder `hnsw`
- `Erstmal nur pgvector nutzen, später auf pincecone wechseln.`

### 1.2 Embedding-Service

- **Datei**: `src/services/embedding.service.js`
- OpenAI Embeddings API Integration (`text-embedding-3-small` oder `text-embedding-ada-002`)
- Funktionen: `generateEmbedding(text)`, `batchGenerateEmbeddings(texts[])`
- Caching für bereits generierte Embeddings

### 1.3 RAG-Service

- **Datei**: `src/services/rag.service.js`
- Funktionen:
- `storeKnowledgeEntry(userId, name, text)` - Speichert mit Embedding
- `searchKnowledgeBase(userId, query, limit=5)` - Semantic Search
- `updateKnowledgeEntry(id, name, text)` - Aktualisiert mit neuem Embedding
- `deleteKnowledgeEntry(id)` - Löscht Entry
- Verwendet pgvector `<=>` Operator für Cosine Similarity

### 1.4 API-Routes

- **Datei**: `src/routes/knowledge-base.routes.js` (Fastify)
- Routes: `POST /api/knowledge-base`, `GET /api/knowledge-base`, `PUT /api/knowledge-base/:id`, `DELETE /api/knowledge-base/:id`, `POST /api/knowledge-base/search`
- Integration in bestehende Knowledge Base Sidebar

### 1.5 Workflow-Compiler-Update

- **Datei**: `src/utils/workflow-compiler.utils.js` & `ui/src/utils/workflow-compiler.js`
- RAG-Integration: Bei Variablen wie `{productName}` wird RAG-Query ausgeführt
- Kontext aus Knowledge Base wird in Prompt eingefügt

## Phase 2: Route-Struktur und UI-Navigation

### 2.1 Choose Workflow Type Page

- **Datei**: `ui/src/pages/ChooseWorkflowType.jsx`
- Route: `/workflows/choose` (neue Landing Page)
- Zwei Optionen:
- "Call Flow" → `/workflows` (bestehend)
- "Full Workflow" → `/fullWorkflows` (neu)
- Design: Karten-Layout mit Icons

### 2.2 App.jsx Updates

- **Datei**: `ui/src/App.jsx`
- Neue Routes:
- `/workflows/choose` → ChooseWorkflowType
- `/fullWorkflows` → FullWorkflowList
- `/fullWorkflows/new` → FullWorkflowEditor
- `/fullWorkflows/edit/:id` → FullWorkflowEditor
- Navigation: "Back to Test Page" bleibt, neue "Choose Workflow Type" Option

### 2.3 WorkflowList Updates

- **Datei**: `ui/src/pages/WorkflowList.jsx`
- Button "Create New Workflow" führt zu `/workflows/choose`
- Filter: Nur Call Flow Workflows anzeigen

## Phase 3: Full Workflow System (Canvas 2)

### 3.1 Datenbank-Modell

- **Datei**: `src/models/full-workflow.model.js`
- Neue Tabelle `full_workflows`:
- `id`, `user_id`, `name`, `description`
- `workflow_json` (JSONB) - ReactFlow Graph
- `type` (enum: 'automation', 'call-workflow')
- `is_active`, `created_at`, `updated_at`
- Migration erstellen

### 3.2 Base Node System (Klassen-basiert)

- **Datei**: `ui/src/components/full-workflow/nodes/BaseNode.jsx`
- Basis-Klasse mit:
- `id`, `type`, `position`, `data`
- `properties` Schema (Zod)
- `execute(context)` Methode (für Backend)
- `render()` Methode (für UI)
- **Datei**: `src/services/full-workflow/node-registry.js`
- Registry für alle Node-Typen (ähnlich wie Job Registry)

### 3.3 Node-Typen (Initial Set)

- **Datei**: `ui/src/components/full-workflow/nodes/`
- **Webhook Node** (`WebhookNode.jsx`):
- Properties: `url`, `method`, `headers`, `body_template`
- Output: JSON Response
- **HTTP Request Node** (`HttpRequestNode.jsx`):
- Properties: `url`, `method`, `headers`, `body`, `query_params`
- Output: JSON Response
- **Call Agent Node** (`CallAgentNode.jsx`):
- Properties: `workflow_id` (Dropdown: Call Flow Workflows), `voice`, `model`
- Oder: `prompt` (Text-Editor wie Canvas 1)
- Output: Call Result (transcript, variables)
- **Variable Set Node** (`VariableSetNode.jsx`):
- Properties: `variable_name`, `value` (Template mit `{{previous.output}}`)
- Output: Set Variable
- **If Node** (`IfNode.jsx` - erweitert):
- Properties: `condition` (Template), `operator` (==, !=, >, <, contains)
- Output: `true` oder `false` Branch
- **Wait Node** (`WaitNode.jsx`):
- Properties: `duration` (seconds)
- Output: Continue after delay
- **Database Query Node** (`DatabaseQueryNode.jsx`):
- Properties: `query` (SQL), `parameters` (Template)
- Output: Query Result
- **Google Sheets Node** (`GoogleSheetsNode.jsx`):
- Properties: `spreadsheet_id`, `range`, `values` (Template)
- Output: Success/Failure
- **Knowledge Base Query Node** (`KnowledgeBaseQueryNode.jsx`):
- Properties: `query` (Template), `limit`
- Output: RAG Results

### 3.4 Full Workflow Editor

- **Datei**: `ui/src/pages/FullWorkflowEditor.jsx`
- ReactFlow-basiert (wie WorkflowEditor, aber andere Nodes)
- Node-Sidebar für jede Node-Type
- Variable-Autocomplete (aus vorherigen Node-Outputs)
- Design: n8n-ähnlich (andere Farben, größere Nodes)
- Canvas-Styling: Grid-Hintergrund statt Dots

### 3.5 Full Workflow List

- **Datei**: `ui/src/pages/FullWorkflowList.jsx`
- Liste aller Full Workflows
- Filter nach Type (automation, call-workflow)
- Create/Edit/Delete/Activate

## Phase 4: Inngest-Integration

### 4.1 Inngest Setup

- **Package**: `npm install inngest`
- **Datei**: `src/config/inngest.js`
- Inngest Client initialisieren
- **Datei**: `src/routes/inngest.routes.js` (Fastify)
- Route: `POST /api/inngest` (Webhook für Inngest Events)

### 4.2 Workflow Execution Engine

- **Datei**: `src/services/full-workflow/executor.service.js`
- Konvertiert ReactFlow Graph zu Inngest Function
- Node-Execution: Jeder Node wird zu `step.run()` in Inngest
- Variable-Propagation zwischen Nodes
- Error-Handling und Retries

### 4.3 Inngest Functions

- **Datei**: `src/services/full-workflow/inngest-functions.js`
- Funktion: `executeFullWorkflow(event)`
- Lädt Workflow aus DB
- Führt Nodes sequenziell aus (basierend auf Edges)
- Speichert Execution-Status in DB

### 4.4 Node Execution Handlers

- **Datei**: `src/services/full-workflow/node-handlers/`
- Handler für jeden Node-Type:
- `webhook.handler.js` - Webhook auslösen
- `http-request.handler.js` - HTTP Request
- `call-agent.handler.js` - Ruft BullMQ Job für Call auf
- `variable-set.handler.js` - Setzt Variable im Context
- `if.handler.js` - Conditional Logic
- `wait.handler.js` - Delay
- `database-query.handler.js` - SQL Query
- `google-sheets.handler.js` - Google Sheets API
- `knowledge-base-query.handler.js` - RAG Query

### 4.5 Workflow Trigger

- **Datei**: `src/services/full-workflow/trigger.service.js`
- Funktionen:
- `triggerWorkflow(workflowId, eventData)` - Startet Inngest Function
- `triggerByWebhook(webhookId, payload)` - Webhook-Trigger
- `triggerBySchedule(workflowId, cron)` - Scheduled Trigger

## Phase 5: Backend-Services und API

### 5.1 Full Workflow Service

- **Datei**: `src/services/full-workflow.service.js`
- CRUD-Operationen für Full Workflows
- `createFullWorkflow(userId, data)`
- `getFullWorkflow(id, userId)`
- `updateFullWorkflow(id, userId, data)`
- `deleteFullWorkflow(id, userId)`
- `getAllFullWorkflows(userId)`

### 5.2 Full Workflow Controller

- **Datei**: `src/controllers/full-workflow.controller.js`
- Fastify-Controller für Full Workflows
- Routes: GET, POST, PUT, DELETE `/api/full-workflows`

### 5.3 Full Workflow Routes

- **Datei**: `src/routes/full-workflow.routes.js`
- Fastify-Routes mit Auth, Caching, Timing
- Integration in `fastify-app.js`

### 5.4 Webhook Endpoint

- **Datei**: `src/routes/webhook.routes.js`
- Route: `POST /api/webhooks/:webhookId`
- Validiert Webhook, triggert Full Workflow

## Phase 6: Variable System und Context

### 6.1 Variable Context

- **Datei**: `src/services/full-workflow/variable-context.service.js`
- Verwaltet Variablen während Workflow-Execution
- Funktionen:
- `setVariable(name, value)`
- `getVariable(name)`
- `resolveTemplate(template, context)` - Ersetzt `{{variable}}`

### 6.2 Template Engine

- **Datei**: `src/utils/template-engine.js`
- Funktion: `resolveTemplate(template, context)`
- Unterstützt: `{{node.output.field}}`, `{{variable}}`, `{{workflow.input.field}}`
- Nested Access: `{{previous.data.user.name}}`

### 6.3 UI Variable Autocomplete

- **Datei**: `ui/src/components/full-workflow/VariableAutocomplete.jsx`
- Zeigt verfügbare Variablen aus vorherigen Nodes
- Autocomplete beim Tippen von `{{`

## Phase 7: Integration und Testing

### 7.1 Call Agent Node Integration

- Verbindet Canvas 1 (Call Flow) mit Canvas 2 (Full Workflow)
- Option 1: `workflow_id` - Lädt Call Flow Workflow, kompiliert zu Prompt
- Option 2: `prompt` - Direkter Prompt-Editor
- Ruft Twilio-OpenAI Proxy auf (bestehender Service)
- Output: Call Transcript, Extracted Variables

### 7.2 Google Sheets Integration

- **Datei**: `src/services/google-sheets.service.js`
- Verwendet bestehende `googleapis` Library
- OAuth-Flow für Sheets-Zugriff
- Funktionen: `appendRow()`, `updateRow()`, `readRange()`

### 7.3 Database Query Node

- **Datei**: `src/services/full-workflow/database-query.service.js`
- Parameterized Queries (SQL Injection Prevention)
- Template-Variablen in Query-Parameters
- Output: Query Results als JSON

### 7.4 Error Handling und Logging

- Execution-Logs in DB
- Error-Tracking pro Node
- Retry-Logik in Inngest
- User-Notifications bei Fehlern

## Phase 8: UI/UX Verbesserungen

### 8.1 Node Styling

- n8n-ähnliches Design
- Farben pro Node-Type
- Icons für jeden Node-Type
- Hover-Effekte und Animationen

### 8.2 Canvas Improvements

- Grid-Hintergrund (nicht Dots)
- Zoom und Pan optimiert
- MiniMap für große Workflows
- Node-Gruppierung (später)

### 8.3 Execution View

- **Datei**: `ui/src/pages/FullWorkflowExecution.jsx`
- Live-View während Execution
- Node-Status (pending, running, completed, failed)
- Variable-Values anzeigen
- Execution-Logs

## Technische Entscheidungen

### RAG: pgvector

- **Grund**: Einfach (bereits PostgreSQL), kostenlos, gute Performance
- **Migration zu Pinecone**: Später möglich bei >1M Vektoren

### Orchestrator: Hybrid

- **BullMQ**: Einfache Jobs (Calls, Emails, etc.)
- **Inngest**: Komplexe Workflows (Canvas 2)
- **Grund**: Beste Performance und Kontrolle

### Node-System: Klassen-basiert

- **Grund**: Erweiterbar für neue APIs (Facebook, WhatsApp, etc.)
- Registry-Pattern (wie Job Registry)
- Properties Schema (Zod) für Validation

### Route-Struktur

- `/workflows` - Call Flows (bestehend)
- `/fullWorkflows` - Full Workflows (neu)
- `/workflows/choose` - Type Selection

## Dateien die erstellt/geändert werden

### Backend

- `src/models/full-workflow.model.js` (neu)
- `src/models/knowledge-base.model.js` (neu)
- `src/services/embedding.service.js` (neu)
- `src/services/rag.service.js` (neu)
- `src/services/full-workflow.service.js` (neu)
- `src/services/full-workflow/executor.service.js` (neu)
- `src/services/full-workflow/inngest-functions.js` (neu)
- `src/services/full-workflow/variable-context.service.js` (neu)
- `src/services/full-workflow/node-handlers/*.js` (neu, mehrere)
- `src/services/google-sheets.service.js` (neu)
- `src/controllers/full-workflow.controller.js` (neu)
- `src/routes/full-workflow.routes.js` (neu)
- `src/routes/knowledge-base.routes.js` (neu)
- `src/routes/webhook.routes.js` (neu)
- `src/routes/inngest.routes.js` (neu)
- `src/config/inngest.js` (neu)
- `src/utils/template-engine.js` (neu)
- `src/utils/workflow-compiler.utils.js` (Update für RAG)
- `src/fastify-app.js` (Update für neue Routes)
- `drizzle/XXXX_*.sql` (Migrationen)

### Frontend

- `ui/src/pages/ChooseWorkflowType.jsx` (neu)
- `ui/src/pages/FullWorkflowList.jsx` (neu)
- `ui/src/pages/FullWorkflowEditor.jsx` (neu)
- `ui/src/pages/FullWorkflowExecution.jsx` (neu)
- `ui/src/components/full-workflow/BaseNode.jsx` (neu)
- `ui/src/components/full-workflow/nodes/*.jsx` (neu, mehrere)
- `ui/src/components/full-workflow/VariableAutocomplete.jsx` (neu)
- `ui/src/components/full-workflow/NodeSidebar.jsx` (neu)
- `ui/src/utils/full-workflow-compiler.js` (neu)
- `ui/src/App.jsx` (Update für neue Routes)
- `ui/src/pages/WorkflowList.jsx` (Update)

## Abhängigkeiten

### Neue npm Packages

- `inngest` - Inngest SDK
- `@pinecone-database/pinecone` - Optional für später
- `pgvector` - PostgreSQL Extension (Server-seitig)
- `openai` - Für Embeddings (falls noch nicht vorhanden)

### Database Extensions

- `pgvector` Extension in PostgreSQL aktivieren
