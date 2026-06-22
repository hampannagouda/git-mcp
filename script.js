// GitMCP Studio Client JavaScript

// State variables
let tools = [];
let selectedTool = null;

// DOM Elements
const connectionScreen = document.getElementById('connection-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const connectForm = document.getElementById('connect-form');
const githubTokenInput = document.getElementById('github-token');
const toggleTokenBtn = document.getElementById('toggle-token-visibility');
const connectionError = document.getElementById('connection-error');
const connectSubmitBtn = document.getElementById('connect-submit');

const toolsList = document.getElementById('tools-list');
const toolsCount = document.getElementById('tools-count');
const toolSearchInput = document.getElementById('tool-search');
const disconnectBtn = document.getElementById('disconnect-btn');

const noToolSelected = document.getElementById('no-tool-selected');
const toolWorkspace = document.getElementById('tool-workspace');
const currentToolName = document.getElementById('current-tool-name');
const currentToolDesc = document.getElementById('current-tool-desc');
const toolForm = document.getElementById('tool-form');
const dynamicInputs = document.getElementById('dynamic-inputs');
const executeBtn = document.getElementById('execute-btn');

const outputMeta = document.getElementById('output-meta');
const statusBadge = document.getElementById('status-badge');
const executionTime = document.getElementById('execution-time');
const outputPlaceholder = document.getElementById('output-placeholder');
const outputLoader = document.getElementById('output-loader');
const outputRaw = document.getElementById('output-raw');
const outputCode = document.getElementById('output-code');
const outputRendered = document.getElementById('output-rendered');

// Initial Setup
document.addEventListener('DOMContentLoaded', async () => {
  // Check if server is already connected on page load
  try {
    const res = await fetch('/api/status');
    const status = await res.json();
    if (status.connected) {
      // Re-fetch tools and show dashboard
      connectSubmitBtn.classList.add('disabled');
      connectSubmitBtn.querySelector('.loader').classList.remove('hidden');
      
      const connectRes = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubToken: 'session' }) // will trigger backend fallback to env or current session
      });
      
      const data = await connectRes.json();
      if (connectRes.ok && data.success) {
        setupDashboard(data.tools);
      } else {
        showConnectionScreen();
      }
    }
  } catch (err) {
    console.error('Error checking initial status:', err);
  }
});

// Toggle Token Visibility
toggleTokenBtn.addEventListener('click', () => {
  const type = githubTokenInput.getAttribute('type') === 'password' ? 'text' : 'password';
  githubTokenInput.setAttribute('type', type);
  const eyeIcon = toggleTokenBtn.querySelector('svg');
  if (type === 'text') {
    eyeIcon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    `;
  } else {
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    `;
  }
});

// Connect to Server Form Submit
connectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const token = githubTokenInput.value.trim();
  if (!token) {
    showError('GitHub Personal Access Token is required.');
    return;
  }

  // UI state loading
  connectionError.classList.add('hidden');
  connectSubmitBtn.disabled = true;
  connectSubmitBtn.querySelector('span').innerText = 'Connecting...';
  connectSubmitBtn.querySelector('.loader').classList.remove('hidden');

  try {
    const response = await fetch('/api/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ githubToken: token }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Connection failed.');
    }

    // Success - transition screens
    setupDashboard(data.tools);
  } catch (error) {
    showError(error.message || 'Failed to connect to the GitHub MCP server.');
  } finally {
    connectSubmitBtn.disabled = false;
    connectSubmitBtn.querySelector('span').innerText = 'Connect Server';
    connectSubmitBtn.querySelector('.loader').classList.add('hidden');
  }
});

// Disconnect Button Click
disconnectBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/disconnect', { method: 'POST' });
    showConnectionScreen();
  } catch (err) {
    console.error('Error disconnecting:', err);
  }
});

// Tool Search Input
toolSearchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  renderToolsList(query);
});

