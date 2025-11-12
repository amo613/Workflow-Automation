import FormField from '../FormField.jsx';
import VariableAutocomplete from '../../VariableAutocomplete.jsx';
import { useState, useEffect } from 'react';

/**
 * AI Agent Node Configuration
 */
export default function AiAgentConfig({
  localData,
  handleUpdate,
  availableVariables,
}) {
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setModelsLoading(true);
        const response = await fetch('/api/ai-agent/models', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setModels(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, []);

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          Prompt <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <VariableAutocomplete
          value={localData.prompt || ''}
          onChange={e => handleUpdate('prompt', e.target.value)}
          availableVariables={availableVariables}
          placeholder="Enter your prompt..."
          multiline
          rows={6}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          System Prompt (Optional)
        </label>
        <VariableAutocomplete
          value={localData.systemPrompt || ''}
          onChange={e => handleUpdate('systemPrompt', e.target.value)}
          availableVariables={availableVariables}
          placeholder="Enter system prompt (optional)..."
          multiline
          rows={4}
        />
      </div>

      <FormField
        label="Model"
        name="model"
        type="select"
        value={localData.model || 'gpt-4o'}
        onChange={value => handleUpdate('model', value)}
        options={
          modelsLoading
            ? [{ value: 'gpt-4o', label: 'Loading...' }]
            : models.length > 0
              ? [
                  { value: '', label: 'Select a model...' },
                  ...models.map(m => ({
                    value: m.id,
                    label: `${m.name}${m.description ? ` - ${m.description}` : ''}`,
                  })),
                ]
              : [
                  { value: 'gpt-4o', label: 'GPT-4o' },
                  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
                  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                  { value: 'o1-mini', label: 'O1 Mini' },
                ]
        }
      />
    </>
  );
}
