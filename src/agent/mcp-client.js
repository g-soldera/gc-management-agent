const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const logger = require('../logger');

class MCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.process = null;
  }

  async connect() {
    if (this.client) return;

    const serverPath = process.env.MCP_SERVER_PATH;
    if (!serverPath) {
      throw new Error('MCP_SERVER_PATH not configured');
    }

    logger.info({ serverPath }, 'Connecting to MCP server');

    this.transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        API_URL: process.env.MCP_API_URL,
        API_KEY: process.env.MCP_API_KEY
      },
      stderr: 'pipe'
    });

    this.client = new Client({
      name: 'gc-management-agent',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    try {
      await this.client.connect(this.transport);
      logger.info('MCP client connected');
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'MCP client connect failed');
      throw error;
    }
  }

  async listTools() {
    if (!this.client) await this.connect();
    const response = await this.client.listTools();
    return response.tools;
  }

  async callTool(name, args) {
    if (!this.client) await this.connect();
    const response = await this.client.callTool({ name, arguments: args });
    return response;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    logger.info('MCP client disconnected');
  }
}

module.exports = MCPClient;