// Execute Tool Form Submit
toolForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedTool) return;

  // Gather Form Arguments
  const args = {};
  const formElements = dynamicInputs.querySelectorAll('input, select, textarea');
  
  formElements.forEach(el => {
    const key = el.name;
    let value = el.value;
    
    if (el.type === 'checkbox') {
      value = el.checked;
    } else if (el.type === 'number') {
      value = value !== '' ? Number(value) : undefined;
    }
    
    // Only add defined values
    if (value !== '' && value !== undefined) {
      // Split arrays if parameter is array-type (e.g. labels)
      const schemaProp = selectedTool.inputSchema.properties[key];
      if (schemaProp && schemaProp.type === 'array' && typeof value === 'string') {
        args[key] = value.split(',').map(item => item.trim()).filter(Boolean);
      } else {
        args[key] = value;
      }
    }
  });

  // UI state execution loading
  outputPlaceholder.classList.add('hidden');
  outputRaw.classList.add('hidden');
  outputRendered.classList.add('hidden');
  outputMeta.classList.add('hidden');
  outputLoader.classList.remove('hidden');
  
  executeBtn.disabled = true;
  executeBtn.querySelector('span').innerText = 'Running...';
  executeBtn.querySelector('.loader').classList.remove('hidden');

  const startTime = performance.now();

  try {
    const response = await fetch('/api/call-tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: selectedTool.name,
        arguments: args,
      }),
    });

    const data = await response.json();
    const duration = Math.round(performance.now() - startTime);

    outputLoader.classList.add('hidden');
    outputMeta.classList.remove('hidden');
    executionTime.innerText = `${duration}ms`;

    if (!response.ok || !data.success) {
      showToolError(data.error || 'Execution failed.', duration);
      return;
    }

    showToolSuccess(data.result, duration);
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    outputLoader.classList.add('hidden');
    showToolError(error.message || 'Server error occurred during execution.', duration);
  } finally {
    executeBtn.disabled = false;
    executeBtn.querySelector('span').innerText = 'Execute Tool';
    executeBtn.querySelector('.loader').classList.add('hidden');
  }
});

// Setup Dashboard View
function setupDashboard(discoveredTools) {
  tools = discoveredTools;
  toolsCount.innerText = tools.length;
  
  connectionScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
  
  // Clear any old selection
  selectedTool = null;
  noToolSelected.classList.remove('hidden');
  toolWorkspace.classList.add('hidden');
  
  // Render sidebar tools list
  renderToolsList();
  
  // Clear outputs
  outputPlaceholder.classList.remove('hidden');
  outputRaw.classList.add('hidden');
  outputRendered.classList.add('hidden');
  outputMeta.classList.add('hidden');
}

// Show Connection Screen View
function showConnectionScreen() {
  dashboardScreen.classList.add('hidden');
  connectionScreen.classList.remove('hidden');
  githubTokenInput.value = '';
}

// Render Tools in Sidebar
function renderToolsList(query = '') {
  toolsList.innerHTML = '';
  
  const filteredTools = tools.filter(tool => {
    return tool.name.toLowerCase().includes(query) || 
           (tool.description && tool.description.toLowerCase().includes(query));
  });

  if (filteredTools.length === 0) {
    toolsList.innerHTML = `<li class="no-results" style="padding: 12px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No tools found</li>`;
    return;
  }

  filteredTools.forEach(tool => {
    const li = document.createElement('li');
    li.className = 'tool-item';
    if (selectedTool && selectedTool.name === tool.name) {
      li.classList.add('active');
    }

    li.innerHTML = `
      <div class="tool-item-name">${tool.name}</div>
      <div class="tool-item-desc" title="${tool.description || ''}">${tool.description || 'No description available'}</div>
    `;

    li.addEventListener('click', () => {
      selectTool(tool);
      // Mark active class in UI list
      document.querySelectorAll('.tool-item').forEach(item => item.classList.remove('active'));
      li.classList.add('active');
    });

    toolsList.appendChild(li);
  });
}

// Select a tool to display in workspace
function selectTool(tool) {
  selectedTool = tool;
  
  noToolSelected.classList.add('hidden');
  toolWorkspace.classList.remove('hidden');
  
  currentToolName.innerText = tool.name;
  currentToolDesc.innerText = tool.description || 'No description available';
  
  // Clear outputs
  outputPlaceholder.classList.remove('hidden');
  outputRaw.classList.add('hidden');
  outputRendered.classList.add('hidden');
  outputMeta.classList.add('hidden');

  // Dynamic Form Generation
  generateFormInputs(tool.inputSchema);
}

