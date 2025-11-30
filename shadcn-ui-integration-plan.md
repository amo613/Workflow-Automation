# Shadcn UI Integration Plan - Phase 2

## Übersicht

Integration von Shadcn UI für einheitliches, modernes Design mit dunklem Theme. Alle Pages sollen einheitlich aussehen - schlicht, aber außergewöhnlich, ähnlich wie shadcn.com selbst.

---

## Phase 2.1: Tailwind CSS & Shadcn UI Setup

### Schritt 1: Tailwind CSS Installation (Vorsichtig - keine Konflikte)

**Ziel**: Tailwind CSS installieren ohne bestehende CSS-Styles zu zerstören

#### 1.1 Dependencies installieren

```bash
cd ui
pnpm add tailwindcss @tailwindcss/vite postcss autoprefixer
pnpm add -D @types/node
```

#### 1.2 Tailwind Config erstellen

- **Datei**: `ui/tailwind.config.js` (neu)
- **Strategie**:
  - Nur für Shadcn Components aktivieren
  - Bestehende CSS-Klassen nicht überschreiben
  - `important: true` vermeiden (verursacht Konflikte)
  - Content-Pfade auf Shadcn Components beschränken
  - React Flow Styles explizit ausschließen

#### 1.3 Vite Config anpassen

- **Datei**: `ui/vite.config.js`
- **Änderung**: `@tailwindcss/vite` Plugin hinzufügen
- **Wichtig**: Nach React Plugin, damit React Flow Styles nicht überschrieben werden

#### 1.4 PostCSS Config (falls benötigt)

- **Datei**: `ui/postcss.config.js` (neu, optional)

### Schritt 2: Shadcn UI Initialisierung

#### 2.1 Shadcn CLI ausführen

```bash
cd ui
npx shadcn@latest init
```

**Konfiguration**:

- Style: `new-york` (modern, clean)
- Base color: `neutral` (schlicht, professionell)
- CSS variables: `true` (wie gewünscht)
- Tailwind config: `tailwind.config.js`
- CSS file: `src/index.css`
- Components: `src/components/ui`
- Utils: `src/lib/utils`
- Use alias: `true`
- rsc: `false` (kein React Server Components)

#### 2.2 Path Aliases prüfen

- **Datei**: `ui/vite.config.js`
- **Änderung**: `@/` Alias für `./src/` hinzufügen
- **Datei**: `ui/tsconfig.json` oder `ui/jsconfig.json` (neu)
- **Änderung**: Paths für `@/*` konfigurieren

### Schritt 3: CSS Variables Setup

#### 3.1 Dark Theme als Standard

- **Datei**: `ui/src/index.css`
- **Strategie**:
  - Shadcn CSS Variables hinzufügen
  - Dark Theme als Standard setzen
  - Bestehende React Flow Styles beibehalten
  - Custom Node-Farben in CSS Variables definieren
  - Body-Background auf dunkles Theme ändern

#### 3.2 Node-Farben als CSS Variables

- **Datei**: `ui/src/index.css`
- **Variablen** (aktuelle Farben):
  - `--node-start`: `#10b981` (grün)
  - `--node-end`: `#ef4444` (rot)
  - `--node-ai-agent`: `#3b82f6` (blau)
  - `--node-call-agent`: `#10b981` (grün)
  - `--node-if`: `#f59e0b` (orange)
  - `--node-email`: `#8b5cf6` (lila)
  - `--node-webhook`: `#8b5cf6` (lila)
  - `--node-webhook-trigger`: `#8b5cf6` (lila)
  - `--node-wait`: `#6366f1` (indigo)
  - `--node-variable-set`: `#f59e0b` (orange)
  - `--node-knowledge-base`: `#a78bfa` (lila)
  - `--node-google-sheets`: `#34d399` (türkis)
  - `--node-google-sheets-trigger`: `#34d399` (türkis)
  - `--node-database-query`: `#06b6d4` (cyan)
  - `--node-http-request`: `#3b82f6` (blau)
  - `--node-merge`: `#8b5cf6` (lila)
  - `--node-schedule-trigger`: `#8b5cf6` (lila)

---

## Phase 2.2: Core Components Installation

### Schritt 4: Essentielle Shadcn Components installieren

