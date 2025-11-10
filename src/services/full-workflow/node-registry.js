/**
 * Node Registry for Full Workflows
 * Similar to Job Registry pattern - manages all available node types
 */

class NodeRegistry {
  constructor() {
    this.nodes = new Map();
  }

  /**
   * Register a node type
   * @param {string} type - Node type identifier (e.g., 'webhook', 'http-request')
   * @param {Object} config - Node configuration
   * @param {Function} handler - Execution handler function
   */
  register(type, config, handler) {
    if (this.nodes.has(type)) {
      throw new Error(`Node type "${type}" is already registered`);
    }

    this.nodes.set(type, {
      type,
      config,
      handler,
    });
  }

  /**
   * Get node configuration
   * @param {string} type - Node type
   * @returns {Object} Node configuration
   */
  getConfig(type) {
    const node = this.nodes.get(type);
    if (!node) {
      throw new Error(`Node type "${type}" is not registered`);
    }
    return node.config;
  }

  /**
   * Get node handler
   * @param {string} type - Node type
   * @returns {Function} Handler function
   */
  getHandler(type) {
    const node = this.nodes.get(type);
    if (!node) {
      throw new Error(`Node type "${type}" is not registered`);
    }
    return node.handler;
  }

  /**
   * Check if node type is registered
   * @param {string} type - Node type
   * @returns {boolean}
   */
  has(type) {
    return this.nodes.has(type);
  }

  /**
   * Get all registered node types
   * @returns {Array<string>}
   */
  getTypes() {
    return Array.from(this.nodes.keys());
  }

  /**
   * Get all node configurations
   * @returns {Array<Object>}
   */
  getAllConfigs() {
    return Array.from(this.nodes.values()).map(node => ({
      type: node.type,
      config: node.config,
    }));
  }
}

// Singleton instance
export const nodeRegistry = new NodeRegistry();
