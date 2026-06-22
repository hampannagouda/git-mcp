# GitMCP Studio Setup & Execution Commands

This file contains all the PowerShell commands executed to check the environment, install the portable Node.js environment, install dependencies, and launch the application.

---
to run the  application .\node_bin\node.exe server.js

## 1. System Environment Diagnostics
These commands were run to identify if Node.js/NPM was installed, detect the active port usages, and check the Python runtime.

```powershell
# Check if Node or NPM is available in the system PATH
where.exe node

# Search standard locations for node.exe and npm.cmd
Test-Path "$env:ProgramFiles\nodejs\node.exe"
Test-Path "${env:ProgramFiles(x86)}\nodejs\node.exe"
Test-Path "$env:APPDATA\npm\npm.cmd"

# Search user AppData and Program Files for any local node installations
Get-ChildItem -Path $env:LOCALAPPDATA -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue
Get-ChildItem -Path $env:APPDATA -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue
Get-ChildItem -Path "C:\Program Files" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue

# Verify python and pip version
python --version
pip --version

# Check which processes are running on port 8000 (from browser state metadata)
netstat -ano | findstr :8000
Get-Process -Id 2276, 26028
```

---

## 2. Portable Node.js Installation
Since no global Node.js environment was present, these commands download Node.js LTS, extract it locally, and clean up temporary archives.

```powershell
# Create a binary folder for local Node.js binaries
New-Item -ItemType Directory -Force -Path "node_bin"

# Download official Node.js v20.12.2 Windows zip archive
Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip" -OutFile "node_bin\node.zip"

# Extract archive content to a temporary location
Expand-Archive -Path "node_bin\node.zip" -DestinationPath "node_bin\temp"

# Move the binary files into the local bin directory
Move-Item -Path "node_bin\temp\node-v20.12.2-win-x64\*" -Destination "node_bin"

# Clean up the zip file and temporary extraction directory
Remove-Item -Recurse -Force "node_bin\temp", "node_bin\node.zip"
```

---

## 3. Package and Dependency Installation
Commands used to install dependencies listed in `package.json` and add the `@modelcontextprotocol/server-github` server package.

```powershell
# Install the core project dependencies (Express, MCP SDK, Dotenv)
.\node_bin\npm.cmd install

# Add the official GitHub MCP server package to local node_modules
.\node_bin\npm.cmd install @modelcontextprotocol/server-github
```

---

## 4. Run the Application Backend
The command used to boot up the Express server.

```powershell
# Start the Express server on port 3000 using the local portable runtime
.\node_bin\node.exe server.js
```
