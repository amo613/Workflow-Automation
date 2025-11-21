import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';
import { scrape } from '#services/web-scraper.service.js';

/**
 * Execute Web Scraper Node
 * Scrapes data from websites using fetch or Puppeteer
 */
export async function executeWebScraper(data, context) {
  const {
    url,
    extractType = 'text',
    selector,
    attribute,
    searchText,
    waitForSelector,
    screenshot = false,
    stealthMode = false,
    timeout = 30,
    multipleSelectors = [],
  } = data;

  if (!url) {
    throw new Error('URL is required');
  }

  // Resolve template variables
  const resolvedUrl = resolveTemplate(url, context);
  const resolvedSelector = selector ? resolveTemplate(selector, context) : null;
  const resolvedAttribute = attribute
    ? resolveTemplate(attribute, context)
    : null;
  const resolvedSearchText = searchText
    ? resolveTemplate(searchText, context)
    : null;
  const resolvedWaitForSelector = waitForSelector
    ? resolveTemplate(waitForSelector, context)
    : null;

  // Resolve multiple selectors if present
  const resolvedMultipleSelectors = Array.isArray(multipleSelectors)
    ? multipleSelectors.map(sel => ({
        selector: resolveTemplate(sel.selector || '', context),
        extractType: sel.extractType || 'text',
        attribute: sel.attribute
          ? resolveTemplate(sel.attribute, context)
          : null,
      }))
    : [];

  // Validate resolved URL
  if (!resolvedUrl || resolvedUrl.trim() === '') {
    throw new Error('URL is required (resolved to empty string)');
  }

  logger.info('Executing Web Scraper Node', {
    url: resolvedUrl,
    extractType,
    hasSelector: !!resolvedSelector,
    waitForSelector: resolvedWaitForSelector,
    stealthMode,
  });

  try {
    const options = {
      extractType,
      selector: resolvedSelector,
      attribute: resolvedAttribute,
      searchText: resolvedSearchText,
      waitForSelector: resolvedWaitForSelector,
      screenshot,
      stealthMode,
      timeout,
      multipleSelectors: resolvedMultipleSelectors,
    };

    const result = await scrape(resolvedUrl, options);

    logger.info('Web Scraper Node executed successfully', {
      url: resolvedUrl,
      extractType,
      hasData: !!result.data,
      dataType: Array.isArray(result.data) ? 'array' : typeof result.data,
    });

    return result;
  } catch (error) {
    logger.error('Web Scraper Node execution failed', {
      url: resolvedUrl,
      extractType,
      error: error.message,
    });

    // Enhance error message for better user experience
    let userFriendlyMessage = error.message;

    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      userFriendlyMessage = `Domain not found: ${new URL(resolvedUrl).hostname}. Check if the URL is correct.`;
    } else if (error.message.includes('timeout')) {
      userFriendlyMessage = `Timeout: Page took too long to load (${timeout}s). Try increasing the timeout or check if the website is accessible.`;
    } else if (error.message.includes('not found')) {
      userFriendlyMessage = `Selector not found: ${resolvedSelector}. Make sure the selector exists on the page.`;
    }

    const enhancedError = new Error(userFriendlyMessage);
    enhancedError.originalError = error;
    enhancedError.url = resolvedUrl;
    throw enhancedError;
  }
}
