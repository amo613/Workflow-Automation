# Icon Migration Guide

## Emoji → Lucide React Icon Mappings

### Common Actions

- 📚 → `BookOpen` (Version History, Knowledge Base)
- 📊 → `BarChart3` (Statistics)
- ⚡ → `Zap` (Performance)
- 🕒 → `Clock` (Time, Timestamps)
- 💬 → `MessageSquare` (Messages, Comments)
- ↩️ → `RefreshCw` (Restore, Refresh)
- ⏳ → `Loader2` (Loading, with animate-spin)
- ▶️ → `Play` (Execute, Run)
- 🗑️ → `Trash2` (Delete)
- ✕ / × → `X` (Close)
- 🚀 → `Rocket` (Start)
- ✨ → `Sparkles` (Step, Magic)
- 🔀 → `GitBranch` (If, Branch)
- 🏁 → `Flag` (End)
- 💾 → `Save` (Save)
- 📄 → `FileText` (Prompt, Document)
- ➕ → `Plus` (Add)
- 🔧 → `Wrench` (Settings, Tools)
- 📝 → `Edit` (Edit)
- 💡 → `Lightbulb` (Tip, Idea)
- ❌ → `XCircle` (Error)
- ✅ → `CheckCircle` (Success)
- 📋 → `Clipboard` (Copy)

### Workflow & Nodes

- Workflow → `Workflow` or `GitBranch`
- Node → `Box` or `Layers`
- Knowledge Base → `Database` or `Book`
- Google Sheets → `Sheet` or `Table`
- HTTP Request → `Globe` or `Link`
- Webhook → `Webhook`
- Email → `Mail`
- Phone → `Phone` or `PhoneCall`
- AI Agent → `Bot` or `Brain`

### Navigation & UI

- Menu → `Menu`
- Search → `Search`
- Filter → `Filter`
- Settings → `Settings` or `Cog`
- User → `User`
- Logout → `LogOut`
- Login → `LogIn`
- Register → `UserPlus`

### Import/Export

- Export → `Download` or `FileDown`
- Import → `Upload` or `FileUp`

### Status

- Success → `CheckCircle2`
- Error → `XCircle` or `AlertCircle`
- Warning → `AlertTriangle`
- Info → `Info`

## Files to Update

### High Priority

1. `ui/src/pages/FullWorkflowEditor.jsx` - Header buttons
2. `ui/src/pages/WorkflowEditor.jsx` - Action buttons
3. `ui/src/pages/FullWorkflowList.jsx` - List actions
4. `ui/src/pages/WorkflowList.jsx` - List actions
5. `ui/src/pages/ChooseWorkflowType.jsx` - Type cards

### Medium Priority

6. `ui/src/components/full-workflow/KnowledgeBaseManager.jsx`
7. `ui/src/components/full-workflow/sidebar/SettingsTab.jsx`
8. `ui/src/components/full-workflow/sidebar/EmailCredentialsManager.jsx`
9. `ui/src/components/full-workflow/NodeSidebar.jsx`
10. `ui/src/components/nodes/*.jsx` - All node components

### Low Priority

11. `ui/src/pages/LoginPage.jsx`
12. `ui/src/pages/RegisterPage.jsx`
13. `ui/src/pages/OpenAITestPage.jsx`
14. All config components in `ui/src/components/full-workflow/sidebar/configs/`
