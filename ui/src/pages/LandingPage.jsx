import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Lazy load LiquidEther (Three.js ist groß)
const LiquidEther = lazy(() => import('@/components/animations/LiquidEther'));
import WebhookTriggerNode from '@/components/full-workflow/nodes/WebhookTriggerNode';
import AiAgentNode from '@/components/full-workflow/nodes/AiAgentNode';
import EmailNode from '@/components/full-workflow/nodes/EmailNode';
import {
  Workflow,
  Zap,
  Sparkles,
  Rocket,
  Github,
  ArrowRight,
  Play,
  Code,
  Database,
  Mail,
  Calendar,
  Phone,
  Webhook,
  Clock,
  GitBranch,
  CheckCircle,
  ChevronDown,
  LogIn,
  Star,
  Users,
  FileCode,
  Settings,
  Globe,
  Layers,
  Cpu,
  Server,
} from 'lucide-react';
import './LandingPage.css';
import reactLogo from '@/lib/assets/React-icon.svg';
import nodejsLogo from '@/lib/assets/nodejs-icon.svg';
import postgresLogo from '@/lib/assets/Postgresql_elephant.svg';
import redisLogo from '@/lib/assets/redis-logo.svg';
import dockerLogo from '@/lib/assets/Docker.svg';
import inngestLogo from '@/lib/assets/Inngest-Logo.png';

