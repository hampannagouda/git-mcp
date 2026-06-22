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

// Map JSON Schema types to Gemini schema types
function mapJsonSchemaToGemini(schema) {
  if (!schema || typeof schema !== 'object') return schema;

  if (Array.isArray(schema)) {
    return schema.map(mapJsonSchemaToGemini);
  }

  const result = {};
  const allowedKeys = ['type', 'properties', 'required', 'items', 'description', 'enum', 'anyOf', 'any_of', 'allOf', 'oneOf'];

  for (const key of allowedKeys) {
    if (schema[key] !== undefined) {
      if (key === 'type' && typeof schema[key] === 'string') {
        result.type = schema[key].toUpperCase();
      } else if (key === 'properties' && typeof schema[key] === 'object') {
        const cleanProps = {};
        for (const [propName, propVal] of Object.entries(schema[key])) {
          cleanProps[propName] = mapJsonSchemaToGemini(propVal);
        }
        result.properties = cleanProps;
      } else if (key === 'items' && typeof schema[key] === 'object') {
        result.items = mapJsonSchemaToGemini(schema[key]);
      } else if (key === 'anyOf' || key === 'any_of' || key === 'allOf' || key === 'oneOf') {
        if (Array.isArray(schema[key])) {
          result[key] = schema[key].map(mapJsonSchemaToGemini);
        }
      } else {
        result[key] = schema[key];
      }
    }
  }

  return result;
}

// Call Gemini API with model fallback and retries
async function callGeminiAPI(apiKey, requestPayload, systemInstruction) {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.5-flash'];
  
  for (const model of models) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      ...requestPayload,
      systemInstruction
    };

    let retries = 2;
    while (retries >= 0) {
      try {
        console.log(`Calling Gemini model ${model} (retries left: ${retries})...`);
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.status === 503 || response.status === 429) {
          if (retries > 0) {
            console.warn(`Gemini returned ${response.status} for ${model}. Retrying in 1s...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
            continue;
          }
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API returned error ${response.status}: ${errText}`);
        }

        const responseData = await response.json();
        return responseData;

      } catch (err) {
        if (retries > 0 && (err.message.includes('503') || err.message.includes('429') || err.message.includes('fetch failed'))) {
          console.warn(`Request failed: ${err.message}. Retrying in 1s...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries--;
          continue;
        }
        
        console.error(`Model ${model} failed: ${err.message}. Trying next model...`);
        break; 
      }
    }
  }
  
  throw new Error("All fallback models failed due to rate limits or high demand. Please try again later.");
}

// Endpoint for Gemini Chatbot with function calling
app.post('/api/chat', async (req, res) => {
  const { messages, apiKey: clientApiKey } = req.body;
  const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is required. Please set it in settings or .env file.' });
  }

  try {
    // 1. Prepare tools if connected to MCP
    let tools = [];
    if (mcpClient) {
      try {
        const toolsResponse = await mcpClient.listTools();
        if (toolsResponse && toolsResponse.tools) {
          const functionDeclarations = toolsResponse.tools.map(tool => ({
            name: tool.name,
            description: tool.description || `Execute GitHub operation: ${tool.name}`,
            parameters: mapJsonSchemaToGemini(tool.inputSchema)
          }));
          tools = [{ functionDeclarations }];
        }
      } catch (err) {
        console.error('Failed to retrieve MCP tools for chat:', err);
      }
    }

    // 2. Prepare the payload for Gemini API
    const systemInstruction = {
      role: 'system',
      parts: [{
        text: 'You are GitMCP Copilot, a helpful AI developer assistant integrated into GitMCP Studio. ' +
              'You help developers inspect, manage, and modify their GitHub repositories. ' +
              'You have access to a set of GitHub MCP tools to execute operations. ' +
              'Always use tools when the user requests a GitHub operation (e.g. search, list, get file, create issues/PRs, delete repo). ' +
              'When the user requests to delete a repository, you must first ask for their explicit confirmation (e.g. "Are you sure you want to delete owner/repo?") before executing the delete_repository tool. ' +
              'Format your text answers nicely with markdown, code blocks, lists, and bold text. Keep answers relevant, friendly, and concise.'
      }]
    };

    // Construct request contents
    let contents = messages.map(msg => {
      let role = msg.role;
      if (role === 'assistant' || role === 'bot') role = 'model';
      
      if (msg.parts) {
        return { role, parts: msg.parts };
      }
      
      const parts = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      if (msg.functionCalls) {
        parts.push({ functionCalls: msg.functionCalls });
      }
      if (msg.functionResponse) {
        parts.push({ functionResponse: msg.functionResponse });
      }
      return { role, parts };
    });

    // We can run a loop to handle recursive function calls
    let loopCount = 0;
    const maxLoops = 5;
    let currentResponse = null;

    while (loopCount < maxLoops) {
      loopCount++;
      
      const requestPayload = {
        contents
      };
      
      if (tools.length > 0) {
        requestPayload.tools = tools;
      }

      const responseData = await callGeminiAPI(apiKey, requestPayload, systemInstruction);
      const candidate = responseData.candidates?.[0];
      const modelContent = candidate?.content;

      if (!modelContent) {
        throw new Error('Empty response received from Gemini API.');
      }

      // Check if there are function calls requested
      const functionCalls = modelContent.parts?.filter(part => part.functionCall);
      
      if (functionCalls && functionCalls.length > 0) {
        console.log(`Gemini requested ${functionCalls.length} function calls:`, JSON.stringify(functionCalls));
        
        contents.push(modelContent);
        
        const responseParts = [];
        for (const fcPart of functionCalls) {
          const { name, args } = fcPart.functionCall;
          let toolResult = null;
          
          try {
            if (!mcpClient) {
              throw new Error("GitHub MCP server is disconnected. Please connect first.");
            }
            console.log(`Executing tool ${name} on behalf of Gemini...`);
            const mcpResponse = await mcpClient.callTool({
              name,
              arguments: args || {}
            });
            toolResult = mcpResponse;
          } catch (toolError) {
            console.error(`Error executing tool ${name}:`, toolError);
            toolResult = { error: toolError.message || `Failed to execute tool ${name}` };
          }
          
          responseParts.push({
            functionResponse: {
              name,
              response: { result: toolResult }
            }
          });
        }
        
        contents.push({
          role: 'user',
          parts: responseParts
        });
        
        continue;
      } else {
        currentResponse = modelContent;
        break;
      }
    }

    if (!currentResponse) {
      throw new Error('Reached maximum tool-calling recursion loops without a final response.');
    }

    res.json({
      success: true,
      message: currentResponse.parts?.[0]?.text || '',
      historyUpdate: contents.slice(messages.length)
    });

  } catch (error) {
    console.error('Error in /api/chat route:', error);
    res.status(500).json({ error: error.message || 'An error occurred during chat generation.' });
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
