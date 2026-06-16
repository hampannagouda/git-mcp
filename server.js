import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Global variables to hold the MCP client and connection state
let mcpClient = null;
let mcpTransport = null;
let isConnecting = false;

// Middleware to check if MCP client is connected
const checkConnection = (req, res, next) => {
  if (!mcpClient) {
    return res.status(400).json({ error: 'MCP server is not connected. Please connect first.' });
  }
  next();
};

// Connect to GitHub MCP Server
app.post('/api/connect', async (req, res) => {
  const { githubToken } = req.body;
  const token = githubToken || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  if (!token) {
    return res.status(400).json({ error: 'GitHub Personal Access Token is required.' });
  }

  if (isConnecting) {
    return res.status(409).json({ error: 'A connection attempt is already in progress.' });
  }

  isConnecting = true;

  try {
    // Clean up any existing connection
    await disconnectMCP();

    console.log('Spawning GitHub MCP server subprocess...');
    
    // Path to the GitHub MCP Server index.js
    const serverScript = path.join(__dirname, 'node_modules', '@modelcontextprotocol', 'server-github', 'dist', 'index.js');

    // Create the Stdio Transport
    mcpTransport = new StdioClientTransport({
      command: process.execPath, // uses the same node executable running this server
      args: [serverScript],
      env: {
        ...process.env,
        GITHUB_PERSONAL_ACCESS_TOKEN: token,
      }
    });

    // Create the MCP Client
    mcpClient = new Client(
      {
        name: 'git-mcp-studio-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Connect to the transport
    await mcpClient.connect(mcpTransport);
    console.log('Connected to GitHub MCP server successfully!');

    // Fetch the list of available tools
    const toolsResponse = await mcpClient.listTools();

    res.json({
      success: true,
      message: 'Successfully connected to GitHub MCP server.',
      tools: toolsResponse.tools || [],
    });
  } catch (error) {
    console.error('Failed to connect to GitHub MCP Server:', error);
    await disconnectMCP();
    res.status(500).json({ error: error.message || 'Failed to connect to GitHub MCP server.' });
  } finally {
    isConnecting = false;
  }
});

// Call a specific tool on the GitHub MCP server
app.post('/api/call-tool', checkConnection, async (req, res) => {
  const { name, arguments: toolArgs } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Tool name is required.' });
  }

  try {
    console.log(`Executing MCP tool: ${name} with arguments:`, toolArgs);
    const result = await mcpClient.callTool({
      name,
      arguments: toolArgs || {},
    });

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    res.status(500).json({
      error: error.message || `Failed to execute tool ${name}.`,
    });
  }
});

// Get connection status
app.get('/api/status', (req, res) => {
  res.json({
    connected: !!mcpClient,
  });
});

// Disconnect from GitHub MCP Server
app.post('/api/disconnect', async (req, res) => {
  try {
    await disconnectMCP();
    res.json({ success: true, message: 'Successfully disconnected.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to disconnect.' });
  }
});

// Graceful cleanup function
async function disconnectMCP() {
  if (mcpTransport) {
    try {
      await mcpTransport.close();
      console.log('Closed MCP transport.');
    } catch (e) {
      console.error('Error closing transport:', e);
    }
    mcpTransport = null;
  }
  mcpClient = null;
}

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`GitMCP Studio Server is running at http://localhost:${PORT}`);
  console.log(`===================================================`);
});
