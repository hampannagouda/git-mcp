# GitMCP Studio

An interactive, premium web client dashboard for connecting to the official GitHub Model Context Protocol (MCP) server. 

GitMCP Studio automatically discovers all tools exposed by the GitHub MCP server and generates dynamic parameter forms based on their JSON Schemas, allowing you to run all GitHub operations (managing repositories, code search, file CRUD, issues/PR lifecycles) in a stunning user-friendly interface.

---

## ✨ Features

- **Gemini AI Chatbot ("GitMCP Copilot"):** A modern, glassmorphic floating chatbot powered by the Gemini API. Copilot has access to all your registered GitHub MCP tools!
  - **Dynamic Function Calling:** Ask Copilot in plain English to *"list my repositories"*, *"search code for auth patterns"*, or *"create a readme file"*, and it will execute the appropriate MCP tools automatically.
  - **Robust Fallback & Retry System:** Features automatic retries for rate limits and gracefully falls back between `gemini-2.5-flash`, `gemini-2.0-flash`, and `gemini-3.5-flash` in case of high demand (503) errors.
  - **Markdown Rendering:** Displays code snippets, bold formatting, lists, and responses beautifully.
- **Repository Deletion Tool:** Built-in repository deletion capability extended directly into the GitHub MCP server.
  - **Visual Shortcut Button:** A "Delete" trash icon on each listed repository card automatically configures the workspace to the `delete_repository` tool.
  - **Destructive Safety Confirmations:** Systems check to confirm actions before invoking the API.
- **Dynamic Schema Forms:** Auto-generates form controls (text, checkbox, numbers, textareas) and validations matching any tool's JSON Schema.
- **Rich Visualization Cards:** Maps raw JSON responses to custom visual rendering panels (repositories, directories, issues/PRs).
- **Curated Dark Theme:** Premium glassmorphism UI with Outfit typography, glowing background filters, and soft glowing components.
- **Self-Contained Portable Node.js:** Packaged with a local, portable Node.js environment (in `node_bin/`), removing any global dependency requirements.

---

## 📂 Project Structure

```text
git-mcp/
├── node_bin/             # Portable Node.js binaries (node, npm, npx)
├── node_modules/         # Locally installed project dependencies & GitHub MCP server
├── .env                  # Environment file for GEMINI_API_KEY (optional)
├── index.html            # Core frontend dashboard layout & chatbot widgets
├── styles.css            # Custom glassmorphic styles, chat drawers, and animations
├── script.js             # Client-side API coordinator, chatbot logic, and form builder
├── server.js             # Express backend server, chatbot loop, and MCP subprocess coordinator
├── package.json          # Node.js manifest and dependencies
├── .gitignore            # Excludes logs, portable binaries, and modules
├── commands.md           # History of PowerShell commands used for the setup
└── README.md             # Project overview and instructions (this file)
```

---

## 🚀 Getting Started

The application runs entirely locally on your machine.

### 1. Start the Server
Open your terminal in the `git-mcp` directory and run:
```powershell
.\node_bin\node.exe server.js
```
*The server will boot up and print:*
`GitMCP Studio Server is running at http://localhost:3000`

### 2. Access the Dashboard
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

### 3. Connect to GitHub MCP
1. Get a GitHub **Personal Access Token (PAT)**. Click the link on the connection screen to create a token.
   > [!IMPORTANT]
   > Ensure your token has the **`delete_repo`** scope enabled if you want to delete repositories.
2. Paste your token into the input field and click **Connect Server**.

### 4. Configure Gemini AI Chatbot
You can provide your Gemini API key in two ways:
* **Option A (Web Settings):** Open the chatbot drawer in the bottom-right corner, click the **Settings icon** (⚙️ cog) in the header, paste your key, and click **Save Settings**.
* **Option B (Environment File):** Create a `.env` file in the root folder and add:
  ```env
  GEMINI_API_KEY=your_gemini_api_key
  ```
  Restart the server to apply.

---

## 🔒 Security Note

- All API operations are processed **locally** on your computer.
- Your GitHub token is stored only in the backend's active subprocess memory.
- Your Gemini API key is either stored locally in your browser's session storage or in your local `.env` file, and is sent directly to Google's official developer API.
