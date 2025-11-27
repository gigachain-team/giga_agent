# AGENTS.md - Guide for AI Agents

This document provides instructions for AI agents on how to properly start and work with the GigaAgent project.

## Project Overview

GigaAgent is a multi-service AI agent application that consists of 5 services that need to run simultaneously:

1. **REPL Service** (Port 9090) - Jupyter-like environment for executing LLM-generated code
2. **Upload Server** (Port 9092) - File handling service
3. **Tool Server** (Port 8811) - Secure gateway for tool invocation, holds API keys
4. **LangGraph Server** (Port 2024) - Orchestrates multi-agent workflows
5. **Frontend** (Port 3000) - React web UI for chat interface

## Prerequisites

Before starting, ensure the following ports are free: 2024, 8811, 9090, 9092, 3000

Required tools:
- uv (Python package manager)
- npm (Node.js package manager)
- direnv (optional, for environment variable management)

## Quick Start

### Step 1: Set Up Environment Variables

The project uses a `.envrc` file in the root directory for environment variables. This file should contain all necessary API keys and configuration.

**Important**: When sourcing the `.envrc` file in shell commands, use `set -a` to export all variables:

```bash
set -a && source /path/to/giga_agent/.envrc && set +a
```

Simply using `source .envrc` will NOT export the variables to child processes.

### Step 2: Initialize Files

```bash
cd /path/to/giga_agent
direnv allow  # If using direnv
make init_files
```

This copies mock data files to the `files/` directory.

### Step 3: Install Dependencies

For REPL backend:
```bash
cd backend/repl
uv sync
```

For Graph backend:
```bash
cd backend/graph
uv sync
```

For Frontend:
```bash
cd front
npm install
```

### Step 4: Start All Services

You need to start 5 services in separate terminal sessions. Each service should run in the background.

**Service 1 - REPL Service:**
```bash
cd backend/repl
set -a && source /path/to/giga_agent/.envrc && set +a && make run
```

**Service 2 - Upload Server:**
```bash
cd backend/repl
set -a && source /path/to/giga_agent/.envrc && set +a && make run_u
```

**Service 3 - Tool Server:**
```bash
cd backend/graph
set -a && source /path/to/giga_agent/.envrc && set +a && make run_tool_server
```

**Service 4 - LangGraph Server:**
```bash
cd backend/graph
set -a && source /path/to/giga_agent/.envrc && set +a && make run_graph
```

**Service 5 - Frontend:**
```bash
cd front
make dev
```

### Step 5: Access the Web UI

Open a browser and navigate to: http://localhost:3000/

The interface includes:
- Sidebar with navigation (New chat, Print, Demo settings, Auto Approve)
- QR code for mobile access
- Chat input field at the bottom

## Verification

To verify the application is working:

1. Open http://localhost:3000/ in a browser
2. Type a message in the chat input (e.g., "Hello")
3. Click the send button
4. Wait for the AI response (you should see "Thinking..." / "Думаю..." while processing)
5. A successful response confirms all services are connected

## Common Issues and Solutions

### Issue: "GIGA_AGENT_LLM is empty" Error

**Cause**: Environment variables are not being exported properly.

**Solution**: Use `set -a` before sourcing the `.envrc` file:
```bash
set -a && source /path/to/giga_agent/.envrc && set +a && make run_tool_server
```

### Issue: Port Already in Use

**Solution**: Check which process is using the port and kill it:
```bash
lsof -i :PORT_NUMBER
kill -9 PID
```

### Issue: Dependencies Not Found

**Solution**: Run the sync commands:
```bash
cd backend/repl && uv sync
cd backend/graph && uv sync
cd front && npm install
```

## Key Environment Variables

The following environment variables are required in `.envrc`:

| Variable | Description |
|----------|-------------|
| `GIGA_AGENT_LLM` | Main LLM model (e.g., `gigachat:GigaChat-2-Max`) |
| `GIGA_AGENT_LLM_FAST` | Fast LLM for simple tasks (e.g., `gigachat:GigaChat-2-Pro`) |
| `GIGA_AGENT_EMBEDDINGS` | Embeddings model |
| `GIGACHAT_CREDENTIALS` | GigaChat API credentials |
| `LANGSMITH_API_KEY` | LangSmith API key for tracing |

Optional service API keys:
- `TAVILY_API_KEY` - Web search functionality
- `VK_TOKEN` - VK integration
- `GITHUB_PERSONAL_ACCESS_TOKEN` - GitHub tools
- `IMAGE_GEN_NAME` - Image generation provider

## Project Structure

```
giga_agent/
├── backend/
│   ├── graph/           # Main agent orchestration
│   │   ├── giga_agent/  # Core agent code
│   │   └── langgraph.json
│   └── repl/            # Code execution environment
├── front/               # React frontend
├── env_examples/        # Configuration templates
├── files/               # Mock data directory
├── .envrc               # Environment variables (local)
└── Makefile             # Build commands
```

## Service Dependencies

The services have the following startup order dependencies:

1. REPL Service and Upload Server can start independently
2. Tool Server depends on environment variables being set
3. LangGraph Server depends on Tool Server being available
4. Frontend can start independently but requires backend services for full functionality

## Docker Alternative

For production or simpler setup, you can use Docker:

```bash
pip install langgraph-cli
make init_files
# Fill .docker.env with environment variables
make build_graph
docker compose up -d
```

The Docker deployment will be available at http://localhost:8502
