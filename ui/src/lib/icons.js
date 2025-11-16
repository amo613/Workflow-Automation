/**
 * Icon mapping for common UI elements
 * Centralized icon exports from lucide-react
 */

import {
  // Navigation & Actions
  BookOpen,
  History,
  Settings,
  Save,
  Play,
  PlayCircle,
  Trash2,
  X,
  Edit,
  Pencil,
  Plus,
  PlusCircle,
  Download,
  Upload,
  FileDown,
  FileUp,
  Check,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  
  // Workflow & Nodes
  Workflow,
  GitBranch,
  Network,
  Layers,
  Box,
  
  // Data & Knowledge
  Database,
  Book,
  FileText,
  FileJson,
  Folder,
  FolderOpen,
  
  // Communication
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  Video,
  
  // Status & Indicators
  Clock,
  Calendar,
  Zap,
  TrendingUp,
  BarChart3,
  Activity,
  Circle,
  Dot,
  
  // Google Services
  Sheet,
  Table,
  
  // Web & HTTP
  Globe,
  Link,
  Webhook,
  
  // AI & Automation
  Bot,
  Sparkles,
  Brain,
  Cpu,
  
  // UI Elements
  Menu,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  MoreHorizontal,
  Search,
  Filter,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Key,
  User,
  Users,
  LogOut,
  LogIn,
  UserPlus,
  
  // Status
  CheckCircle2,
  XCircle as XCircleIcon,
  AlertTriangle,
  Loader2,
  RefreshCw,
  
  // Other
  Copy,
  Clipboard,
  ExternalLink,
  Home,
  HelpCircle,
} from 'lucide-react';

/**
 * Icon mapping object for easy lookup
 */
export const iconMap = {
  // Version History
  versionHistory: BookOpen,
  history: History,
  
  // Actions
  save: Save,
  execute: Play,
  play: PlayCircle,
  delete: Trash2,
  close: X,
  edit: Edit,
  pencil: Pencil,
  add: Plus,
  addCircle: PlusCircle,
  
  // Import/Export
  export: Download,
  import: Upload,
  download: FileDown,
  upload: FileUp,
  
  // Status
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  loading: Loader2,
  
  // Workflow
  workflow: Workflow,
  node: Box,
  branch: GitBranch,
  
  // Knowledge Base
  knowledgeBase: Database,
  book: Book,
  
  // Statistics & Performance
  statistics: BarChart3,
  performance: Zap,
  activity: Activity,
  trending: TrendingUp,
  
  // Time
  clock: Clock,
  calendar: Calendar,
  
  // Google Sheets
  sheets: Sheet,
  table: Table,
  
  // HTTP & Web
  http: Globe,
  webhook: Webhook,
  link: Link,
  
  // AI
  ai: Bot,
  sparkles: Sparkles,
  brain: Brain,
  
  // UI
  menu: Menu,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronLeft: ChevronLeft,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  search: Search,
  filter: Filter,
  eye: Eye,
  eyeOff: EyeOff,
  
  // Auth
  login: LogIn,
  logout: LogOut,
  register: UserPlus,
  user: User,
  users: Users,
  
  // Communication
  email: Mail,
  message: MessageSquare,
  phone: Phone,
  call: PhoneCall,
  
  // Other
  copy: Copy,
  clipboard: Clipboard,
  externalLink: ExternalLink,
  home: Home,
  help: HelpCircle,
  settings: Settings,
  restore: RefreshCw,
};

/**
 * Get icon component by name
 */
export function getIcon(name) {
  return iconMap[name] || HelpCircle;
}

/**
 * Common icon sizes
 */
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

// Export all icons for direct use
export {
  BookOpen,
  History,
  Settings,
  Save,
  Play,
  PlayCircle,
  Trash2,
  X,
  Edit,
  Pencil,
  Plus,
  PlusCircle,
  Download,
  Upload,
  FileDown,
  FileUp,
  Check,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Workflow,
  GitBranch,
  Network,
  Layers,
  Box,
  Database,
  Book,
  FileText,
  FileJson,
  Folder,
  FolderOpen,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  Video,
  Clock,
  Calendar,
  Zap,
  TrendingUp,
  BarChart3,
  Activity,
  Circle,
  Dot,
  Sheet,
  Table,
  Globe,
  Link,
  Webhook,
  Bot,
  Sparkles,
  Brain,
  Cpu,
  Menu,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  MoreHorizontal,
  Search,
  Filter,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Key,
  User,
  Users,
  LogOut,
  LogIn,
  UserPlus,
  CheckCircle2,
  XCircleIcon,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Copy,
  Clipboard,
  ExternalLink,
  Home,
  HelpCircle,
};

