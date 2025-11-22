/**
 * NodeConfigFactory
 * Factory component that renders the appropriate config component for each node type
 * This keeps the main NodeSidebarN8N component clean by delegating to specialized configs
 */

// Import all node config components (we'll create these)
import WebhookConfig from './configs/WebhookConfig.jsx';
import HttpRequestConfig from './configs/HttpRequestConfig.jsx';
import CallAgentConfig from './configs/CallAgentConfig.jsx';
import VariableSetConfig from './configs/VariableSetConfig.jsx';
import IfConfig from './configs/IfConfig.jsx';
import WaitConfig from './configs/WaitConfig.jsx';
import DatabaseQueryConfig from './configs/DatabaseQueryConfig.jsx';
import GoogleSheetsConfig from './configs/GoogleSheetsConfig.jsx';
import GoogleSheetsTriggerConfig from './configs/GoogleSheetsTriggerConfig.jsx';
import WebhookTriggerConfig from './configs/WebhookTriggerConfig.jsx';
import KnowledgeBaseQueryConfig from './configs/KnowledgeBaseQueryConfig.jsx';
import AiAgentConfig from './configs/AiAgentConfig.jsx';
import EmailConfig from './configs/EmailConfig.jsx';
import ScheduleTriggerConfig from './configs/ScheduleTriggerConfig.jsx';
import MergeConfig from './configs/MergeConfig.jsx';
import StartConfig from './configs/StartConfig.jsx';
import CallTriggerConfig from './configs/CallTriggerConfig.jsx';
import WebScraperConfig from './configs/WebScraperConfig.jsx';
import HubspotConfig from './configs/HubspotConfig.jsx';
import HubspotTriggerConfig from './configs/HubspotTriggerConfig.jsx';

const configMap = {
  webhook: WebhookConfig,
  'http-request': HttpRequestConfig,
  'call-agent': CallAgentConfig,
  'variable-set': VariableSetConfig,
  if: IfConfig,
  wait: WaitConfig,
  'database-query': DatabaseQueryConfig,
  'google-sheets': GoogleSheetsConfig,
  'google-sheets-trigger': GoogleSheetsTriggerConfig,
  'webhook-trigger': WebhookTriggerConfig,
  'knowledge-base-query': KnowledgeBaseQueryConfig,
  'ai-agent': AiAgentConfig,
  email: EmailConfig,
  'schedule-trigger': ScheduleTriggerConfig,
  merge: MergeConfig,
  start: StartConfig,
  'call-trigger': CallTriggerConfig,
  'web-scraper': WebScraperConfig,
  hubspot: HubspotConfig,
  'hubspot-trigger': HubspotTriggerConfig,
};

export default function NodeConfigFactory({
  nodeType,
  hubspot,
  onHubspotAuth,
  onHubspotDisconnect,
  ...props
}) {
  const ConfigComponent = configMap[nodeType];

  if (!ConfigComponent) {
    return (
      <div style={{ padding: '1rem', color: '#94a3b8' }}>
        No configuration available for node type: {nodeType}
      </div>
    );
  }

  // Pass HubSpot props to HubspotConfig and HubspotTriggerConfig
  const hubspotProps =
    nodeType === 'hubspot' || nodeType === 'hubspot-trigger'
      ? {
          hubspot,
          onHubspotAuth,
          onHubspotDisconnect,
        }
      : {};

  return <ConfigComponent {...props} {...hubspotProps} />;
}
