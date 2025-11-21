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
    // Clear selector-related fields when switching to modes that don't need selectors
    if (
      value === 'all-links' ||
      value === 'all-images' ||
      value === 'google-maps' ||
      value === 'google-maps-search' ||
      value === 'full-html' ||
      value === 'smart-list'
    ) {
      handleUpdate('selector', '');
      handleUpdate('attribute', '');
      handleUpdate('searchText', '');
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
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="full-html"
              checked={extractType === 'full-html'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Full HTML (Debug/Explore)</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="text-search"
              checked={extractType === 'text-search'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Text Search (Find by content)</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="extractType"
              value="smart-list"
              checked={extractType === 'smart-list'}
              onChange={e => handleExtractTypeChange(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">
              Smart List (Auto-detect repeating items)
            </span>
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

      {extractType === 'full-html' && (
        <div className="space-y-3">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-md">
            <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">
              📄 Full HTML Mode
            </p>
            <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
              Returns the complete HTML source of the page. Useful for debugging
              and exploring the page structure.
              <strong className="block mt-2">
                No selector needed - just paste a URL!
              </strong>
            </p>
            <div className="mt-3 pt-3 border-t border-purple-300 dark:border-purple-700">
              <p className="text-xs text-purple-800 dark:text-purple-200">
                <strong>Note:</strong> This will return the entire HTML
                document. Use this to inspect the page structure and find the
                right selectors for other extraction modes.
              </p>
            </div>
          </div>
        </div>
      )}

      {extractType === 'text-search' && (
        <div className="space-y-3">
          <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
              🔍 Text Search Mode
            </p>
            <p className="text-sm text-green-800 dark:text-green-200 mb-3">
              Search for elements by their text content instead of using CSS
              selectors.
              <strong className="block mt-2">
                Just enter the text you're looking for!
              </strong>
            </p>
            <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
              <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-2">
                Example searches:
              </p>
              <ul className="text-xs text-green-800 dark:text-green-200 space-y-1 list-disc list-inside">
                <li>"Preis" - finds all elements containing "Preis"</li>
                <li>
                  "Call-Center" - finds all elements containing "Call-Center"
                </li>
                <li>"Price" - finds all elements containing "Price"</li>
              </ul>
            </div>
            <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
              <p className="text-xs text-green-800 dark:text-green-200">
                <strong>Output:</strong> Returns all matching elements. If only
                one match is found, returns just the text. Otherwise returns an
                array of matches.
              </p>
            </div>
          </div>

          <FormField
            label="Search Text"
            name="searchText"
            value={localData.searchText || ''}
            onChange={value => handleUpdate('searchText', value)}
            placeholder="e.g., 'Preis', 'Price', 'Call-Center'"
            availableVariables={availableVariables}
            onDrop={(e, variableExpression) => {
              const currentValue = localData.searchText || '';
              const cursorPos = e.target.selectionStart || currentValue.length;
              const newValue =
                currentValue.substring(0, cursorPos) +
                variableExpression +
                currentValue.substring(cursorPos);
              handleUpdate('searchText', newValue);
            }}
            onDragOver={e => e.preventDefault()}
          />
        </div>
      )}

      {extractType === 'smart-list' && (
        <div className="space-y-3">
          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md">
            <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-2">
              🧠 Smart List Mode
            </p>
            <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
              Automatically detects and extracts repeating list items (like
              search results, product listings, etc.).
              <strong className="block mt-2">
                No selector needed - just paste a URL with a list!
              </strong>
            </p>
            <div className="mt-3 pt-3 border-t border-orange-300 dark:border-orange-700">
              <p className="text-xs font-semibold text-orange-900 dark:text-orange-100 mb-2">
                Extracted Data (per item):
              </p>
              <ul className="text-xs text-orange-800 dark:text-orange-200 space-y-1 list-disc list-inside">
                <li>Name (first line of text)</li>
                <li>Full text content</li>
                <li>Links (if any)</li>
                <li>Images (if any)</li>
                <li>Phone numbers (auto-detected)</li>
                <li>Email addresses (auto-detected)</li>
              </ul>
            </div>
            <div className="mt-3 pt-3 border-t border-orange-300 dark:border-orange-700">
              <p className="text-xs text-orange-800 dark:text-orange-200">
                <strong>How it works:</strong> Finds elements that appear
                multiple times with similar structure (like list items, search
                results, etc.) and extracts data from each one.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-orange-300 dark:border-orange-700">
              <p className="text-xs text-orange-800 dark:text-orange-200">
                <strong>Output Format:</strong> Returns an array of objects.
                Access items like{' '}
                <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">
                  {'{{'}results.data[0].name{'}}'}
                </code>{' '}
                for the first item.
              </p>
            </div>
          </div>
        </div>
      )}

      {extractType !== 'all-links' &&
        extractType !== 'all-images' &&
        extractType !== 'multiple' &&
        extractType !== 'google-maps' &&
        extractType !== 'google-maps-search' &&
        extractType !== 'full-html' &&
        extractType !== 'smart-list' &&
        extractType !== 'text-search' && (
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
