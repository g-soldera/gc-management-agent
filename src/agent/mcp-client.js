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

    logger.info({ serverPath }, 'Spawning MCP server');

    this.process = spawn('node', [serverPath], {
      env: {
        ...process.env,
        API_URL: process.env.MCP_API_URL,
        API_KEY: process.env.MCP_API_KEY
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stderr.on('data', (data) => {
      logger.debug({ mcp: data.toString().trim() }, 'MCP server log');
    });

    this.transport = new StdioClientTransport({
      reader: this.process.stdout,
      writer: this.process.stdin
    });

    this.client = new Client({
      name: 'gc-management-agent',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
    logger.info('MCP client connected');
  }

  async listTools() {
    if (!this.client) await this.connect();
    const response = await this.client.request({ method: 'tools/list' }, { schema: null });
    return response.tools;
  }

  async callTool(name, args) {
    if (!this.client) await this.connect();
    const response = await this.client.request({
      method: 'tools/call',
      params: { name, arguments: args }
    }, { schema: null });
    return response;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    logger.info('MCP client disconnected');
  }
}

module.exports = MCPClient;
