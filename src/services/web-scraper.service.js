/* eslint-env node */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { parse } from 'node-html-parser';
import logger from '#config/logger.js';

/**
 * Browser Pool for reusing Puppeteer browser instances
 * Improves performance by avoiding browser startup overhead
 */
class BrowserPool {
  constructor() {
    this.browser = null;
    this.activePages = 0;
    this.maxPages = 10;
    this.idleTimeout = 5 * 60 * 1000; // 5 minutes
    this.idleTimer = null;
  }

  async getBrowser(options = {}) {
    if (!this.browser) {
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
        protocolTimeout: 120000, // 2 minutes for protocol operations
      };

      // Use installed Chromium if available (Docker environment)
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }

      // Use stealth plugin if requested
      if (options.stealthMode) {
        puppeteer.use(StealthPlugin());
      }

      this.browser = await puppeteer.launch(launchOptions);
      logger.info('Browser pool: Browser instance created', {
        executablePath: launchOptions.executablePath || 'default',
        protocolTimeout: launchOptions.protocolTimeout,
      });
    }

    this.resetIdleTimer();
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
      logger.info('Browser pool: Browser instance closed');
    }
  }

  resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      if (this.activePages === 0) {
        this.close();
      }
    }, this.idleTimeout);
  }

  incrementActivePages() {
    this.activePages++;
    this.resetIdleTimer();
  }

  decrementActivePages() {
    this.activePages = Math.max(0, this.activePages - 1);
    this.resetIdleTimer();
  }
}

// Singleton instance
const browserPool = new BrowserPool();

/**
 * Check if Puppeteer is needed based on options
 */
function needsPuppeteer(options) {
  return !!(
    options.waitForSelector ||
    options.screenshot ||
    options.stealthMode ||
    options.extractType === 'multiple' ||
    options.extractType === 'full-html' ||
    options.extractType === 'text-search' ||
    options.extractType === 'smart-list'
  );
}

/**
 * Extract data from HTML using node-html-parser
 */
function extractFromHTML(html, options) {
  const root = parse(html);
  const { extractType, selector, attribute, multipleSelectors } = options;

  try {
    switch (extractType) {
      case 'text': {
        if (!selector) {
          throw new Error('Selector is required for text extraction');
        }
        const element = root.querySelector(selector);
        if (!element) {
          throw new Error(`Selector "${selector}" not found`);
        }
        return element.text.trim();
      }

      case 'html': {
        if (!selector) {
          throw new Error('Selector is required for HTML extraction');
        }
        const element = root.querySelector(selector);
        if (!element) {
          throw new Error(`Selector "${selector}" not found`);
        }
        return element.innerHTML;
      }

      case 'attribute': {
        if (!selector || !attribute) {
          throw new Error(
            'Selector and attribute are required for attribute extraction'
          );
        }
        const element = root.querySelector(selector);
        if (!element) {
          throw new Error(`Selector "${selector}" not found`);
        }
        const attrValue = element.getAttribute(attribute);
        if (!attrValue) {
          throw new Error(
            `Attribute "${attribute}" not found on selector "${selector}"`
          );
        }
        return attrValue;
      }

      case 'all-links': {
        const links = root.querySelectorAll('a');
        return links.map(link => ({
          text: link.text.trim(),
          href: link.getAttribute('href') || '',
        }));
      }

      case 'all-images': {
        const images = root.querySelectorAll('img');
        return images.map(img => ({
          src: img.getAttribute('src') || '',
          alt: img.getAttribute('alt') || '',
        }));
      }

      case 'multiple': {
        if (!multipleSelectors || !Array.isArray(multipleSelectors)) {
          throw new Error('Multiple selectors array is required');
        }
        return multipleSelectors.map(sel => {
          const element = root.querySelector(sel.selector);
          if (!element) {
            return {
              selector: sel.selector,
              value: null,
              error: `Selector "${sel.selector}" not found`,
            };
          }

          let value;
          if (sel.extractType === 'text') {
            value = element.text.trim();
          } else if (sel.extractType === 'html') {
            value = element.innerHTML;
          } else if (sel.extractType === 'attribute') {
            value = element.getAttribute(sel.attribute) || null;
          }

          return {
            selector: sel.selector,
            value,
            extractType: sel.extractType,
          };
        });
      }

      case 'full-html': {
        // Return the entire HTML document
        return html;
      }

      case 'text-search': {
        // Search for text content instead of using a selector
        const searchText = options.searchText || selector; // Use selector field as search text if searchText not provided
        if (!searchText) {
          throw new Error('Search text is required for text-search extraction');
        }

        // Find all elements containing the search text
        const allElements = root.querySelectorAll('*');
        const matches = [];

        for (const element of allElements) {
          const text = element.text.trim();
          if (text && text.toLowerCase().includes(searchText.toLowerCase())) {
            matches.push({
              text,
              tag: element.tagName.toLowerCase(),
              html: element.innerHTML,
            });
          }
        }

        // If only one match, return just the text
        if (matches.length === 1) {
          return matches[0].text;
        }

        // Return all matches
        return matches;
      }

      case 'smart-list': {
        // Automatically detect repeating elements (like list items)
        // Strategy: Find elements that appear multiple times with similar structure

        // Get all container elements
        const containers = root.querySelectorAll(
          'div, article, section, li, tr'
        );
        const elementGroups = new Map();

        // Group elements by their class/id pattern
        for (const container of containers) {
          const classes = container.className || '';
          const id = container.id || '';
          const tag = container.tagName.toLowerCase();

          // Create a key based on tag and classes
          const key = `${tag}:${classes.substring(0, 50)}`;

          if (!elementGroups.has(key)) {
            elementGroups.set(key, []);
          }
          elementGroups.get(key).push(container);
        }

        // Find the group with the most elements (likely the list)
        let bestGroup = null;
        let maxCount = 0;

        for (const [key, elements] of elementGroups.entries()) {
          if (elements.length > maxCount && elements.length >= 2) {
            maxCount = elements.length;
            bestGroup = elements;
          }
        }

        if (!bestGroup || bestGroup.length < 2) {
          throw new Error(
            'Could not detect a repeating list pattern. Try using a specific selector instead.'
          );
        }

        // Extract data from each item
        const items = bestGroup.slice(0, 50).map((element, index) => {
          const item = {
            index: index + 1,
            text: element.text.trim(),
            html: element.innerHTML,
          };

          // Try to extract common fields
          const links = element.querySelectorAll('a');
          if (links.length > 0) {
            item.links = Array.from(links).map(link => ({
              text: link.text.trim(),
              href: link.getAttribute('href') || '',
            }));
          }

          const images = element.querySelectorAll('img');
          if (images.length > 0) {
            item.images = Array.from(images).map(img => ({
              src: img.getAttribute('src') || '',
              alt: img.getAttribute('alt') || '',
            }));
          }

          // Try to extract structured data (name, address, phone, etc.)
          const text = element.text.trim();
          const lines = text
            .split('\n')
            .map(l => l.trim())
            .filter(l => l);

          // Common patterns
          if (lines.length > 0) {
            item.name = lines[0];
          }

          // Try to find phone numbers
          const phoneMatch = text.match(/(\+?\d[\d\s\-\(\)]{7,}\d)/);
          if (phoneMatch) {
            item.phone = phoneMatch[1];
          }

          // Try to find email
          const emailMatch = text.match(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
          );
          if (emailMatch) {
            item.email = emailMatch[1];
          }

          return item;
        });

        return items;
      }

      default:
        throw new Error(`Unknown extract type: ${extractType}`);
    }
  } catch (error) {
    logger.error('Error extracting data from HTML', {
      error: error.message,
      extractType,
      selector,
    });
    throw error;
  }
}