// Generate HTML form elements from JSON Schema properties
function generateFormInputs(schema) {
  dynamicInputs.innerHTML = '';
  if (!schema || !schema.properties) {
    dynamicInputs.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No parameters required for this tool.</p>`;
    return;
  }

  const properties = schema.properties;
  const requiredFields = schema.required || [];

  Object.keys(properties).forEach(key => {
    const prop = properties[key];
    const isRequired = requiredFields.includes(key);
    
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    // Label creation
    const label = document.createElement('label');
    label.htmlFor = `input-${key}`;
    label.innerHTML = `${key} ${isRequired ? '<span style="color: var(--color-error)">*</span>' : ''}`;
    formGroup.appendChild(label);

    // Form control generation based on type
    let inputEl;

    if (prop.type === 'boolean') {
      formGroup.className = 'form-group form-group-checkbox';
      inputEl = document.createElement('input');
      inputEl.type = 'checkbox';
      inputEl.id = `input-${key}`;
      inputEl.name = key;
      
      // Re-order label and checkbox for UI layout
      formGroup.innerHTML = '';
      formGroup.appendChild(inputEl);
      formGroup.appendChild(label);
    } else if (prop.type === 'integer' || prop.type === 'number') {
      inputEl = document.createElement('input');
      inputEl.type = 'number';
      inputEl.id = `input-${key}`;
      inputEl.name = key;
      if (prop.minimum !== undefined) inputEl.min = prop.minimum;
      if (prop.maximum !== undefined) inputEl.max = prop.maximum;
    } else if (key === 'content' || key === 'body' || key === 'description' || (prop.type === 'string' && prop.maxLength > 200)) {
      // Create Textarea for multi-line inputs
      inputEl = document.createElement('textarea');
      inputEl.id = `input-${key}`;
      inputEl.name = key;
      inputEl.rows = 4;
      inputEl.placeholder = `Enter ${key}...`;
    } else {
      // Standard input
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.id = `input-${key}`;
      inputEl.name = key;
      inputEl.placeholder = prop.type === 'array' ? 'item1, item2, item3' : `Enter ${key}...`;
    }

    if (isRequired && prop.type !== 'boolean') {
      inputEl.required = true;
    }

    // Add form control to group
    if (prop.type !== 'boolean') {
      formGroup.appendChild(inputEl);
    }

    // Help/Description text
    if (prop.description) {
      const helpText = document.createElement('span');
      helpText.className = 'help-text';
      helpText.innerText = prop.description;
      formGroup.appendChild(helpText);
    }

    dynamicInputs.appendChild(formGroup);
  });
}

// Display Error response
function showToolError(errorMsg, duration) {
  statusBadge.className = 'response-badge error';
  statusBadge.innerText = 'Error';
  executionTime.innerText = `${duration}ms`;

  outputRaw.classList.remove('hidden');
  outputRendered.classList.add('hidden');
  
  outputCode.innerHTML = `<span style="color: var(--color-error); font-weight: bold;">API Error:</span>\n${escapeHtml(errorMsg)}`;
}

// Display Success response
function showToolSuccess(mcpResult, duration) {
  statusBadge.className = 'response-badge success';
  statusBadge.innerText = 'Success';
  executionTime.innerText = `${duration}ms`;

  // Raw JSON representation
  outputRaw.classList.remove('hidden');
  outputCode.innerHTML = syntaxHighlightJson(mcpResult);

  // Attempt custom visual rendering
  const renderedHTML = tryRenderVisualMarkup(selectedTool.name, mcpResult);
  if (renderedHTML) {
    outputRendered.innerHTML = renderedHTML;
    outputRendered.classList.remove('hidden');
  } else {
    outputRendered.classList.add('hidden');
  }
}

// Helper to escape HTML characters
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Custom JSON syntax highlighting function
function syntaxHighlightJson(jsonObj) {
  if (typeof jsonObj !== 'string') {
    jsonObj = JSON.stringify(jsonObj, null, 2);
  }
  
  jsonObj = escapeHtml(jsonObj);
  
  return jsonObj.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

// Try to generate visual cards, tables, directory listing instead of raw JSON
function tryRenderVisualMarkup(toolName, response) {
  // Extract results content from MCP result format
  // Stdio reference servers return array content e.g. [{ type: 'text', text: '...' }]
  if (!response || !response.content || !response.content[0] || response.content[0].type !== 'text') {
    return null;
  }

  const textPayload = response.content[0].text;
  let parsed = null;

  try {
    parsed = JSON.parse(textPayload);
  } catch (e) {
    // If it's not valid JSON, but plain text, check if it's file content
    if (toolName.includes('get_file_content') || toolName.includes('get_readme')) {
      return `
        <div class="file-viewer-container">
          <div class="file-viewer-header">
            <span class="file-name">Raw File Stream</span>
          </div>
          <pre class="file-content-pre">${escapeHtml(textPayload)}</pre>
        </div>
      `;
    }
    return null;
  }

  // Visual formatting for 'github_list_repos' or similar
  if ((toolName.includes('list_repos') || toolName.includes('search_repositories')) && Array.isArray(parsed)) {
    if (parsed.length === 0) return '<p style="color: var(--text-muted);">No repositories found.</p>';
    
    let html = '<div class="list-results-container">';
    html += `<h4 style="margin-bottom: 12px; font-weight: 600;">Repository Listing (${parsed.length})</h4>`;
    
    parsed.forEach(repo => {
      const name = repo.full_name || repo.name || 'Unnamed Repo';
      const url = repo.html_url || '#';
      const desc = repo.description || 'No description provided.';
      const stars = repo.stargazers_count !== undefined ? repo.stargazers_count : (repo.stars || 0);
      const forks = repo.forks_count !== undefined ? repo.forks_count : (repo.forks || 0);
      const language = repo.language || 'N/A';
      const isPrivate = repo.private ? 'Private' : 'Public';
      
      html += `
        <div class="result-card" style="position: relative;">
          <div class="result-card-header" style="padding-right: 32px;">
            <span class="result-card-title"><a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a></span>
            <span class="result-card-badge">${isPrivate}</span>
          </div>
          <p class="result-card-desc">${escapeHtml(desc)}</p>
          <div class="result-card-footer">
            <span class="result-card-footer-item">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: gold"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              ${stars}
            </span>
            <span class="result-card-footer-item">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: lightblue"><path d="M12 2v8M17 5H7M5 19h14M19 14H5"></path></svg>
              ${forks}
            </span>
            <span class="result-card-footer-item">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background: var(--color-primary); margin-right:4px;"></span>
              ${language}
            </span>
          </div>
          <button class="icon-button-small delete-repo-card-btn" 
                  data-owner="${escapeHtml(repo.owner?.login || name.split('/')[0] || '')}" 
                  data-repo="${escapeHtml(repo.name || name.split('/')[1] || '')}" 
                  title="Delete Repository" 
                  style="position: absolute; top: 12px; right: 12px; color: var(--color-error); z-index: 5;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }

  // Visual formatting for single 'repo_info' metadata
  if (toolName.includes('repo_info') && parsed && typeof parsed === 'object') {
    const name = parsed.full_name || parsed.name || 'Repository';
    const stars = parsed.stargazers_count || 0;
    const forks = parsed.forks_count || 0;
    const watchers = parsed.watchers_count || 0;
    const openIssues = parsed.open_issues_count || 0;
    const subCount = parsed.subscribers_count || 0;
    const language = parsed.language || 'N/A';
    const size = parsed.size || 0;
    
    return `
      <div class="list-results-container">
        <h4 style="margin-bottom: 16px; font-weight: 600; color: var(--color-secondary); font-size: 1.2rem;">${escapeHtml(name)}</h4>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-card-label">Primary Language</div>
            <div class="info-card-value">${language}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">Stars</div>
            <div class="info-card-value">${stars}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">Forks</div>
            <div class="info-card-value">${forks}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">Open Issues</div>
            <div class="info-card-value">${openIssues}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">Watchers</div>
            <div class="info-card-value">${watchers}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">Size (KB)</div>
            <div class="info-card-value card-value-mono">${size}</div>
          </div>
        </div>
        ${parsed.description ? `<p class="result-card-desc" style="padding: 16px; background: rgba(255,255,255,0.02); border-radius:8px;">${escapeHtml(parsed.description)}</p>` : ''}
      </div>
    `;
  }

  // Visual formatting for list directory content
  if (toolName.includes('list_contents') && Array.isArray(parsed)) {
    if (parsed.length === 0) return '<p style="color: var(--text-muted);">This directory is empty.</p>';
    
    let html = '<div class="list-results-container">';
    html += '<h4 style="margin-bottom: 12px; font-weight: 600;">Directory Contents</h4>';
    html += '<div style="display:flex; flex-direction:column; gap:4px; max-height: 400px; overflow-y:auto; border: 1px solid var(--glass-border); border-radius: 8px; background: rgba(0,0,0,0.15)">';
    
    // Sort directories first, then files
    const sortedContents = [...parsed].sort((a, b) => {
      const typeA = a.type || '';
      const typeB = b.type || '';
      if (typeA === 'dir' && typeB !== 'dir') return -1;
      if (typeA !== 'dir' && typeB === 'dir') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    sortedContents.forEach(item => {
      const name = item.name || '';
      const type = item.type || 'file';
      const size = item.size !== undefined ? `${(item.size / 1024).toFixed(1)} KB` : '';
      const icon = type === 'dir' 
        ? `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(45, 90%, 55%); margin-right:8px; vertical-align:middle;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(200, 20%, 70%); margin-right:8px; vertical-align:middle;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;

      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--glass-border); font-family: var(--font-mono); font-size: 0.85rem;">
          <span style="color: ${type === 'dir' ? 'white' : 'var(--text-secondary)'}">${icon}${escapeHtml(name)}</span>
          <span style="color: var(--text-muted); font-size: 0.75rem;">${type === 'dir' ? 'Folder' : size}</span>
        </div>
      `;
    });
    
    html += '</div></div>';
    return html;
  }

  // Visual formatting for Issues or Pull Requests listing
  if ((toolName.includes('get_issue') || toolName.includes('list_issues') || toolName.includes('search_issues') || toolName.includes('get_pull_request')) && parsed) {
    // If list of issues
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return '<p style="color: var(--text-muted);">No issues or pull requests found.</p>';
      
      let html = '<div class="list-results-container">';
      html += `<h4 style="margin-bottom: 12px; font-weight: 600;">Issues / Pull Requests (${parsed.length})</h4>`;
      
      parsed.forEach(issue => {
        const title = issue.title || 'Untitled';
        const num = issue.number || '';
        const state = issue.state || 'open';
        const author = issue.user ? (issue.user.login || '') : '';
        const date = issue.created_at ? new Date(issue.created_at).toLocaleDateString() : '';
        const badgeColor = state === 'open' ? 'var(--color-success)' : 'var(--text-muted)';
        
        html += `
          <div class="result-card">
            <div class="result-card-header">
              <span class="result-card-title" style="color: #fff;"><span style="color:var(--text-muted)">#${num}</span> ${escapeHtml(title)}</span>
              <span class="result-card-badge" style="color: ${badgeColor}; border-color: ${badgeColor}30; background: ${badgeColor}10">${state.toUpperCase()}</span>
            </div>
            <div class="result-card-footer">
              <span>Opened by: <strong>@${escapeHtml(author)}</strong></span>
              <span>on ${date}</span>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
      return html;
    }
    
    // Single Issue Details
    if (typeof parsed === 'object') {
      const title = parsed.title || 'Untitled';
      const num = parsed.number || '';
      const state = parsed.state || 'open';
      const body = parsed.body || 'No description provided.';
      const author = parsed.user ? (parsed.user.login || '') : '';
      const date = parsed.created_at ? new Date(parsed.created_at).toLocaleDateString() : '';
      const comments = parsed.comments || 0;
      const badgeColor = state === 'open' ? 'var(--color-success)' : 'var(--text-muted)';

      return `
        <div class="list-results-container">
          <div class="result-card" style="background: rgba(255, 255, 255, 0.02)">
            <div class="result-card-header" style="border-bottom: 1px solid var(--glass-border); padding-bottom:12px; margin-bottom:16px;">
              <h4 style="font-size: 1.15rem; font-weight: 700; color: #fff;"><span style="color:var(--text-muted)">#${num}</span> ${escapeHtml(title)}</h4>
              <span class="result-card-badge" style="color: ${badgeColor}; border-color: ${badgeColor}30; background: ${badgeColor}10">${state.toUpperCase()}</span>
            </div>
            <div class="result-card-desc" style="white-space: pre-wrap; font-family: inherit; font-size:0.9rem; padding: 12px; background: rgba(0,0,0,0.2); border-radius:6px; max-height:240px; overflow-y:auto; margin-bottom:16px;">${escapeHtml(body)}</div>
            <div class="result-card-footer">
              <span>Opened by: <strong>@${escapeHtml(author)}</strong></span>
              <span>on ${date}</span>
              <span>Comments: <strong>${comments}</strong></span>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Visual formatting for creating files or updates
  if (toolName.includes('create_or_update_file') && parsed) {
    const commit = parsed.commit || {};
    const content = parsed.content || {};
    
    return `
      <div class="list-results-container">
        <div class="result-card" style="background: var(--color-success-glow); border-color: var(--color-success);">
          <div class="result-card-header">
            <span class="result-card-title" style="color: var(--color-success);">✔ File Operation Successful</span>
          </div>
          <p class="result-card-desc" style="margin-bottom: 8px;">File: <strong>${escapeHtml(content.path || 'Unknown')}</strong> has been successfully committed.</p>
          <div class="result-card-footer" style="color: var(--text-secondary);">
            <span>Commit SHA: <code style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-family:var(--font-mono)">${commit.sha ? commit.sha.substring(0, 7) : 'N/A'}</code></span>
          </div>
        </div>
      </div>
    `;
  }

  // Visual formatting for delete repository
  if (toolName.includes('delete_repository') && parsed) {
    return `
      <div class="list-results-container">
        <div class="result-card" style="background: var(--color-error-glow); border-color: var(--color-error);">
          <div class="result-card-header">
            <span class="result-card-title" style="color: var(--color-error); font-weight: bold;">🗑 Repository Deleted</span>
          </div>
          <p class="result-card-desc" style="margin-bottom: 8px;">${escapeHtml(parsed.message || 'The repository has been successfully deleted.')}</p>
        </div>
      </div>
    `;
  }

  return null;
}

// Show validation or connection errors
function showError(msg) {
  connectionError.querySelector('.error-message').innerText = msg;
  connectionError.classList.remove('hidden');
}

// ==========================================================================
// Gemini Chatbot Client Logic
// ==========================================================================

let chatHistory = [];

const chatbotFab = document.getElementById('chatbot-fab');
const chatbotDrawer = document.getElementById('chatbot-drawer');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatSettingsBtn = document.getElementById('chat-settings-btn');
const chatSettingsPanel = document.getElementById('chat-settings-panel');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const saveChatSettingsBtn = document.getElementById('save-chat-settings-btn');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatStatusIndicator = document.getElementById('chat-status-indicator');
const chatStatusText = document.getElementById('chat-status-text');
const chatInputForm = document.getElementById('chat-input-form');
const chatUserInput = document.getElementById('chat-user-input');

// Initialize settings
if (localStorage.getItem('gemini_api_key')) {
  geminiApiKeyInput.value = localStorage.getItem('gemini_api_key');
}

// Toggle Chat Drawer
chatbotFab.addEventListener('click', () => {
  chatbotDrawer.classList.toggle('hidden');
  chatbotFab.querySelector('.fab-badge').classList.add('hidden');
  if (!chatbotDrawer.classList.contains('hidden')) {
    chatUserInput.focus();
    scrollToBottom();
  }
});

chatCloseBtn.addEventListener('click', () => {
  chatbotDrawer.classList.add('hidden');
});

// Toggle settings panel
chatSettingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  chatSettingsPanel.classList.toggle('hidden');
});

// Save settings key
saveChatSettingsBtn.addEventListener('click', () => {
  const key = geminiApiKeyInput.value.trim();
  if (key) {
    localStorage.setItem('gemini_api_key', key);
  } else {
    localStorage.removeItem('gemini_api_key');
  }
  chatSettingsPanel.classList.add('hidden');
});

// Auto-resize input textarea
chatUserInput.addEventListener('input', () => {
  chatUserInput.style.height = 'auto';
  chatUserInput.style.height = (chatUserInput.scrollHeight) + 'px';
});

// Suggestion Chips
document.querySelectorAll('.chat-quick-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const query = chip.getAttribute('data-query');
    sendChatMessage(query);
  });
});

// Form submission
chatInputForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatUserInput.value.trim();
  if (!text) return;
  sendChatMessage(text);
  chatUserInput.value = '';
  chatUserInput.style.height = 'auto';
});