#### 4.1 Layout & Navigation

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add separator
npx shadcn@latest add sidebar
npx shadcn@latest add navigation-menu
```

#### 4.2 Forms & Inputs

```bash
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add textarea
npx shadcn@latest add select
npx shadcn@latest add checkbox
npx shadcn@latest add switch
npx shadcn@latest add form
```

#### 4.3 Dialogs & Overlays

```bash
npx shadcn@latest add dialog
npx shadcn@latest add alert-dialog
npx shadcn@latest add sheet
npx shadcn@latest add popover
npx shadcn@latest add tooltip
npx shadcn@latest add dropdown-menu
```

#### 4.4 Feedback & Status

```bash
npx shadcn@latest add toast
npx shadcn@latest add alert
npx shadcn@latest add badge
npx shadcn@latest add progress
npx shadcn@latest add skeleton
```

#### 4.5 Data Display

```bash
npx shadcn@latest add table
npx shadcn@latest add tabs
npx shadcn@latest add accordion
npx shadcn@latest add scroll-area
```

---

## Phase 2.3: Design System & Globale Styles

### Schritt 5: Globale Button Styles

#### 5.1 Button Variants definieren

- **Datei**: `ui/src/components/ui/button.tsx` (wird von Shadcn erstellt)
- **Anpassung**:
  - Custom Variants hinzufügen (falls benötigt)
  - Konsistente Größen (sm, md, lg)
  - Einheitliche Spacing

#### 5.2 Globale Button-Klasse

- **Datei**: `ui/src/index.css`
- **Hinzufügen**: `.btn` Klasse als Wrapper für alle Buttons
- **Zweck**: Einheitliches Styling auch für nicht-Shadcn Buttons

### Schritt 6: Layout-Komponenten

#### 6.1 Main Layout Component

- **Datei**: `ui/src/components/layout/MainLayout.jsx` (neu)
- **Features**:
  - Dark Theme Container
  - Navigation Bar (Shadcn Navigation Menu)
  - Sidebar (optional, für Settings)
  - Content Area
  - Footer (optional)

#### 6.2 Page Container

- **Datei**: `ui/src/components/layout/PageContainer.jsx` (neu)
- **Features**:
  - Einheitliches Padding
  - Max-Width für Content
  - Responsive Design

### Schritt 7: Navigation überarbeiten

#### 7.1 App.jsx Navigation

- **Datei**: `ui/src/App.jsx`
- **Änderung**:
  - Navigation mit Shadcn Navigation Menu
  - Dark Theme Styling
  - Konsistente Links

---

## Phase 2.4: Page Migration (Schrittweise)

### Schritt 8: Login & Register Pages

#### 8.1 LoginPage.jsx

- **Komponenten**:
  - Shadcn Card für Container
  - Shadcn Input für Email/Password
  - Shadcn Button für Submit
  - Shadcn Alert für Errors
- **Design**: Zentriert, Card-basiert, dunkles Theme

#### 8.2 RegisterPage.jsx

- **Gleiche Komponenten wie Login**
- **Zusätzlich**: Form Validation mit Shadcn Form

### Schritt 9: Workflow List Pages

#### 9.1 FullWorkflowList.jsx

- **Komponenten**:
  - Shadcn Table für Workflow-Liste
  - Shadcn Button für Actions
  - Shadcn Dialog für Delete Confirmation
  - Shadcn Badge für Status
- **Design**: Clean Table, Dark Theme

#### 9.2 WorkflowList.jsx

- **Gleiche Komponenten wie FullWorkflowList**

### Schritt 10: Workflow Editor Pages

#### 10.1 FullWorkflowEditor.jsx

- **Wichtig**: React Flow Canvas NICHT ändern
- **Komponenten**:
  - Shadcn Sidebar für Node-Konfiguration
  - Shadcn Tabs für verschiedene Settings
  - Shadcn Dialog für Modals
  - Shadcn Input/Select für Form Fields
- **Design**: Canvas bleibt, Sidebar wird Shadcn

#### 10.2 WorkflowEditor.jsx

- **Gleiche Strategie wie FullWorkflowEditor**

### Schritt 11: OpenAI Test Page

#### 11.1 OpenAITestPage.jsx

- **Komponenten**:
  - Shadcn Card für Container
  - Shadcn Button für Actions
  - Shadcn Badge für Status
  - Shadcn Scroll Area für Logs
- **Design**: Card-basiert, Dark Theme

---

## Phase 2.5: Component Migration

### Schritt 12: Sidebar Components

#### 12.1 NodeSidebar.jsx & NodeSidebarN8N.jsx

- **Komponenten**:
  - Shadcn Sheet für Sidebar
  - Shadcn Tabs für verschiedene Tabs
  - Shadcn Form für Inputs
  - Shadcn Button für Actions

#### 12.2 SettingsTab.jsx

- **Komponenten**:
  - Shadcn Form
  - Shadcn Input/Select/Switch
  - Shadcn Button

### Schritt 13: Config Components

#### 13.1 Alle Config Components

- **Dateien**: `ui/src/components/full-workflow/sidebar/configs/*.jsx`
- **Migration**:
  - Shadcn Input statt native Inputs
  - Shadcn Select statt native Selects
  - Shadcn Form für Validation
  - Shadcn Label für Labels

### Schritt 14: Modal Components

#### 14.1 ErrorDetailsModal.jsx

- **Migration**: Shadcn Dialog
- **Komponenten**: Shadcn Alert, Shadcn Scroll Area

#### 14.2 WorkflowImportModal.jsx

- **Migration**: Shadcn Dialog
- **Komponenten**: Shadcn Form, Shadcn Button

---

## Phase 2.6: React Flow Integration (Wichtig!)

### Schritt 15: React Flow Styles beibehalten

#### 15.1 Tailwind Config

- **Datei**: `ui/tailwind.config.js`
- **Wichtig**:
  - React Flow Klassen ausschließen
  - `react-flow__*` Klassen nicht von Tailwind überschreiben lassen
  - Node-Farben als CSS Variables definieren

#### 15.2 CSS Variables für Nodes

- **Datei**: `ui/src/index.css`
- **Hinzufügen**:
  ```css
  :root {
    --node-start: [aktuelle Farbe];
    --node-end: [aktuelle Farbe];
    --node-if: [aktuelle Farbe];
    /* etc. */
  }
  ```

#### 15.3 MiniMap Styles

- **Datei**: `ui/src/index.css`
- **Beibehalten**: Aktuelle MiniMap Styles
- **Node-Farben**: In MiniMap sichtbar lassen

---

## Phase 2.7: Testing & Refinement

### Schritt 16: Testing

#### 16.1 Funktionalität

- Alle Pages funktionieren
- Alle Forms funktionieren
- Navigation funktioniert
- React Flow funktioniert
- Node-Farben sind sichtbar

#### 16.2 Design-Konsistenz

- Alle Pages haben einheitliches Design
- Dark Theme überall
- Buttons sind einheitlich
- Spacing ist konsistent

#### 16.3 Performance

- Keine Performance-Verschlechterung
- Tailwind CSS nicht zu groß
- Build-Zeit akzeptabel

---

## Risiken & Mitigation

### Risiko 1: Tailwind CSS überschreibt React Flow Styles

**Mitigation**:

- Tailwind Config: React Flow Klassen ausschließen
- `important: false` in Tailwind Config
- React Flow Styles mit `!important` (falls nötig)

### Risiko 2: CSS-Konflikte zwischen Tailwind und Custom CSS

**Mitigation**:

- Tailwind nur für Shadcn Components
- Custom CSS für React Flow und spezielle Komponenten
- CSS Variables für gemeinsame Werte

### Risiko 3: Design-Inkonsistenz

**Mitigation**:

- Design System Dokumentation
- Globale Button-Klassen
- Page Container Component
- Konsistente Spacing-Variablen

### Risiko 4: Performance-Verschlechterung

**Mitigation**:

- Tailwind PurgeCSS aktivieren
- Nur benötigte Shadcn Components installieren
- Lazy Loading für große Components

---

## Dateien-Übersicht

### Neu zu erstellen

- `ui/tailwind.config.js`
- `ui/postcss.config.js` (optional)
- `ui/jsconfig.json` oder `ui/tsconfig.json`
- `ui/components.json` (von Shadcn CLI)
- `ui/src/lib/utils.js` (von Shadcn CLI)
- `ui/src/components/ui/*` (von Shadcn CLI)
- `ui/src/components/layout/MainLayout.jsx`
- `ui/src/components/layout/PageContainer.jsx`

### Zu ändern

- `ui/package.json` (Dependencies)
- `ui/vite.config.js` (Tailwind Plugin, Path Alias)
- `ui/src/index.css` (Shadcn Variables, Dark Theme)
- `ui/src/App.jsx` (Navigation)
- Alle Page Components (Migration zu Shadcn)
- Alle Sidebar Components (Migration zu Shadcn)
- Alle Config Components (Migration zu Shadcn)

### Zu behalten (unverändert)

- React Flow Canvas Styles
- Node-Farben (als CSS Variables)
- MiniMap Styles
- Custom Animations (falls gewünscht)

---

## Erfolgskriterien

### Phase 2.1 (Setup)

- ✅ Tailwind CSS installiert ohne Konflikte
- ✅ Shadcn UI initialisiert
- ✅ CSS Variables konfiguriert
- ✅ Dark Theme als Standard

### Phase 2.2 (Components)

- ✅ Alle benötigten Components installiert
- ✅ Components funktionieren
- ✅ Dark Theme angewendet

### Phase 2.3 (Design System)

- ✅ Globale Button Styles
- ✅ Layout Components erstellt
- ✅ Navigation überarbeitet

### Phase 2.4 (Pages)

- ✅ Alle Pages migriert
- ✅ Einheitliches Design
- ✅ Dark Theme überall

### Phase 2.5 (Components)

- ✅ Alle Components migriert
- ✅ Forms funktionieren
- ✅ Modals funktionieren

### Phase 2.6 (React Flow)

- ✅ React Flow funktioniert
- ✅ Node-Farben sichtbar
- ✅ MiniMap funktioniert

### Phase 2.7 (Testing)

- ✅ Alles funktioniert
- ✅ Design konsistent
- ✅ Performance gut

---

## Nächste Schritte

1. **Phase 2.1 starten**: Tailwind CSS & Shadcn Setup
2. **Testing**: Nach jedem Schritt testen
3. **Schrittweise Migration**: Eine Page/Component nach der anderen
4. **Feedback einholen**: Design prüfen und anpassen

---

## Design-Referenzen

- **Shadcn.com**: Hauptreferenz für Design
- **Dark Theme**: Standard, schlicht, professionell
- **Node-Farben**: Beibehalten, dezente Hervorhebung
- **Spacing**: Konsistent, großzügig
- **Typography**: Modern, lesbar
- **Buttons**: Einheitlich, klar definiert