/**
 * Scrape with simple fetch (for static HTML pages)
 */
async function scrapeWithFetch(url, options) {
  logger.info('Scraping with fetch', { url, extractType: options.extractType });

  const timeout = (options.timeout || 30) * 1000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
    }

    const html = await response.text();
    const data = extractFromHTML(html, options);

    return {
      success: true,
      data,
      extractType: options.extractType,
      url,
      method: 'fetch',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(
        `Timeout: Page took too long to load (${options.timeout || 30}s)`
      );
    }
    throw error;
  }
}

/**
 * Scrape with Puppeteer (for JavaScript-rendered pages)
 */
async function scrapeWithPuppeteer(url, options) {
  logger.info('Scraping with Puppeteer', {
    url,
    extractType: options.extractType,
    waitForSelector: options.waitForSelector,
    stealthMode: options.stealthMode,
  });

  const browser = await browserPool.getBrowser(options);
  const timeout = (options.timeout || 30) * 1000;

  try {
    // Create page with increased timeout
    const page = await browser.newPage();
    // Set default timeout for page operations
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    browserPool.incrementActivePages();

    try {
      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      // Wait for selector if specified
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: Math.min(timeout, 10000), // Max 10s for wait
        });
      }

      // Take screenshot if requested
      let screenshot = null;
      if (options.screenshot) {
        screenshot = await page.screenshot({ encoding: 'base64' });
      }

      // Extract data based on type
      let data;
      const {
        extractType,
        selector,
        attribute,
        multipleSelectors,
        searchText,
      } = options;

      if (extractType === 'full-html') {
        // Return the entire HTML document
        data = await page.evaluate(() => {
          return document.documentElement.outerHTML;
        });
      } else if (extractType === 'text-search') {
        // Search for text content
        const search = searchText || selector;
        if (!search) {
          throw new Error('Search text is required for text-search extraction');
        }

        data = await page.evaluate(searchText => {
          const allElements = Array.from(document.querySelectorAll('*'));
          const matches = [];

          for (const element of allElements) {
            const text = element.textContent.trim();
            if (text && text.toLowerCase().includes(searchText.toLowerCase())) {
              matches.push({
                text,
                tag: element.tagName.toLowerCase(),
                html: element.innerHTML,
              });
            }
          }

          // If only one match, return just the text
          if (matches.length === 1) {
            return matches[0].text;
          }

          return matches;
        }, search);
      } else if (extractType === 'smart-list') {
        // Automatically detect repeating elements
        data = await page.evaluate(() => {
          const containers = Array.from(
            document.querySelectorAll('div, article, section, li, tr')
          );
          const elementGroups = new Map();

          // Group elements by their class/id pattern
          for (const container of containers) {
            const classes = container.className || '';
            const tag = container.tagName.toLowerCase();

            // Create a key based on tag and classes
            const key = `${tag}:${String(classes).substring(0, 50)}`;

            if (!elementGroups.has(key)) {
              elementGroups.set(key, []);
            }
            elementGroups.get(key).push(container);
          }

          // Find the group with the most elements (likely the list)
          let bestGroup = null;
          let maxCount = 0;

          for (const [key, elements] of elementGroups.entries()) {
            if (elements.length > maxCount && elements.length >= 2) {
              maxCount = elements.length;
              bestGroup = elements;
            }
          }

          if (!bestGroup || bestGroup.length < 2) {
            throw new Error(
              'Could not detect a repeating list pattern. Try using a specific selector instead.'
            );
          }

          // Extract data from each item
          const items = bestGroup.slice(0, 50).map((element, index) => {
            const item = {
              index: index + 1,
              text: element.textContent.trim(),
              html: element.innerHTML,
            };

            // Try to extract common fields
            const links = Array.from(element.querySelectorAll('a'));
            if (links.length > 0) {
              item.links = links.map(link => ({
                text: link.textContent.trim(),
                href: link.href || link.getAttribute('href') || '',
              }));
            }

            const images = Array.from(element.querySelectorAll('img'));
            if (images.length > 0) {
              item.images = images.map(img => ({
                src: img.src || img.getAttribute('src') || '',
                alt: img.alt || img.getAttribute('alt') || '',
              }));
            }

            // Try to extract structured data
            const text = element.textContent.trim();
            const lines = text
              .split('\n')
              .map(l => l.trim())
              .filter(l => l);

            if (lines.length > 0) {
              item.name = lines[0];
            }

            // Try to find phone numbers
            const phoneMatch = text.match(/(\+?\d[\d\s\-\(\)]{7,}\d)/);
            if (phoneMatch) {
              item.phone = phoneMatch[1];
            }

            // Try to find email
            const emailMatch = text.match(
              /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
            );
            if (emailMatch) {
              item.email = emailMatch[1];
            }

            return item;
          });

          return items;
        });
      } else if (extractType === 'all-links') {
        data = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links.map(link => ({
            text: link.textContent.trim(),
            href: link.href || link.getAttribute('href') || '',
          }));
        });
      } else if (extractType === 'all-images') {
        data = await page.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          return images.map(img => ({
            src: img.src || img.getAttribute('src') || '',
            alt: img.alt || img.getAttribute('alt') || '',
          }));
        });
      } else if (extractType === 'multiple') {
        data = await page.evaluate(
          ({ multipleSelectors }) => {
            return multipleSelectors.map(sel => {
              const element = document.querySelector(sel.selector);
              if (!element) {
                return {
                  selector: sel.selector,
                  value: null,
                  error: `Selector "${sel.selector}" not found`,
                };
              }

              let value;
              if (sel.extractType === 'text') {
                value = element.textContent.trim();
              } else if (sel.extractType === 'html') {
                value = element.innerHTML;
              } else if (sel.extractType === 'attribute') {
                value = element.getAttribute(sel.attribute) || null;
              }

              return {
                selector: sel.selector,
                value,
                extractType: sel.extractType,
              };
            });
          },
          { multipleSelectors }
        );
      } else {
        // Single selector extraction
        if (!selector) {
          throw new Error('Selector is required');
        }

        data = await page.evaluate(
          ({ selector, extractType, attribute }) => {
            const element = document.querySelector(selector);
            if (!element) {
              throw new Error(`Selector "${selector}" not found`);
            }

            if (extractType === 'text') {
              return element.textContent.trim();
            } else if (extractType === 'html') {
              return element.innerHTML;
            } else if (extractType === 'attribute') {
              const attrValue = element.getAttribute(attribute);
              if (!attrValue) {
                throw new Error(
                  `Attribute "${attribute}" not found on selector "${selector}"`
                );
              }
              return attrValue;
            }
          },
          { selector, extractType, attribute }
        );
      }

      await page.close();
      browserPool.decrementActivePages();

      const result = {
        success: true,
        data,
        extractType: options.extractType,
        url,
        method: 'puppeteer',
      };

      if (screenshot) {
        result.screenshot = screenshot;
      }

      return result;
    } catch (error) {
      await page.close();
      browserPool.decrementActivePages();
      throw error;
    }
  } catch (error) {
    logger.error('Puppeteer scraping error', {
      url,
      error: error.message,
    });

    if (error.message.includes('timeout')) {
      throw new Error(
        `Timeout: Page took too long to load (${options.timeout || 30}s)`
      );
    }

    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      throw new Error(
        `Domain not found: ${new URL(url).hostname}. Check if the URL is correct.`
      );
    }

    throw error;
  }
}

