/**
 * Variable Context Service for Full Workflows
 * Manages variables during workflow execution
 */

class VariableContext {
  constructor() {
    this.variables = new Map(); // Global variables
    this.nodeOutputs = new Map(); // Node-specific outputs
    this.workflowInput = null; // Initial workflow input
  }

  /**
   * Set a global variable
   * @param {string} name - Variable name
   * @param {*} value - Variable value
   */
  setVariable(name, value) {
    this.variables.set(name, value);
  }

  /**
   * Get a global variable
   * @param {string} name - Variable name
   * @returns {*} - Variable value or undefined
   */
  getVariable(name) {
    return this.variables.get(name);
  }

  /**
   * Set node output
   * @param {string} nodeId - Node ID
   * @param {*} output - Node output
   */
  setNodeOutput(nodeId, output) {
    this.nodeOutputs.set(nodeId, output);
  }

  /**
   * Get node output
   * @param {string} nodeId - Node ID
   * @returns {*} - Node output or undefined
   */
  getNodeOutput(nodeId) {
    return this.nodeOutputs.get(nodeId);
  }

  /**
   * Set workflow input
   * @param {*} input - Workflow input data
   */
  setWorkflowInput(input) {
    this.workflowInput = input;
  }

  /**
   * Get workflow input
   * @returns {*} - Workflow input
   */
  getWorkflowInput() {
    return this.workflowInput;
  }

  /**
   * Get previous node output (for sequential workflows)
   * @param {string} currentNodeId - Current node ID
   * @param {Array} edges - Workflow edges
   * @returns {*} - Previous node output or undefined
   */
  getPreviousNodeOutput(currentNodeId, edges) {
    // Find the node that connects to current node
    const incomingEdge = edges.find(edge => edge.target === currentNodeId);
    if (!incomingEdge) {
      return undefined;
    }

    return this.getNodeOutput(incomingEdge.source);
  }

  /**
   * Get context object for template resolution
   * @param {string} currentNodeId - Current node ID (optional)
   * @param {Array} edges - Workflow edges (optional)
   * @returns {Object} - Context object
   */
  getContext(currentNodeId = null, edges = []) {
    const context = {
      variables: Object.fromEntries(this.variables),
      nodeOutputs: Object.fromEntries(this.nodeOutputs),
      workflowInput: this.workflowInput,
      // Add userId for backward compatibility
      userId:
        this.variables.get('userId') ||
        (this.workflowInput && typeof this.workflowInput === 'object'
          ? this.workflowInput.userId
          : null),
    };

    // Add previous node output if available
    if (currentNodeId && edges.length > 0) {
      const previousOutput = this.getPreviousNodeOutput(currentNodeId, edges);
      if (previousOutput !== undefined) {
        context.previousNodeOutput = previousOutput;
      }
    }

    return context;
  }

  /**
   * Clear all variables and outputs
   */
  clear() {
    this.variables.clear();
    this.nodeOutputs.clear();
    this.workflowInput = null;
  }

  /**
   * Get all available variables as a list
   * @param {string} currentNodeId - Current node ID (optional)
   * @param {Array} edges - Workflow edges (optional)
   * @returns {Array<Object>} - Array of variable info objects
   */
  getAvailableVariables(currentNodeId = null, edges = []) {
    const variables = [];

    // Global variables
    this.variables.forEach((value, name) => {
      variables.push({
        name,
        path: name,
        value,
        type: 'variable',
        description: `Global variable: ${name}`,
      });
    });

    // Node outputs
    this.nodeOutputs.forEach((output, nodeId) => {
      if (typeof output === 'object' && output !== null) {
        // Add root output
        variables.push({
          name: `${nodeId}.output`,
          path: `${nodeId}.output`,
          value: output,
          type: 'node-output',
          description: `Output from node: ${nodeId}`,
        });

        // Add nested fields
        const addNestedFields = (obj, prefix) => {
          Object.keys(obj).forEach(key => {
            const value = obj[key];
            const fullPath = `${prefix}.${key}`;
            variables.push({
              name: fullPath,
              path: fullPath,
              value,
              type: 'node-output-field',
              description: `Field from ${nodeId}: ${key}`,
            });

            if (
              typeof value === 'object' &&
              value !== null &&
              !Array.isArray(value)
            ) {
              addNestedFields(value, fullPath);
            }
          });
        };

        addNestedFields(output, `${nodeId}.output`);
      } else {
        variables.push({
          name: `${nodeId}.output`,
          path: `${nodeId}.output`,
          value: output,
          type: 'node-output',
          description: `Output from node: ${nodeId}`,
        });
      }
    });

    // Previous node output
    if (currentNodeId && edges.length > 0) {
      const previousOutput = this.getPreviousNodeOutput(currentNodeId, edges);
      if (previousOutput !== undefined) {
        if (typeof previousOutput === 'object' && previousOutput !== null) {
          variables.push({
            name: 'previous.output',
            path: 'previous.output',
            value: previousOutput,
            type: 'previous-output',
            description: 'Output from previous node',
          });

          // Add nested fields
          const addNestedFields = (obj, prefix) => {
            Object.keys(obj).forEach(key => {
              const value = obj[key];
              const fullPath = `${prefix}.${key}`;
              variables.push({
                name: fullPath,
                path: fullPath,
                value,
                type: 'previous-output-field',
                description: `Field from previous node: ${key}`,
              });

              if (
                typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value)
              ) {
                addNestedFields(value, fullPath);
              }
            });
          };

          addNestedFields(previousOutput, 'previous.output');
        } else {
          variables.push({
            name: 'previous.output',
            path: 'previous.output',
            value: previousOutput,
            type: 'previous-output',
            description: 'Output from previous node',
          });
        }
      }
    }

    // Workflow input
    if (this.workflowInput) {
      if (
        typeof this.workflowInput === 'object' &&
        this.workflowInput !== null
      ) {
        variables.push({
          name: 'workflow.input',
          path: 'workflow.input',
          value: this.workflowInput,
          type: 'workflow-input',
          description: 'Workflow input data',
        });

        // Add nested fields
        const addNestedFields = (obj, prefix) => {
          Object.keys(obj).forEach(key => {
            const value = obj[key];
            const fullPath = `${prefix}.${key}`;
            variables.push({
              name: fullPath,
              path: fullPath,
              value,
              type: 'workflow-input-field',
              description: `Field from workflow input: ${key}`,
            });

            if (
              typeof value === 'object' &&
              value !== null &&
              !Array.isArray(value)
            ) {
              addNestedFields(value, fullPath);
            }
          });
        };

        addNestedFields(this.workflowInput, 'workflow.input');
      } else {
        variables.push({
          name: 'workflow.input',
          path: 'workflow.input',
          value: this.workflowInput,
          type: 'workflow-input',
          description: 'Workflow input data',
        });
      }
    }

    return variables;
  }
}

export default VariableContext;