// Send message to backend API
async function sendChatMessage(text) {
  // Append user message to UI
  appendChatMessage('user', text);
  
  // Set up loading state
  chatStatusText.innerText = 'Thinking...';
  chatStatusIndicator.classList.remove('hidden');
  scrollToBottom();

  const apiKey = localStorage.getItem('gemini_api_key') || '';
  
  // Add to local history
  chatHistory.push({ role: 'user', content: text });

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: chatHistory,
        apiKey: apiKey
      })
    });

    const data = await response.json();
    chatStatusIndicator.classList.add('hidden');

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to get response from Gemini.');
    }

    // Append AI response to UI
    appendChatMessage('bot', data.message);
    
    // Update local history with backend's update
    if (data.historyUpdate && Array.isArray(data.historyUpdate)) {
      chatHistory = chatHistory.concat(data.historyUpdate);
    } else {
      chatHistory.push({ role: 'model', content: data.message });
    }

  } catch (error) {
    chatStatusIndicator.classList.add('hidden');
    appendChatMessage('bot', `Error: ${error.message}`, true);
    chatHistory.pop();
  }
  scrollToBottom();
}

// Append a message bubble to the container
function appendChatMessage(role, text, isError = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  if (isError) {
    bubbleDiv.style.color = 'var(--color-error)';
    bubbleDiv.style.borderColor = 'var(--color-error-glow)';
    bubbleDiv.style.background = 'var(--color-error-glow)';
  }
  
  bubbleDiv.innerHTML = role === 'bot' ? formatMarkdown(text) : escapeHtml(text);
  messageDiv.appendChild(bubbleDiv);
  
  chatMessagesContainer.appendChild(messageDiv);
}

