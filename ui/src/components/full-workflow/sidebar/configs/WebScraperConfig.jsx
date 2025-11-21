import { useState } from 'react';
import FormField from '../FormField.jsx';
import ErrorConfig from './ErrorConfig.jsx';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * Web Scraper Node Configuration
 */
export default function WebScraperConfig({
  localData,
  handleUpdate,
  availableVariables,
  handleDrop,
  nodes = [],
  currentNodeId,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const extractType = localData.extractType || 'text';
  const multipleSelectors = localData.multipleSelectors || [];

  const handleExtractTypeChange = value => {
    handleUpdate('extractType', value);
    // Clear selector-related fields when switching to all-links/all-images/google-maps/google-maps-search
    if (
      value === 'all-links' ||
      value === 'all-images' ||
      value === 'google-maps' ||
      value === 'google-maps-search'
    ) {
      handleUpdate('selector', '');
      handleUpdate('attribute', '');
    }
    // Auto-enable stealth mode for Google Maps
    if (value === 'google-maps' || value === 'google-maps-search') {
      handleUpdate('stealthMode', true);
    }
  };

  const handleMultipleSelectorAdd = () => {
    const newSelectors = [
      ...multipleSelectors,
      { selector: '', extractType: 'text', attribute: '' },
    ];
    handleUpdate('multipleSelectors', newSelectors);
  };

  const handleMultipleSelectorUpdate = (index, field, value) => {
    const newSelectors = [...multipleSelectors];
    newSelectors[index] = { ...newSelectors[index], [field]: value };
    handleUpdate('multipleSelectors', newSelectors);
  };

  const handleMultipleSelectorRemove = index => {
    const newSelectors = multipleSelectors.filter((_, i) => i !== index);
    handleUpdate('multipleSelectors', newSelectors);
  };

  return (
    <>
      <FormField
        label="URL"
        name="url"
        value={localData.url || ''}
        onChange={value => handleUpdate('url', value)}
        placeholder="https://example.com"
        availableVariables={availableVariables}
        onDrop={(e, variableExpression) => {
          const currentValue = localData.url || '';
          const cursorPos = e.target.selectionStart || currentValue.length;
          const newValue =
            currentValue.substring(0, cursorPos) +
            variableExpression +
            currentValue.substring(cursorPos);
          handleUpdate('url', newValue);
        }}
        onDragOver={e => e.preventDefault()}
      />

      <div className="space-y-2">
        <Label>What to Extract?</Label>
        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="text"
              checked={extractType === 'text'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Text from selector</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="html"
              checked={extractType === 'html'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">HTML from selector</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="attribute"
              checked={extractType === 'attribute'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Attribute value</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="all-links"
              checked={extractType === 'all-links'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">All links</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="all-images"
              checked={extractType === 'all-images'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">All images</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="multiple"
              checked={extractType === 'multiple'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Multiple selectors</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="google-maps"
              checked={extractType === 'google-maps'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Google Maps (Place Info)</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="google-maps-search"
              checked={extractType === 'google-maps-search'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Google Maps (Search Results)</span>
          </label>
        </div>
      </div>

      {extractType === 'google-maps' && (
        <div className="space-y-3">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              🗺️ Google Maps Mode
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Automatically extracts comprehensive place information from Google
              Maps URLs.
              <strong className="block mt-2">
                No selector needed - just paste a Google Maps URL!
              </strong>
            </p>

            <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Extracted Data:
              </p>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>Place Name</li>
                <li>Address</li>
                <li>Rating (stars)</li>
                <li>Number of Reviews</li>
                <li>Phone Number</li>
                <li>Website URL</li>
                <li>Category/Type</li>
                <li>Opening Hours</li>
                <li>Coordinates (Lat/Lng)</li>
                <li>Place ID</li>
              </ul>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Example URL:
              </p>
              <code className="text-xs text-blue-700 dark:text-blue-300 break-all">
                https://www.google.com/maps/place/...
              </code>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Stealth mode is automatically enabled for
                Google Maps to bypass bot detection.
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <p className="text-xs text-amber-900 dark:text-amber-100">
              <strong>Output Format:</strong> The extracted data will be
              available as an object in the node output. Access individual
              fields using variables like{' '}
              <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">
                {'{{'}results.data.name{'}}'}
              </code>
              ,{' '}
              <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">
                {'{{'}results.data.rating{'}}'}
              </code>
              , etc.
            </p>
          </div>
        </div>
      )}

      {extractType === 'google-maps-search' && (
        <div className="space-y-3">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              🔍 Google Maps Search Mode
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Extracts a list of search results from Google Maps search URLs.
              <strong className="block mt-2">
                No selector needed - just paste a Google Maps search URL!
              </strong>
            </p>

            <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Extracted Data (per result):
              </p>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>Name</li>
                <li>Address</li>
                <li>Rating</li>
                <li>Number of Reviews</li>
                <li>Category/Type</li>
                <li>Place URL</li>
              </ul>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Example URL:
              </p>
              <code className="text-xs text-blue-700 dark:text-blue-300 break-all">
                https://www.google.com/maps/search/Restaurants/@52.4341989,13.3572527,14z
              </code>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Stealth mode is automatically enabled for
                Google Maps to bypass bot detection.
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <p className="text-xs text-amber-900 dark:text-amber-100">
              <strong>Output Format:</strong> The results will be an array of
              objects. Access individual results using array indexing like{' '}
              <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">
                {'{{'}results.data[0].name{'}}'}
              </code>{' '}
              for the first result.
            </p>
          </div>
        </div>
      )}

      {extractType !== 'all-links' &&
        extractType !== 'all-images' &&
        extractType !== 'multiple' &&
        extractType !== 'google-maps' &&
        extractType !== 'google-maps-search' && (
          <FormField
            label="Selector"
            name="selector"
            value={localData.selector || ''}
            onChange={value => handleUpdate('selector', value)}
            placeholder=".product-title or //h1[@class='title']"
            availableVariables={availableVariables}
            onDrop={(e, variableExpression) => {
              const currentValue = localData.selector || '';
              const cursorPos = e.target.selectionStart || currentValue.length;
              const newValue =
                currentValue.substring(0, cursorPos) +
                variableExpression +
                currentValue.substring(cursorPos);
              handleUpdate('selector', newValue);
            }}
            onDragOver={e => e.preventDefault()}
          />
        )}

      {extractType === 'attribute' && (
        <FormField
          label="Attribute"
          name="attribute"
          value={localData.attribute || ''}
          onChange={value => handleUpdate('attribute', value)}
          placeholder="href, src, data-id, etc."
          availableVariables={availableVariables}
        />
      )}

      {extractType === 'multiple' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Multiple Selectors</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMultipleSelectorAdd}
            >
              Add Selector
            </Button>
          </div>
          {multipleSelectors.map((sel, index) => (
            <div
              key={index}
              className="p-3 border rounded-lg space-y-2 bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <Label className="text-xs">Selector {index + 1}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMultipleSelectorRemove(index)}
                >
                  Remove
                </Button>
              </div>
              <FormField
                label="Selector"
                name={`selector-${index}`}
                value={sel.selector || ''}
                onChange={value =>
                  handleMultipleSelectorUpdate(index, 'selector', value)
                }
                placeholder=".title"
                availableVariables={availableVariables}
              />
              <div className="space-y-1">
                <Label className="text-xs">Extract Type</Label>
                <select
                  value={sel.extractType || 'text'}
                  onChange={e =>
                    handleMultipleSelectorUpdate(
                      index,
                      'extractType',
                      e.target.value
                    )
                  }
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                >
                  <option value="text">Text</option>
                  <option value="html">HTML</option>
                  <option value="attribute">Attribute</option>
                </select>
              </div>
              {sel.extractType === 'attribute' && (
                <FormField
                  label="Attribute"
                  name={`attribute-${index}`}
                  value={sel.attribute || ''}
                  onChange={value =>
                    handleMultipleSelectorUpdate(index, 'attribute', value)
                  }
                  placeholder="href"
                  availableVariables={availableVariables}
                />
              )}
            </div>
          ))}
          {multipleSelectors.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Click "Add Selector" to add selectors to extract
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="space-y-3 pl-6 border-l-2 border-muted">
            <FormField
              label="Wait for Selector (optional)"
              name="waitForSelector"
              value={localData.waitForSelector || ''}
              onChange={value => handleUpdate('waitForSelector', value)}
              placeholder=".dynamic-content"
              availableVariables={availableVariables}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={localData.screenshot || false}
                onChange={e => handleUpdate('screenshot', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Take screenshot</span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={localData.stealthMode || false}
                onChange={e => handleUpdate('stealthMode', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Enable stealth mode (Cloudflare bypass)</span>
            </label>

            <FormField
              label="Timeout (seconds)"
              name="timeout"
              value={localData.timeout || 30}
              onChange={value => handleUpdate('timeout', parseInt(value) || 30)}
              placeholder="30"
            />
          </div>
        )}
      </div>

      <ErrorConfig
        localData={localData}
        handleUpdate={handleUpdate}
        nodes={nodes}
        currentNodeId={currentNodeId}
      />
    </>
  );
}