// Mini Workflow Demo Component
function WorkflowDemoInner() {
  const initialNodes = [
    {
      id: 'webhook-1',
      type: 'webhook-trigger',
      position: { x: 50, y: 150 },
      data: {
        label: 'Webhook Trigger',
        type: 'webhook-trigger',
        color: '#8b5cf6',
        status: 'idle',
        localData: {},
      },
      selected: false,
    },
    {
      id: 'ai-agent-1',
      type: 'ai-agent',
      position: { x: 350, y: 150 },
      data: {
        label: 'AI Agent',
        type: 'ai-agent',
        color: '#3b82f6',
        status: 'idle',
        localData: {},
      },
      selected: false,
    },
    {
      id: 'email-1',
      type: 'email',
      position: { x: 650, y: 150 },
      data: {
        label: 'Email',
        type: 'email',
        color: '#8b5cf6',
        status: 'idle',
        localData: {},
      },
      selected: false,
    },
  ];

  const initialEdges = [
    {
      id: 'e1-2',
      source: 'webhook-1',
      target: 'ai-agent-1',
      type: 'smoothstep',
      animated: false,
    },
    {
      id: 'e2-3',
      source: 'ai-agent-1',
      target: 'email-1',
      type: 'smoothstep',
      animated: false,
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [currentStep, setCurrentStep] = useState(0);

  const nodeTypes = {
    'webhook-trigger': WebhookTriggerNode,
    'ai-agent': AiAgentNode,
    email: EmailNode,
  };

  // Auto-play animation: simulate workflow execution
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const next = (prev + 1) % 4;

        // Update node statuses based on step
        setNodes(nds =>
          nds.map(node => {
            if (next === 0) {
              // Reset all
              return { ...node, data: { ...node.data, status: 'idle' } };
            } else if (next === 1 && node.id === 'webhook-1') {
              // Webhook running
              return { ...node, data: { ...node.data, status: 'running' } };
            } else if (next === 2 && node.id === 'ai-agent-1') {
              // AI Agent running, webhook done
              return {
                ...node,
                data: {
                  ...node.data,
                  status: node.id === 'webhook-1' ? 'success' : 'running',
                },
              };
            } else if (next === 3 && node.id === 'email-1') {
              // Email running, AI done
              return {
                ...node,
                data: {
                  ...node.data,
                  status: node.id === 'ai-agent-1' ? 'success' : 'running',
                },
              };
            }
            return node;
          })
        );

        // Update edge animation
        setEdges(eds =>
          eds.map(edge => {
            if (next === 1 && edge.id === 'e1-2') {
              return { ...edge, animated: true };
            } else if (next === 2 && edge.id === 'e2-3') {
              return { ...edge, animated: true };
            } else if (next === 0) {
              return { ...edge, animated: false };
            }
            return edge;
          })
        );

        return next;
      });
    }, 2000); // Change step every 2 seconds

    return () => clearInterval(interval);
  }, [setNodes, setEdges]);

  return (
    <div className="workflow-demo-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        preventScrolling={false}
      >
        <Background
          variant="dots"
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={node => {
            const colors = {
              'webhook-trigger': '#8b5cf6',
              'ai-agent': '#3b82f6',
              email: '#8b5cf6',
            };
            return colors[node.type] || '#94a3b8';
          }}
          nodeStrokeWidth={2}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

function WorkflowDemo() {
  return (
    <ReactFlowProvider>
      <WorkflowDemoInner />
    </ReactFlowProvider>
  );
}

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [activeNodeTab, setActiveNodeTab] = useState('triggers');
  const [isHoveringTabs, setIsHoveringTabs] = useState(false);
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const nodeTabIntervalRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-Rotate Logic für Node Tabs
  useEffect(() => {
    if (isHoveringTabs) return; // Pause bei Hover

    const tabs = ['triggers', 'actions', 'control'];
    let currentIndex = tabs.indexOf(activeNodeTab);

    nodeTabIntervalRef.current = setInterval(() => {
      currentIndex = (currentIndex + 1) % tabs.length;
      setActiveNodeTab(tabs[currentIndex]);
    }, 4000); // 4 Sekunden

    return () => {
      if (nodeTabIntervalRef.current) {
        clearInterval(nodeTabIntervalRef.current);
      }
    };
  }, [activeNodeTab, isHoveringTabs]);

  const features = [
    {
      icon: Workflow,
      title: 'Visual Workflow Editor',
      description:
        'Drag-and-drop interface powered by React Flow. Build complex workflows visually.',
      color: '#3b82f6',
    },
    {
      icon: Layers,
      title: '20+ Node Types',
      description:
        'From simple HTTP requests to AI-powered agents. Everything you need.',
      color: '#8b5cf6',
    },
    {
      icon: Play,
      title: 'Real-time Execution',
      description:
        'Watch your workflows run live with animated visualizations and live updates.',
      color: '#10b981',
    },
    {
      icon: Sparkles,
      title: 'AI Integration',
      description:
        'Built-in OpenAI integration for intelligent automation and decision-making.',
      color: '#ec4899',
    },
    {
      icon: Rocket,
      title: 'Production-Ready',
      description:
        'Dockerized, scalable, and battle-tested. Deploy with confidence.',
      color: '#f59e0b',
    },
    {
      icon: Github,
      title: 'Open Source',
      description:
        'Free, open-source, and community-driven. Contribute and customize.',
      color: '#6366f1',
    },
  ];

  const nodeTypes = {
    triggers: [
      { name: 'Webhook Trigger', icon: Webhook, color: '#8b5cf6' },
      { name: 'Schedule Trigger', icon: Clock, color: '#8b5cf6' },
      { name: 'Google Sheets Trigger', icon: FileCode, color: '#34d399' },
      { name: 'HubSpot Trigger', icon: Settings, color: '#f59e0b' },
      { name: 'Call Trigger', icon: Phone, color: '#10b981' },
    ],
    actions: [
      { name: 'HTTP Request', icon: Globe, color: '#3b82f6' },
      { name: 'Database Query', icon: Database, color: '#06b6d4' },
      { name: 'Email', icon: Mail, color: '#8b5cf6' },
      { name: 'AI Agent', icon: Sparkles, color: '#ec4899' },
      { name: 'Call Agent', icon: Phone, color: '#10b981' },
      { name: 'Google Sheets', icon: FileCode, color: '#34d399' },
    ],
    control: [
      { name: 'If', icon: GitBranch, color: '#f59e0b' },
      { name: 'Wait', icon: Clock, color: '#6366f1' },
      { name: 'Merge', icon: GitBranch, color: '#8b5cf6' },
      { name: 'Switch', icon: Settings, color: '#3b82f6' },
    ],
  };

  // Tab-Konfiguration mit Icons
  const tabConfig = [
    {
      key: 'triggers',
      icon: Webhook,
      label: 'Triggers',
      color: '#8b5cf6',
    },
    {
      key: 'actions',
      icon: Globe,
      label: 'Actions',
      color: '#3b82f6',
    },
    {
      key: 'control',
      icon: GitBranch,
      label: 'Control Flow',
      color: '#f59e0b',
    },
  ];

  const useCases = [
    {
      title: 'Sales Automation',
      description: 'Automate lead qualification, follow-ups, and CRM updates.',
      icon: Users,
      color: '#3b82f6',
    },
    {
      title: 'Customer Support',
      description:
        'Handle tickets, send responses, and escalate issues automatically.',
      icon: Mail,
      color: '#10b981',
    },
    {
      title: 'Data Processing',
      description: 'Transform, clean, and process data from multiple sources.',
      icon: Database,
      color: '#8b5cf6',
    },
    {
      title: 'Lead Qualification',
      description: 'Qualify leads with AI-powered phone calls and follow-ups.',
      icon: Phone,
      color: '#ec4899',
    },
    {
      title: 'Appointment Scheduling',
      description:
        'Automatically schedule meetings based on calendar availability.',
      icon: Calendar,
      color: '#f59e0b',
    },
  ];

  const techStack = [
    { name: 'React', logo: reactLogo, type: 'svg' },
    { name: 'Node.js', logo: nodejsLogo, type: 'svg' },
    { name: 'PostgreSQL', logo: postgresLogo, type: 'svg' },
    { name: 'Redis', logo: redisLogo, type: 'svg' },
    { name: 'Docker', logo: dockerLogo, type: 'svg' },
    { name: 'Inngest', logo: inngestLogo, type: 'png' },
  ];

  return (
    <div className="landing-page">
      {/* Animated Background */}
      <div className="landing-background">
        <Suspense fallback={<div className="landing-background-placeholder" />}>
          <LiquidEther
            colors={['#1e1b4b', '#312e81', '#a855f7', '#0ea5e9']}
            mouseForce={20}
            cursorSize={120}
            resolution={0.5}
            autoDemo
            autoSpeed={0.35}
            autoIntensity={2}
            takeoverDuration={0.3}
            autoResumeDelay={2500}
            autoRampDuration={0.6}
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
        <div className="landing-background-overlay" />
      </div>

      {/* Hero Section */}
      <section ref={heroRef} className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles className="w-4 h-4" />
            <span>Open Source Automation Platform</span>
          </div>
          <h1 className="hero-headline">
            <span className="glitch-text" data-text="Build Powerful Workflows">
              Build Powerful Workflows
            </span>
            <br />
            <span className="gradient-text">No Code Required</span>
          </h1>
          <p className="hero-subheadline">
            Connect APIs, automate tasks, and orchestrate complex business
            processes with a visual drag-and-drop interface. Perfect for sales
            automation, customer support, and data processing.
          </p>
          <div className="hero-ctas">
            <Button size="lg" className="cta-primary" asChild>
              <Link to="/register">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="cta-secondary"
              asChild
            >
              <Link to="/login">
                <LogIn className="w-5 h-5 mr-2" />
                Login
              </Link>
            </Button>
            <Button size="lg" variant="ghost" className="cta-github" asChild>
              <a
                href="https://github.com/amo613/Workflow-Automation"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-5 h-5 mr-2" />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
        <div className="scroll-indicator">
          <ChevronDown className="w-6 h-6 animate-bounce" />
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="features-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-description">
              Everything you need to build and automate complex workflows
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="feature-card"
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <CardContent className="feature-card-content">
                    <div
                      className="feature-icon"
                      style={{ '--feature-color': feature.color }}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="feature-title">{feature.title}</h3>
                    <p className="feature-description">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="demo-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">See It In Action</h2>
            <p className="section-description">
              Visual workflow editor with real-time execution tracking
            </p>
          </div>
          <div className="demo-container">
            <Card className="demo-card">
              <CardContent className="demo-content">
                <WorkflowDemo />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="tech-stack-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Built With Modern Tech</h2>
            <p className="section-description">
              Powered by industry-leading technologies
            </p>
          </div>
          <div className="tech-stack-grid">
            {techStack.map((tech, index) => (
              <div key={index} className="tech-item">
                <div className="tech-icon">
                  <img
                    src={tech.logo}
                    alt={tech.name}
                    className={
                      tech.type === 'svg'
                        ? 'tech-logo-svg'
                        : tech.name === 'Inngest'
                          ? 'tech-logo-png tech-logo-no-bg'
                          : 'tech-logo-png'
                    }
                  />
                </div>
                <span className="tech-name">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Node Types Section */}
      <section className="node-types-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">20+ Node Types</h2>
            <p className="section-description">
              Choose from a wide variety of nodes to build your workflows
            </p>
          </div>

          {/* Icon-basierte Tab Navigation */}
          <div
            className="node-tabs-wrapper"
            onMouseEnter={() => setIsHoveringTabs(true)}
            onMouseLeave={() => setIsHoveringTabs(false)}
          >
            <div className="node-tabs-indicators">
              {tabConfig.map(tab => {
                const Icon = tab.icon;
                const isActive = activeNodeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveNodeTab(tab.key)}
                    className={`node-tab-indicator ${isActive ? 'active' : ''}`}
                    aria-label={tab.label}
                    style={{ '--tab-color': tab.color }}
                  >
                    <div className="node-tab-icon-wrapper">
                      <Icon className="node-tab-icon" />
                      <div className="node-tab-ripple" />
                    </div>
                    <div className="node-tab-dot" />
                  </button>
                );
              })}
            </div>

            {/* Tab Content mit Animation */}
            <div className="node-tabs-content-wrapper">
              {Object.entries(nodeTypes).map(([key, nodes]) => {
                const isActive = activeNodeTab === key;
                return (
                  <div
                    key={key}
                    className={`node-tabs-content ${isActive ? 'active' : ''}`}
                  >
                    <div className="node-grid">
                      {nodes.map((node, index) => {
                        const Icon = node.icon;
                        return (
                          <Card
                            key={index}
                            className="node-card"
                            style={{
                              '--animation-delay': `${index * 0.05}s`,
                              '--node-color': node.color,
                            }}
                          >
                            <CardContent className="node-card-content">
                              <div className="node-icon">
                                <Icon className="w-6 h-6" />
                              </div>
                              <span className="node-name">{node.name}</span>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Perfect For</h2>
            <p className="section-description">
              Automate any business process with ease
            </p>
          </div>
          <div className="use-cases-grid">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <Card key={index} className="use-case-card">
                  <CardContent className="use-case-content">
                    <div
                      className="use-case-icon"
                      style={{ '--use-case-color': useCase.color }}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="use-case-title">{useCase.title}</h3>
                    <p className="use-case-description">
                      {useCase.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className="getting-started-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Get Started in Minutes</h2>
            <p className="section-description">
              Clone, install, and start building workflows
            </p>
          </div>
          <div className="steps-container">
            {[
              { step: 1, title: 'Clone Repository', icon: GitBranch },
              { step: 2, title: 'Install Dependencies', icon: Code },
              { step: 3, title: 'Configure Environment', icon: Settings },
              { step: 4, title: 'Start Server', icon: Rocket },
              { step: 5, title: 'Create Workflow', icon: Workflow },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="step-item">
                  <div className="step-number">{item.step}</div>
                  <div className="step-icon">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="step-title">{item.title}</div>
                  {index < 4 && <div className="step-connector" />}
                </div>
              );
            })}
          </div>
          <div className="getting-started-cta">
            <Button size="lg" className="cta-primary" asChild>
              <Link to="/register">
                Get Started Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* GitHub Section */}
      <section className="github-section">
        <div className="section-container">
          <Card className="github-card">
            <CardContent className="github-content">
              <Github className="w-12 h-12 mb-4" />
              <h2 className="github-title">Join the Open Source Community</h2>
              <p className="github-description">
                Star us on GitHub, contribute to the project, or report issues.
                We welcome all contributions!
              </p>
              <div className="github-stats">
                <div className="github-stat">
                  <Star className="w-5 h-5" />
                  <span>Star on GitHub</span>
                </div>
                <div className="github-stat">
                  <Users className="w-5 h-5" />
                  <span>Join Contributors</span>
                </div>
              </div>
              <Button
                size="lg"
                variant="outline"
                className="github-button"
                asChild
              >
                <a
                  href="https://github.com/amo613/Workflow-Automation"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="w-5 h-5 mr-2" />
                  View Repository
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="final-cta-section">
        <div className="section-container">
          <h2 className="final-cta-title">Ready to Automate Your Workflows?</h2>
          <p className="final-cta-description">
            Start building powerful automation workflows today. No credit card
            required.
          </p>
          <div className="final-cta-buttons">
            <Button size="lg" className="cta-primary" asChild>
              <Link to="/register">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="cta-secondary"
              asChild
            >
              <Link to="/login">
                <LogIn className="w-5 h-5 mr-2" />
                Login
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
