/**
 * Schedule Trigger Node Configuration
 */
import FormField from '../FormField.jsx';
import { useMemo } from 'react';

export default function ScheduleTriggerConfig({ localData, handleUpdate }) {
  // Determine mode based on current localData
  const useCustomCron = useMemo(() => {
    return !!localData.cronExpression && !localData.preset;
  }, [localData.cronExpression, localData.preset]);

  const presets = [
    'Every minute',
    'Every 5 minutes',
    'Every 15 minutes',
    'Every 30 minutes',
    'Every hour',
    'Every day at midnight',
    'Every day at noon',
    'Every Monday',
    'Every week on Monday',
    'Every month on 1st',
  ];

  const handlePresetChange = e => {
    const value = e.target.value;
    if (value) {
      // Update both fields - preset gets the value, cronExpression gets cleared
      handleUpdate('preset', value);
      handleUpdate('cronExpression', null);
    } else {
      // If empty value selected, clear preset
      handleUpdate('preset', null);
    }
  };

  const handleCronExpressionChange = e => {
    const value = e.target.value || '';
    handleUpdate('cronExpression', value);
    if (value) {
      // Clear preset when custom cron is entered
      handleUpdate('preset', null);
    }
  };

  const handleModeChange = useCustom => {
    if (useCustom) {
      // Switch to custom cron
      handleUpdate('preset', null);
      if (!localData.cronExpression) {
        handleUpdate('cronExpression', '0 * * * *'); // Default: every hour
      }
    } else {
      // Switch to preset
      handleUpdate('cronExpression', null);
      if (!localData.preset) {
        handleUpdate('preset', 'Every hour');
      }
    }
  };

  return (
    <>
      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: 'hsl(var(--muted))',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            color: 'white',
            marginBottom: '0.75rem',
            fontWeight: 600,
          }}
        >
          Schedule Mode
        </div>
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <button
            type="button"
            onClick={() => handleModeChange(false)}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '6px',
              border: `2px solid ${!useCustomCron ? '#8b5cf6' : '#333'}`,
              background: !useCustomCron ? '#8b5cf640' : 'transparent',
              color: !useCustomCron ? '#8b5cf6' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            Preset
          </button>
          <button
            type="button"
            onClick={() => handleModeChange(true)}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '6px',
              border: `2px solid ${useCustomCron ? '#8b5cf6' : '#333'}`,
              background: useCustomCron ? '#8b5cf640' : 'transparent',
              color: useCustomCron ? '#8b5cf6' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            Custom Cron
          </button>
        </div>

        {!useCustomCron ? (
          <div>
            <label
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginBottom: '0.5rem',
                display: 'block',
              }}
            >
              Preset Schedule
            </label>
            <select
              value={localData.preset || ''}
              onChange={handlePresetChange}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #333',
                background: '#0a0a0a',
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <option value="">Select a preset...</option>
              {presets.map(preset => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginBottom: '0.5rem',
                display: 'block',
              }}
            >
              Cron Expression
            </label>
            <input
              type="text"
              value={localData.cronExpression || ''}
              onChange={handleCronExpressionChange}
              placeholder="0 * * * *"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #333',
                background: '#0a0a0a',
                color: 'white',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                cursor: 'text',
              }}
            />
            <div
              style={{
                fontSize: '0.7rem',
                color: '#64748b',
                marginTop: '0.5rem',
              }}
            >
              Format:{' '}
              <code style={{ color: '#8b5cf6' }}>
                minute hour day month weekday
              </code>
              <br />
              Example: <code style={{ color: '#8b5cf6' }}>0 0 * * *</code> =
              Every day at midnight
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: 'hsl(var(--muted))',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            color: 'white',
            marginBottom: '0.5rem',
            fontWeight: 600,
          }}
        >
          How it works:
        </div>
        <ul
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            margin: 0,
            paddingLeft: '1.25rem',
            lineHeight: '1.6',
          }}
        >
          <li>Workflow triggers automatically based on the schedule</li>
          <li>Use presets for common schedules or custom cron for advanced</li>
          <li>
            Schedule metadata is available in{' '}
            <code
              style={{
                background: '#2a2a2a',
                padding: '0.1rem 0.3rem',
                borderRadius: '3px',
              }}
            >
              _schedule
            </code>
          </li>
          <li>Trigger data includes timestamp and schedule info</li>
        </ul>
      </div>

      <FormField
        label="Description (optional)"
        name="description"
        value={localData.description || ''}
        onChange={value => handleUpdate('description', value)}
        placeholder="Describe what this schedule is used for"
        multiline
      />
    </>
  );
}