// Scroll messages to bottom
function scrollToBottom() {
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Render markdown logic
function formatMarkdown(text) {
  let html = escapeHtml(text);
  
  // Replace code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });
  
  // Replace inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Replace bold: **text**
  html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
  
  // Replace bullet points
  html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  // Replace line breaks outside pre blocks
  const parts = html.split(/(<pre>[\s\S]*?<\/pre>)/g);
  html = parts.map(part => {
    if (part.startsWith('<pre>')) return part;
    return part.replace(/\n/g, '<br>');
  }).join('');
  
  return html;
}

// Event delegation for visual card delete button clicks
document.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.delete-repo-card-btn');
  if (deleteBtn) {
    e.preventDefault();
    const owner = deleteBtn.getAttribute('data-owner');
    const repo = deleteBtn.getAttribute('data-repo');
    
    // Switch to delete repository tool
    const deleteTool = tools.find(t => t.name === 'delete_repository');
    if (deleteTool) {
      selectTool(deleteTool);
      
      // Update sidebar active status
      document.querySelectorAll('.tool-item').forEach(item => {
        const nameEl = item.querySelector('.tool-item-name');
        if (nameEl && nameEl.innerText === 'delete_repository') {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
      
      // Populate inputs with short delay for DOM rendering
      setTimeout(() => {
        const ownerInput = document.getElementById('input-owner');
        const repoInput = document.getElementById('input-repo');
        if (ownerInput) ownerInput.value = owner;
        if (repoInput) repoInput.value = repo;
        
        // Scroll workspace into view
        document.getElementById('tool-workspace').scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }
});