/**
 * Special handling for Google Maps
 * Extracts comprehensive place information from Google Maps URLs
 */
async function scrapeGoogleMaps(url, options) {
  logger.info('Scraping Google Maps', { url });

  // Google Maps requires Puppeteer with stealth mode
  const browser = await browserPool.getBrowser({ stealthMode: true });
  const timeout = (options.timeout || 90) * 1000; // Longer timeout for Maps (90s default)

  try {
    // Create page with increased timeout
    const page = await browser.newPage();
    // Set default timeout for page operations
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    browserPool.incrementActivePages();

    try {
      // Set a larger viewport for better rendering
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      // Wait for Google Maps to fully load (it's heavily JS-rendered)
      await page.waitForTimeout(3000);

      // Wait for page to load and check if we're on consent page
      await page.waitForTimeout(2000);

      // Check if we're on the consent page
      const currentUrl = page.url();
      const isConsentPage = currentUrl.includes('consent.google.com');

      if (isConsentPage) {
        logger.info('Detected consent page, trying to accept cookies');

        // Try multiple strategies to accept cookies
        const cookieButtonSelectors = [
          // German
          'button:has-text("Alle akzeptieren")',
          'button:has-text("Akzeptieren")',
          'button:has-text("Ich stimme zu")',
          // English
          'button:has-text("Accept all")',
          'button:has-text("I agree")',
          // Aria labels
          'button[aria-label*="Accept"]',
          'button[aria-label*="Akzeptieren"]',
          'button[aria-label*="accept"]',
          // IDs and attributes
          '#L2AGLb', // Google's cookie accept button ID
          'button[data-ved*="cookie"]',
          'button[id*="accept"]',
          // Generic button in consent page
          'form button[type="submit"]',
          'button[type="submit"]',
        ];

        let cookieAccepted = false;
        for (const selector of cookieButtonSelectors) {
          try {
            const button = await page.$(selector);
            if (button) {
              await button.click();
              await page.waitForTimeout(2000);
              logger.info('Cookie banner closed', { selector });
              cookieAccepted = true;
              break;
            }
          } catch {
            // Try next selector
          }
        }

        // If no button found, try to find by text content
        if (!cookieAccepted) {
          try {
            const buttons = await page.$$('button');
            for (const button of buttons) {
              const text = await page.evaluate(el => el.textContent, button);
              if (
                text &&
                (text.includes('Alle akzeptieren') ||
                  text.includes('Accept all') ||
                  text.includes('Akzeptieren') ||
                  text.includes('Accept'))
              ) {
                await button.click();
                await page.waitForTimeout(2000);
                logger.info('Cookie banner closed by text content');
                cookieAccepted = true;
                break;
              }
            }
          } catch (e) {
            logger.warn('Could not find cookie button by text', {
              error: e.message,
            });
          }
        }

        // Wait for navigation to actual Maps page
        try {
          await page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 15000,
          });
          logger.info('Navigated to Google Maps page after consent');
        } catch (e) {
          logger.warn('Navigation timeout after consent, continuing anyway', {
            error: e.message,
          });
        }

        // Double check we're on Maps page now
        const newUrl = page.url();
        if (newUrl.includes('consent.google.com')) {
          logger.warn(
            'Still on consent page after clicking accept, trying direct navigation'
          );
          // Try to extract the continue URL and navigate directly
          try {
            const continueUrl = await page.evaluate(() => {
              const urlParams = new URLSearchParams(window.location.search);
              return urlParams.get('continue');
            });
            if (continueUrl) {
              await page.goto(decodeURIComponent(continueUrl), {
                waitUntil: 'networkidle2',
                timeout: 30000,
              });
              logger.info('Navigated directly to Maps page');
            }
          } catch (e) {
            logger.error('Could not navigate to Maps page', {
              error: e.message,
            });
          }
        }
      }

      // Wait a bit more and verify we're on the actual Maps page
      await page.waitForTimeout(3000);

      // Verify we're on Google Maps, not consent page
      const finalUrl = page.url();
      if (finalUrl.includes('consent.google.com')) {
        throw new Error(
          'Still on consent page after cookie handling. Google Maps may be blocking automated access.'
        );
      }

      logger.info('Confirmed on Google Maps page', { url: finalUrl });

      // Wait for main content to load
      try {
        await page.waitForSelector('div[role="main"]', { timeout: 15000 });
        logger.info('Main content loaded');
      } catch (e) {
        logger.warn('Main content selector not found, continuing anyway', {
          error: e.message,
        });
      }

      await page.waitForTimeout(3000);

      // Scroll down a bit to trigger lazy loading

      await page.evaluate(() => {
        window.scrollTo(0, 300);
      });
      await page.waitForTimeout(1000);

      // Try to click on the place name to open/load sidebar
      try {
        const placeNameSelectors = [
          'button[data-item-id*="title"]',
          'h1[data-attrid="title"]',
          'h1.DUwDvf',
          'h1.fontHeadlineLarge',
        ];

        for (const selector of placeNameSelectors) {
          try {
            const placeNameButton = await page.$(selector);
            if (placeNameButton) {
              await placeNameButton.click();
              logger.info('Clicked on place name to load sidebar', {
                selector,
              });
              await page.waitForTimeout(2000);
              break;
            }
          } catch {
            // Try next selector
          }
        }
      } catch (e) {
        logger.debug('Could not click place name', { error: e.message });
      }

      // Scroll more to load sidebar content
      await page.evaluate(() => {
        window.scrollTo(0, 500);
      });
      await page.waitForTimeout(2000);

      // Wait for specific elements with aria-label (most reliable)
      const waitForSelectors = [
        'button[aria-label*="Address"]',
        'button[aria-label*="Adresse"]',
        '[data-value="Address"]',
        'button[data-item-id*="address"]',
        '.Io6YTe',
      ];

      let foundSelector = false;
      for (const selector of waitForSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          logger.info('Found address-related selector', { selector });
          foundSelector = true;
          break;
        } catch {
          // Continue to next selector
        }
      }

      if (!foundSelector) {
        logger.warn('Could not find address selector, continuing anyway');
      }

      // Extra wait for all content to fully load
      await page.waitForTimeout(3000);

      // Try to extract from JSON-LD schema first (most reliable)

      let placeData = await page.evaluate(() => {
        try {
          const jsonLdScripts = document.querySelectorAll(
            'script[type="application/ld+json"]'
          );
          for (const script of jsonLdScripts) {
            try {
              const json = JSON.parse(script.textContent);
              // Check if it's an array
              const data = Array.isArray(json) ? json[0] : json;

              // Check various business types
              const businessTypes = [
                'Restaurant',
                'LocalBusiness',
                'FoodEstablishment',
                'Store',
                'Organization',
                'Place',
              ];
              if (
                data &&
                (businessTypes.includes(data['@type']) ||
                  data['@type']?.includes('Business'))
              ) {
                const result = {
                  name: data.name || data.alternateName || null,
                  address: null,
                  rating: null,
                  reviews: null,
                  phone: data.telephone || null,
                  website: data.url || null,
                  category: data['@type'] || null,
                  hours: null,
                };

                // Extract address
                if (data.address) {
                  if (typeof data.address === 'string') {
                    result.address = data.address;
                  } else if (data.address.streetAddress) {
                    result.address = [
                      data.address.streetAddress,
                      data.address.addressLocality,
                      data.address.postalCode,
                      data.address.addressCountry,
                    ]
                      .filter(Boolean)
                      .join(', ');
                  }
                }

                // Extract rating
                if (data.aggregateRating) {
                  result.rating =
                    data.aggregateRating.ratingValue?.toString() || null;
                  result.reviews =
                    data.aggregateRating.reviewCount?.toString() || null;
                }

                // Extract hours
                if (data.openingHours) {
                  result.hours = Array.isArray(data.openingHours)
                    ? data.openingHours.join(', ')
                    : data.openingHours;
                }

                return result;
              }
            } catch {
              // Continue to next script
            }
          }
        } catch {
          // Fall back to DOM scraping
        }
        return null;
      });

      // If JSON-LD didn't work, fall back to DOM scraping
      if (
        !placeData ||
        Object.keys(placeData).length === 0 ||
        !placeData.name
      ) {
        logger.info(
          'JSON-LD extraction failed or incomplete, falling back to DOM scraping'
        );

        placeData = await page.evaluate(() => {
          const data = {};

          // Extract place name (multiple selectors for different Maps layouts)
          // Try to find the actual restaurant/place name, not cookie banners
          const nameSelectors = [
            'h1[data-attrid="title"]',
            'h1.DUwDvf',
            'h1.fontHeadlineLarge',
            'h1.qrShPb',
            'h1.DUwDvf.fontHeadlineLarge',
            'h1[class*="fontHeadline"]',
            '[data-value="Name"]',
            '[data-value="name"]',
            '.x3AX1-LfntMc-header-title-title',
            // Try to find h1 that's not in cookie banner
            'div[role="main"] h1',
            'div[data-value="Name"]',
            'button[data-item-id="title"]',
            'button[aria-label*="title"]',
            // New selectors for 2024/2025 Google Maps
            '[data-value="title"]',
            'div[jsaction*="title"]',
          ];

          for (const selector of nameSelectors) {
            try {
              const element = document.querySelector(selector);
              if (
                element &&
                element.textContent &&
                element.textContent.trim()
              ) {
                const text = element.textContent.trim();
                // Skip cookie banner text and common Google text
                if (
                  !text.includes('Bevor Sie zu Google') &&
                  !text.includes('Before you continue') &&
                  !text.includes('Cookie') &&
                  !text.includes('Datenschutz') &&
                  !text.includes('Privacy') &&
                  !text.includes('Google Maps') &&
                  !text.includes('Maps') &&
                  text.length > 2
                ) {
                  data.name = text;
                  break;
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // If no name found, try to get from page title
          if (!data.name) {
            try {
              const title = document.title;
              if (title && !title.includes('Google Maps')) {
                // Extract name from title like "Colombina - Google Maps" or "Colombina · Google Maps"
                const nameMatch = title.match(/^([^-·]+)/);
                if (nameMatch) {
                  data.name = nameMatch[1].trim();
                }
              }
            } catch {
              // Ignore
            }
          }

          // Try to extract from URL if still no name (fallback)
          if (!data.name) {
            try {
              const url = window.location.href;
              const placeMatch = url.match(/place\/([^/@]+)/);
              if (placeMatch) {
                data.name = decodeURIComponent(
                  placeMatch[1].replace(/\+/g, ' ')
                );
              }
            } catch {
              // Ignore
            }
          }

          // Decode URL-encoded name if it looks encoded
          if (data.name && data.name.includes('%')) {
            try {
              data.name = decodeURIComponent(data.name);
            } catch {
              // Ignore
            }
          }

          // Extract address - PRIORITIZE aria-label (most reliable)
          const addressSelectors = [
            // First: aria-label (most stable)
            'button[aria-label*="Address"]',
            'button[aria-label*="Adresse"]',
            'button[aria-label*="address"]',
            '[aria-label*="Address"]',
            '[aria-label*="Adresse"]',
            // Second: data-attributes
            'button[data-item-id*="address"]',
            '[data-value="Address"]',
            '[data-value="address"]',
            'div[data-value="Address"]',
            'div[data-value="address"]',
            // Third: CSS classes (less reliable)
            '.Io6YTe',
            '[data-value="address"] .Io6YTe',
            'div[role="main"] button[data-item-id*="address"]',
            'div[role="main"] .Io6YTe',
            'div[role="main"] .Io6YTe:first-of-type',
            'button[data-item-id*="address"] .Io6YTe',
          ];

          // First try: find element with address and get its text
          for (const selector of addressSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element) {
                // Try aria-label first (most reliable)
                let text =
                  element.getAttribute('aria-label') ||
                  element.textContent?.trim() ||
                  element.innerText?.trim() ||
                  '';

                // If it's a button, try to find the text in child elements
                if (!text || text.length < 5) {
                  const childText = element
                    .querySelector('.Io6YTe')
                    ?.textContent?.trim();
                  if (childText) text = childText;
                }

                // Clean up text (remove "Address:" prefix if present)
                text = text.replace(/^(Address|Adresse):\s*/i, '').trim();

                if (
                  text &&
                  text.length > 5 &&
                  !text.includes('Directions') &&
                  !text.includes('Route') &&
                  !text.includes('Get directions')
                ) {
                  data.address = text;
                  break;
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // Second try: find all Io6YTe elements and use the first one that looks like an address
          if (!data.address) {
            try {
              const allIo6YTe = document.querySelectorAll('.Io6YTe');
              for (const elem of allIo6YTe) {
                const text = elem.textContent?.trim() || '';
                // Check if it looks like an address (contains numbers or common address words)
                if (
                  text &&
                  text.length > 10 &&
                  (/\d/.test(text) ||
                    text.includes('Straße') ||
                    text.includes('Str.') ||
                    text.includes('Street') ||
                    text.includes('Berlin') ||
                    text.includes('München') ||
                    text.includes('Hamburg') ||
                    text.includes('Platz') ||
                    text.includes('Weg'))
                ) {
                  data.address = text;
                  break;
                }
              }
            } catch {
              // Ignore
            }
          }

          // Extract rating - PRIORITIZE aria-label (most reliable)
          const ratingSelectors = [
            // First: aria-label (most stable)
            '[aria-label*="stars"]',
            '[aria-label*="Sterne"]',
            '[aria-label*="rating"]',
            '[aria-label*="Bewertung"]',
            'button[aria-label*="stars"]',
            'div[aria-label*="stars"]',
            'span[aria-label*="stars"]',
            // Second: data-attributes
            '[data-value="Rating"]',
            'div[data-value="Rating"]',
            'span[data-value="Rating"]',
            // Third: CSS classes (less reliable)
            '.F7nice',
            'div[role="main"] [aria-label*="stars"]',
            'button[data-item-id*="rating"]',
            'button[data-item-id*="review"]',
          ];

          for (const selector of ratingSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element) {
                // Try aria-label first (most reliable)
                let ratingText =
                  element.getAttribute('aria-label') ||
                  element.textContent?.trim() ||
                  element.innerText?.trim() ||
                  '';

                // Try to find rating in parent or child elements
                if (!ratingText || !ratingText.match(/\d/)) {
                  const parent =
                    element.closest('[aria-label*="stars"]') ||
                    element.closest('[aria-label*="rating"]') ||
                    element.closest('[aria-label*="Sterne"]');
                  if (parent) {
                    ratingText =
                      parent.getAttribute('aria-label') || ratingText;
                  }
                }

                if (ratingText) {
                  // Try to match rating like "4.5 stars" or "4,5" or "4.5"
                  const ratingMatch =
                    ratingText.match(
                      /(\d+[,.]?\d*)\s*(?:stars?|Sterne|von|out of|\/)/i
                    ) || ratingText.match(/(\d+[,.]?\d*)/);
                  if (ratingMatch) {
                    data.rating = ratingMatch[1].replace(',', '.');
                    break;
                  }
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // Extract number of reviews - PRIORITIZE aria-label
          const reviewsSelectors = [
            // First: aria-label (most stable)
            '[aria-label*="reviews"]',
            '[aria-label*="Bewertungen"]',
            'span[aria-label*="reviews"]',
            'span[aria-label*="Bewertungen"]',
            'button[aria-label*="reviews"]',
            // Second: data-attributes
            '[data-value="Reviews"]',
            // Third: CSS classes and other
            '.F7nice span',
            'button[data-item-id*="review"]',
            'div[role="main"] span[aria-label*="reviews"]',
          ];

          for (const selector of reviewsSelectors) {
            try {
              const reviewsElement = document.querySelector(selector);
              if (reviewsElement) {
                // Try aria-label first (most reliable)
                const reviewsText =
                  reviewsElement.getAttribute('aria-label') ||
                  reviewsElement.textContent?.trim() ||
                  '';
                if (reviewsText) {
                  // Match patterns like "123 reviews", "1.234 Bewertungen", etc.
                  const reviewsMatch =
                    reviewsText.match(
                      /([\d.,]+)\s*(?:reviews?|Bewertungen?|Ratings?)/i
                    ) || reviewsText.match(/([\d.,]+)/);
                  if (reviewsMatch) {
                    data.reviews = reviewsMatch[1].replace(/[,.]/g, '');
                    break;
                  }
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // Extract phone number - PRIORITIZE aria-label
          const phoneSelectors = [
            // First: aria-label (most stable)
            'button[aria-label*="Phone"]',
            'button[aria-label*="Telefon"]',
            '[aria-label*="phone"]',
            '[aria-label*="Telefon"]',
            // Second: data-attributes
            '[data-value="Phone"]',
            '[data-value="phone"]',
            'button[data-item-id*="phone"]',
            'button[data-item-id*="tel"]',
            // Third: href with tel:
            'a[href^="tel:"]',
          ];
          for (const selector of phoneSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element) {
                // Try aria-label first, then textContent, then href
                data.phone =
                  element.getAttribute('aria-label') ||
                  element.textContent?.trim() ||
                  element.getAttribute('href')?.replace('tel:', '') ||
                  '';
                if (data.phone) {
                  // Clean up phone number
                  data.phone = data.phone
                    .replace(/^(Phone|Telefon):\s*/i, '')
                    .trim();
                  break;
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // Extract website - PRIORITIZE aria-label
          const websiteSelectors = [
            // First: aria-label (most stable)
            'a[aria-label*="Website"]',
            'a[aria-label*="Webseite"]',
            'button[aria-label*="Website"]',
            // Second: data-attributes
            '[data-value="Website"]',
            'a[data-value="Website"]',
            'a[data-item-id="authority"]',
            // Third: href links (but filter out Google links)
            'a[href^="http"]',
          ];
          for (const selector of websiteSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element) {
                const href = element.href || element.getAttribute('href') || '';
                if (
                  href &&
                  !href.includes('google.com') &&
                  !href.includes('maps.google.com') &&
                  (href.startsWith('http://') || href.startsWith('https://'))
                ) {
                  data.website = href;
                  break;
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // Extract category/type - PRIORITIZE aria-label
          const categorySelectors = [
            'button[aria-label*="Category"]',
            'button[aria-label*="Kategorie"]',
            '[aria-label*="category"]',
            '[data-value="Category"]',
            'button[jsaction*="category"]',
            '.DkEaL',
          ];
          for (const selector of categorySelectors) {
            try {
              const categoryElement = document.querySelector(selector);
              if (categoryElement) {
                const categoryText =
                  categoryElement.getAttribute('aria-label') ||
                  categoryElement.textContent?.trim() ||
                  '';
                if (categoryText) {
                  data.category = categoryText
                    .replace(/^(Category|Kategorie):\s*/i, '')
                    .trim();
                  break;
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // Extract hours (if available) - PRIORITIZE aria-label
          const hoursSelectors = [
            'button[aria-label*="Hours"]',
            'button[aria-label*="Öffnungszeiten"]',
            '[aria-label*="hours"]',
            '[data-value="Hours"]',
            '.t39EBf',
            '.y0skZc',
          ];
          for (const selector of hoursSelectors) {
            try {
              const hoursElement = document.querySelector(selector);
              if (hoursElement) {
                const hoursText =
                  hoursElement.getAttribute('aria-label') ||
                  hoursElement.textContent?.trim() ||
                  '';
                if (hoursText) {
                  data.hours = hoursText
                    .replace(/^(Hours|Öffnungszeiten):\s*/i, '')
                    .trim();
                  break;
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // Extract coordinates from URL or page
          const urlParams = new URLSearchParams(window.location.search);
          const center = urlParams.get('center');
          if (center) {
            const [lat, lng] = center.split(',');
            data.coordinates = {
              latitude: parseFloat(lat),
              longitude: parseFloat(lng),
            };
          }

          // Extract place ID from URL
          const placeIdMatch = window.location.href.match(/place_id=([^&]+)/);
          if (placeIdMatch) {
            data.placeId = placeIdMatch[1];
          }

          return data;
        });
      } else {
        logger.info('Successfully extracted data from JSON-LD schema', {
          hasName: !!placeData.name,
        });
      }

      // Debug: Log page title and URL to see what was actually loaded
      try {
        const pageInfo = await page.evaluate(() => {
          return {
            title: document.title,

            url: window.location.href,

            hasMainContent: !!document.querySelector('div[role="main"]'),

            hasSidebar:
              !!document.querySelector('[data-value="Address"]') ||
              !!document.querySelector('.Io6YTe'),

            allIo6YTeCount: document.querySelectorAll('.Io6YTe').length,

            allButtonsCount: document.querySelectorAll('button[data-item-id]')
              .length,
          };
        });
        logger.info('Google Maps page info', pageInfo);
      } catch (e) {
        logger.warn('Could not get page info for debugging', {
          error: e.message,
        });
      }

      // Log what we found for debugging
      logger.info('Google Maps extraction result', {
        hasName: !!placeData?.name,
        hasAddress: !!placeData?.address,
        hasRating: !!placeData?.rating,
        hasPhone: !!placeData?.phone,
        hasWebsite: !!placeData?.website,
        dataKeys: placeData ? Object.keys(placeData) : [],
        sampleData: placeData
          ? {
              name: placeData.name?.substring(0, 50),
              address: placeData.address?.substring(0, 50),
              rating: placeData.rating,
            }
          : null,
      });

      await page.close();
      browserPool.decrementActivePages();

      return {
        success: true,
        data: placeData,
        extractType: 'google-maps',
        url,
        method: 'puppeteer',
      };
    } catch (error) {
      await page.close();
      browserPool.decrementActivePages();
      throw error;
    }
  } catch (error) {
    logger.error('Google Maps scraping error', {
      url,
      error: error.message,
      stack: error.stack,
    });

    if (error.message.includes('timeout')) {
      throw new Error(
        `Timeout: Google Maps took too long to load (${options.timeout || 60}s). Try increasing the timeout.`
      );
    }

    throw error;
  }
}

/**
 * Scrape Google Maps Search Results
 * Extracts a list of search results from Google Maps search URLs
 */
async function scrapeGoogleMapsSearch(url, options) {
  logger.info('Scraping Google Maps Search', { url });

  // Google Maps requires Puppeteer with stealth mode
  const browser = await browserPool.getBrowser({ stealthMode: true });
  const timeout = (options.timeout || 90) * 1000; // Longer timeout for Maps (90s default)

  try {
    // Create page with increased timeout
    const page = await browser.newPage();
    // Set default timeout for page operations
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    browserPool.incrementActivePages();

    try {
      // Set a larger viewport for better rendering
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      // Wait for Google Maps to fully load (it's heavily JS-rendered)
      await page.waitForTimeout(3000);

      // Wait for page to load and check if we're on consent page
      await page.waitForTimeout(2000);

      // Check if we're on the consent page
      const currentUrl = page.url();
      const isConsentPage = currentUrl.includes('consent.google.com');

      if (isConsentPage) {
        logger.info('Detected consent page, trying to accept cookies');

        // Try multiple strategies to accept cookies
        const cookieButtonSelectors = [
          // German
          'button:has-text("Alle akzeptieren")',
          'button:has-text("Akzeptieren")',
          'button:has-text("Ich stimme zu")',
          // English
          'button:has-text("Accept all")',
          'button:has-text("I agree")',
          // Aria labels
          'button[aria-label*="Accept"]',
          'button[aria-label*="Akzeptieren"]',
          'button[aria-label*="accept"]',
          // IDs and attributes
          '#L2AGLb', // Google's cookie accept button ID
          'button[data-ved*="cookie"]',
          'button[id*="accept"]',
          // Generic button in consent page
          'form button[type="submit"]',
          'button[type="submit"]',
        ];

        let cookieAccepted = false;
        for (const selector of cookieButtonSelectors) {
          try {
            const button = await page.$(selector);
            if (button) {
              await button.click();
              await page.waitForTimeout(2000);
              logger.info('Cookie banner closed', { selector });
              cookieAccepted = true;
              break;
            }
          } catch {
            // Try next selector
          }
        }

        // If no button found, try to find by text content
        if (!cookieAccepted) {
          try {
            const buttons = await page.$$('button');
            for (const button of buttons) {
              const text = await page.evaluate(el => el.textContent, button);
              if (
                text &&
                (text.includes('Alle akzeptieren') ||
                  text.includes('Accept all') ||
                  text.includes('Akzeptieren') ||
                  text.includes('Accept'))
              ) {
                await button.click();
                await page.waitForTimeout(2000);
                logger.info('Cookie banner closed by text content');
                cookieAccepted = true;
                break;
              }
            }
          } catch (e) {
            logger.warn('Could not find cookie button by text', {
              error: e.message,
            });
          }
        }

        // Wait for navigation to actual Maps page
        try {
          await page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 15000,
          });
          logger.info('Navigated to Google Maps page after consent');
        } catch (e) {
          logger.warn('Navigation timeout after consent, continuing anyway', {
            error: e.message,
          });
        }

        // Double check we're on Maps page now
        const newUrl = page.url();
        if (newUrl.includes('consent.google.com')) {
          logger.warn(
            'Still on consent page after clicking accept, trying direct navigation'
          );
          // Try to extract the continue URL and navigate directly
          try {
            const continueUrl = await page.evaluate(() => {
              const urlParams = new URLSearchParams(window.location.search);
              return urlParams.get('continue');
            });
            if (continueUrl) {
              await page.goto(decodeURIComponent(continueUrl), {
                waitUntil: 'networkidle2',
                timeout: 30000,
              });
              logger.info('Navigated directly to Maps page');
            }
          } catch (e) {
            logger.error('Could not navigate to Maps page', {
              error: e.message,
            });
          }
        }
      }

      // Wait a bit more and verify we're on the actual Maps page
      await page.waitForTimeout(3000);

      // Verify we're on Google Maps, not consent page
      const finalUrl = page.url();
      if (finalUrl.includes('consent.google.com')) {
        throw new Error(
          'Still on consent page after cookie handling. Google Maps may be blocking automated access.'
        );
      }

      logger.info('Confirmed on Google Maps search page', { url: finalUrl });

      // Wait for search results to load
      try {
        await page.waitForSelector('div[role="main"]', { timeout: 15000 });
        logger.info('Main content loaded');
      } catch (e) {
        logger.warn('Main content selector not found, continuing anyway', {
          error: e.message,
        });
      }

      await page.waitForTimeout(3000);

      // Scroll to load more results

      await page.evaluate(() => {
        window.scrollTo(0, 500);
      });
      await page.waitForTimeout(2000);

      // Scroll more to trigger lazy loading

      await page.evaluate(() => {
        window.scrollTo(0, 1000);
      });
      await page.waitForTimeout(2000);

      // Scroll even more to load all results

      await page.evaluate(() => {
        window.scrollTo(0, 1500);
      });
      await page.waitForTimeout(2000);

      // Extract search results

      const results = await page.evaluate(() => {
        const items = [];

        // Find all result items in the sidebar
        // Google Maps search results are typically in div[role="article"] or similar containers
        const resultSelectors = [
          'div[role="article"]',
          'div[data-result-index]',
          'a[data-value="Directions"]',
          'div[jsaction*="mouseover"]',
        ];

        let resultElements = [];
        for (const selector of resultSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            resultElements = Array.from(elements);
            break;
          }
        }

        // If no results found, try to find by structure in the sidebar
        if (resultElements.length === 0) {
          const sidebar = document.querySelector('div[role="main"]');
          if (sidebar) {
            // Find all clickable items that look like results
            const allItems = Array.from(
              sidebar.querySelectorAll('div[jsaction], a[href*="/place/"]')
            );
            resultElements = allItems.filter(el => {
              const text = el.textContent || '';
              // Filter out small elements and navigation items
              return (
                text.length > 50 &&
                !text.includes('Directions') &&
                !text.includes('Save')
              );
            });
          }
        }

        // Extract data from each result (limit to 20 results)
        resultElements.slice(0, 20).forEach(element => {
          try {
            const data = {};

            // Extract name - look for h3, h2, or title elements
            const nameSelectors = [
              'h3',
              'h2',
              'h1',
              '[data-value="Name"]',
              '.fontHeadlineSmall',
              'div[class*="title"]',
              'span[class*="title"]',
            ];

            for (const selector of nameSelectors) {
              const nameEl = element.querySelector(selector);
              if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
                const nameText = nameEl.textContent.trim();
                // Skip cookie banner text and common Google text
                if (
                  !nameText.includes('Bevor Sie zu Google') &&
                  !nameText.includes('Before you continue') &&
                  !nameText.includes('Cookie') &&
                  nameText.length > 2
                ) {
                  data.name = nameText;
                  break;
                }
              }
            }

            // If no name found, try parent element
            if (!data.name) {
              const parent = element.closest('div[jsaction]');
              if (parent) {
                const nameEl = parent.querySelector('h3, h2, h1');
                if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
                  data.name = nameEl.textContent.trim();
                }
              }
            }

            // Extract rating
            const ratingEl = element.querySelector(
              '[aria-label*="star"], [aria-label*="Sterne"]'
            );
            if (ratingEl) {
              const ratingText = ratingEl.getAttribute('aria-label') || '';
              const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
              if (ratingMatch) {
                data.rating = ratingMatch[1];
              }
            }

            // Extract number of reviews
            const reviewsSelectors = [
              'span[class*="review"]',
              'span[class*="Review"]',
              'button[aria-label*="review"]',
            ];
            for (const selector of reviewsSelectors) {
              const reviewsEl = element.querySelector(selector);
              if (reviewsEl) {
                const reviewsText =
                  reviewsEl.textContent ||
                  reviewsEl.getAttribute('aria-label') ||
                  '';
                const reviewsMatch = reviewsText.match(/(\d+)/);
                if (reviewsMatch) {
                  data.reviews = reviewsMatch[1];
                  break;
                }
              }
            }

            // Extract address
            const addressSelectors = [
              '.Io6YTe',
              '[data-value="Address"]',
              'span[class*="address"]',
              'button[aria-label*="Address"]',
              'button[aria-label*="Adresse"]',
            ];

            for (const selector of addressSelectors) {
              const addrEl = element.querySelector(selector);
              if (addrEl) {
                const addrText =
                  addrEl.textContent || addrEl.getAttribute('aria-label') || '';
                if (
                  addrText &&
                  addrText.trim() &&
                  !addrText.includes('Address') &&
                  !addrText.includes('Adresse')
                ) {
                  data.address = addrText.trim();
                  break;
                }
              }
            }

            // Extract category/type
            const categorySelectors = [
              'span[class*="type"]',
              'button[aria-label*="Category"]',
              'button[aria-label*="Kategorie"]',
              '.DkEaL',
            ];
            for (const selector of categorySelectors) {
              const categoryEl = element.querySelector(selector);
              if (categoryEl) {
                const categoryText =
                  categoryEl.textContent ||
                  categoryEl.getAttribute('aria-label') ||
                  '';
                if (categoryText && categoryText.trim()) {
                  data.category = categoryText
                    .replace(/^(Category|Kategorie):\s*/i, '')
                    .trim();
                  break;
                }
              }
            }

            // Extract link/place ID from href
            const linkEl =
              element.querySelector('a[href*="/place/"]') ||
              element.closest('a[href*="/place/"]');
            if (linkEl) {
              const href = linkEl.getAttribute('href');
              const placeMatch = href.match(/place\/([^/]+)/);
              if (placeMatch) {
                data.placeId = placeMatch[1];
                data.url = `https://www.google.com/maps/place/${placeMatch[1]}`;
              }
            }

            // Only add if we have at least a name
            if (data.name) {
              items.push(data);
            }
          } catch {
            // Skip this item if extraction fails
          }
        });

        return items;
      });

      logger.info('Extracted search results', { count: results.length });

      return {
        success: true,
        data: results,
        extractType: 'google-maps-search',
        method: 'puppeteer',
      };
    } finally {
      await page.close();
      browserPool.decrementActivePages();
    }
  } catch (error) {
    logger.error('Error scraping Google Maps Search', {
      error: error.message,
      url,
    });
    throw error;
  }
}

/**
 * Main scrape function - decides between fetch and Puppeteer
 */
export async function scrape(url, options = {}) {
  if (!url) {
    throw new Error('URL is required');
  }

  // Normalize URL - add https:// if missing
  let normalizedUrl = url.trim();
  if (
    !normalizedUrl.startsWith('http://') &&
    !normalizedUrl.startsWith('https://')
  ) {
    normalizedUrl = `https://${normalizedUrl}`;
    logger.info('URL normalized, added https://', {
      original: url,
      normalized: normalizedUrl,
    });
  }

  // Validate URL
  try {
    new URL(normalizedUrl);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Use normalized URL
  url = normalizedUrl;

  // Normalize extractType (trim whitespace)
  if (options.extractType && typeof options.extractType === 'string') {
    options.extractType = options.extractType.trim();
  }

  // Special handling for Google Maps Search (check before regular Maps)
  // Check this BEFORE validation, so we can auto-detect from URL
  const isGoogleMapsSearch =
    options.extractType === 'google-maps-search' ||
    (url && typeof url === 'string' && url.includes('google.com/maps/search'));

  if (isGoogleMapsSearch) {
    // Override extractType to google-maps-search if auto-detected
    if (!options.extractType && url.includes('google.com/maps/search')) {
      options.extractType = 'google-maps-search';
    }
    logger.info('Google Maps Search detected, using scrapeGoogleMapsSearch', {
      extractType: options.extractType,
      url,
    });
    return await scrapeGoogleMapsSearch(url, options);
  }

  // Special handling for Google Maps Place (can be selected manually or auto-detected)
  // Check this BEFORE validation, so we can auto-detect from URL
  // Check with normalized URL
  const isGoogleMaps =
    options.extractType === 'google-maps' ||
    (url && typeof url === 'string' && url.includes('google.com/maps'));

  if (isGoogleMaps) {
    // Override extractType to google-maps if auto-detected
    if (!options.extractType && url.includes('google.com/maps')) {
      options.extractType = 'google-maps';
    }
    logger.info('Google Maps detected, using scrapeGoogleMaps', {
      extractType: options.extractType,
      url,
    });
    return await scrapeGoogleMaps(url, options);
  }

  // Validate extract type (after Google Maps checks - only if not Google Maps)
  const validExtractTypes = [
    'text',
    'html',
    'attribute',
    'all-links',
    'all-images',
    'multiple',
    'google-maps',
    'google-maps-search',
    'full-html',
    'text-search',
    'smart-list',
  ];

  // Validate extract type - google-maps and google-maps-search are always valid
  if (options.extractType) {
    if (options.extractType === 'google-maps-search') {
      // This should have been caught above, but if not, handle it here
      logger.warn(
        'Google Maps Search extractType detected but not caught in earlier check',
        {
          extractType: options.extractType,
          url,
        }
      );
      return await scrapeGoogleMapsSearch(url, options);
    }

    if (options.extractType === 'google-maps') {
      // This should have been caught above, but if not, handle it here
      logger.warn(
        'Google Maps extractType detected but not caught in earlier check',
        {
          extractType: options.extractType,
          url,
        }
      );
      return await scrapeGoogleMaps(url, options);
    }

    if (!validExtractTypes.includes(options.extractType)) {
      logger.error('Invalid extract type', {
        extractType: options.extractType,
        validTypes: validExtractTypes,
        url,
      });
      throw new Error(
        `Invalid extract type: ${options.extractType}. Must be one of: ${validExtractTypes.join(', ')}`
      );
    }
  }

  // Validate selector requirements
  if (
    options.extractType !== 'all-links' &&
    options.extractType !== 'all-images' &&
    options.extractType !== 'multiple' &&
    options.extractType !== 'google-maps' &&
    options.extractType !== 'google-maps-search' &&
    options.extractType !== 'full-html' &&
    options.extractType !== 'smart-list' &&
    options.extractType !== 'text-search' &&
    !options.selector &&
    !options.searchText
  ) {
    throw new Error(
      'Selector or search text is required for this extract type'
    );
  }

  // Validate attribute requirement
  if (options.extractType === 'attribute' && !options.attribute) {
    throw new Error('Attribute is required for attribute extraction');
  }

  // Decide between fetch and Puppeteer
  if (needsPuppeteer(options)) {
    return await scrapeWithPuppeteer(url, options);
  } else {
    return await scrapeWithFetch(url, options);
  }
}

/**
 * Cleanup browser pool (call on app shutdown)
 */
export async function closeBrowserPool() {
  await browserPool.close();
}
