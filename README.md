# GitMCP Studio

An interactive, premium web client dashboard for connecting to the official GitHub Model Context Protocol (MCP) server. 

GitMCP Studio automatically discovers all tools exposed by the GitHub MCP server and generates dynamic parameter forms based on their JSON Schemas, allowing you to run all GitHub operations (managing repositories, code search, file CRUD, issues/PR lifecycles) in a stunning user-friendly interface.

---

## ✨ Features

- **Dynamic Schema Forms:** Auto-generates form controls (text, checkbox, numbers, textareas) and validations matching any tool's JSON Schema.
- **Rich Visualization Cards:** Maps raw JSON responses to custom visual rendering panels for:
  - Repository listings (stars, forks, languages, privacy badges).
  - Directory folder structures with file icons.
  - Code search results and file views.
  - Issues & Pull Requests details.
- **Curated Dark Theme:** Premium glassmorphism UI with Outfit typography, glowing background filters, and soft glowing components.
- **Syntax Coloring:** Raw output responses are pretty-printed with custom JSON key-value styling.
- **Self-Contained Portable Node.js:** Packaged with a local, portable Node.js environment (in `node_bin/`), removing any global dependency requirements.

---

## 📂 Project Structure

```text
git-mcp/
├── node_bin/             # Portable Node.js binaries (node, npm, npx)
├── node_modules/         # Locally installed project dependencies & GitHub MCP server
├── index.html            # Core frontend dashboard layout
├── styles.css            # Custom glassmorphic styles, animations, and typography
├── script.js             # Client-side API coordinator and dynamic form builder
├── server.js             # Express backend server linking the MCP client subprocess
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
1. Get a GitHub **Personal Access Token (PAT)**. If you need one, click the link on the connection screen to create a token with `repo`, `public_repo`, and `read:user` scopes.
2. Paste your token into the input field and click **Connect Server**.
3. Once connected, select any tool in the sidebar to execute operations!

---

## 🔒 Security Note

- All API operations are processed **locally** on your computer.
- Your GitHub token is only stored in the backend's active subprocess memory and is never transmitted to any third-party analytics or server besides GitHub.
