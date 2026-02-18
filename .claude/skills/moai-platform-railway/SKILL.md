---
name: moai-platform-railway
description: >
  Railway CLI deployment management specialist for autonomous deployment operations.
  Use when deploying to Railway, managing environment variables, viewing deployment logs,
  debugging production issues, redeploying services, restarting containers, or managing
  Railway environments. Covers Railway CLI v4 commands for project management, deployment
  workflows, variable management, log analysis, and autonomous debugging patterns.
license: Apache-2.0
compatibility: Designed for Claude Code
allowed-tools: Read Grep Glob Bash
user-invocable: false
metadata:
  version: "1.0.0"
  category: "platform"
  status: "active"
  updated: "2026-02-17"
  modularized: "false"
  tags: "railway, deploy, deployment, logs, environment variables, production, staging, containers, docker, cli, devops"
  related-skills: "moai-platform-deployment"
  aliases: "railway-cli, railway-deploy"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 4800

# MoAI Extension: Triggers
triggers:
  keywords: ["railway", "deploy", "deployment", "logs", "environment variable", "env var", "production", "staging", "redeploy", "restart", "railway logs", "railway up", "railway variable"]
  agents: ["expert-devops", "expert-debug", "expert-backend"]
  phases: ["run", "sync"]
---

# Railway CLI Deployment Management

Autonomous Railway CLI operations reference for MoAI agents. Covers the complete lifecycle of Railway deployments: authentication, project management, deployment, environment variables, log analysis, debugging, and safety protocols.

Railway CLI binary: /opt/homebrew/bin/railway (v4.30.2)

---

## Quick Reference

### Essential Commands

**Authentication and Status**:
- `railway whoami` - Verify authenticated user
- `railway status` - Show linked project and service info
- `railway list` - List all projects

**Deployment**:
- `railway up` - Deploy current directory
- `railway up --detach` - Deploy without streaming logs
- `railway redeploy` - Redeploy latest deployment
- `railway restart` - Restart a service
- `railway down` - Remove latest deployment (CAUTION)

**Environment Variables**:
- `railway variable list` - List all variables
- `railway variable set KEY=value` - Set a variable
- `railway variable delete KEY` - Delete a variable

**Logs and Debugging**:
- `railway logs` - Stream deployment logs
- `railway logs --build` - View build logs
- `railway logs -n 100` - View last 100 lines

**Service Targeting**:
- `-s, --service` flag targets a specific service by name or ID
- `-e, --environment` flag targets a specific environment
- `--json` flag outputs in JSON format for programmatic parsing

---

## Prerequisites and Setup

Before any Railway operation, verify the CLI is available and authenticated:

```bash
which railway          # Expected: /opt/homebrew/bin/railway
railway whoami         # Expected: bjw202
railway status         # Shows project name, environment, service info
```

If `railway whoami` fails, re-authenticate with `railway login` (or `railway login --browserless` for headless/CI).

**Project Linking**: Use `railway link` to link the current directory to a Railway project. Use `railway unlink` to disconnect.

**CI/CD Token Setup**: Set `RAILWAY_TOKEN` environment variable for automated deployments (no `railway login` needed). In GitHub Actions, store it as a repository secret.

---

## Deployment Workflow Patterns

**Pattern 1 - Git Push Auto-Deploy** (default for this project): Push to main triggers auto-deploy. Verify with `railway logs -n 50` after 30-60 seconds.

**Pattern 2 - Manual CLI Deploy**: `railway up` (blocking with log stream) or `railway up --detach` (non-blocking).

**Pattern 3 - Redeploy/Restart**: Use `railway redeploy` to redeploy latest, or `railway restart` to restart the container (useful after env var changes).

**Pattern 4 - Full Verification Cycle**:

```bash
railway up --detach          # Deploy
railway status               # Check status
railway logs -n 50           # View logs
curl -s https://<service>.railway.app/health  # Health check
```

**Pattern 5 - Service-Specific**: Use `--service` flag to target specific services:

```bash
railway up --service backend --detach
railway logs --service backend -n 50
railway restart --service backend
```

---

## Environment Variable Management

This is the most critical section for autonomous operations. Environment variables control application behavior, CORS configuration, database connections, and API keys.

### Core Operations

```bash
# List all variables
railway variable list
railway variable list --service backend       # specific service
railway variable list --json                  # JSON format for parsing

# Set variables
railway variable set DATABASE_URL=postgresql://user:pass@host:5432/db
railway variable set CORS_ORIGINS='["https://example.com","https://www.example.com"]'
railway variable set --service backend LOG_LEVEL=info

# Delete variables
railway variable delete DEPRECATED_KEY
railway variable delete DEPRECATED_KEY --yes  # skip confirmation

# Verify after changes
railway variable list | grep CORS_ORIGINS
```

### Important Notes

- Setting or deleting a variable triggers an automatic redeployment
- No need to manually redeploy after variable changes
- Use single quotes around JSON values to prevent shell interpretation
- Variable changes apply to the current environment (production, staging, etc.)

---

## Autonomous Debugging Pattern

This is the key workflow for agents to diagnose and fix production issues without user intervention.

### Standard Debug Cycle

1. **Identify**: `railway logs -n 100` to capture the error
2. **Check config**: `railway variable list` to verify environment
3. **Fix**: Code issue (fix locally), env var issue (`railway variable set KEY=value`), or config issue (update railway.json/Dockerfile)
4. **Deploy**: Code change triggers auto-deploy on push; env var change auto-redeploys; or use `railway redeploy`
5. **Verify**: `railway logs -n 50` and `curl -s https://<service>.railway.app/health`

### Build Failure Debug Cycle

1. **View build logs**: `railway logs --build`
2. **Identify**: Dependency failure, Dockerfile error, missing build deps, version mismatch
3. **Fix locally**: Update requirements.txt/package.json, fix Dockerfile, update railway.json
4. **Redeploy**: `git push origin main`
5. **Verify**: `railway logs --build` then `railway logs -n 20`

### Runtime Error Debug Cycle

1. **Capture errors**: `railway logs -n 100`
2. **Categorize**: Import error (missing dep), connection error (db unreachable), permission error (bad creds), CORS error (misconfigured origins), memory error (resource limits)
3. **Apply targeted fix** (see Common Debugging Scenarios below)
4. **Verify**: `railway logs -n 50`

---

## Common Debugging Scenarios

**CORS Issues** (browser shows "Access-Control-Allow-Origin" errors):
```bash
railway variable list | grep CORS
railway variable set CORS_ORIGINS='["https://your-frontend.vercel.app","http://localhost:3000"]'
railway logs -n 30  # verify after auto-redeploy
```

**Build Failures** (deployment fails during build phase):
```bash
railway logs --build
# Common fixes: update Dockerfile base image, fix dependency conflicts, ensure files committed
```

**Runtime Crashes** (service starts but crashes):
```bash
railway logs -n 100      # identify crash cause
railway variable list    # verify env vars
railway restart          # restart after fixing
```

**Missing Environment Variables** (undefined config values):
```bash
railway variable list
railway variable set MISSING_KEY=correct_value
railway variable list | grep MISSING_KEY
```

**Port Configuration** (health checks fail, service unreachable): Railway dynamically assigns PORT. The application must listen on `$PORT`. Check with `railway variable list | grep PORT`.

**Database Connection** (cannot connect to database): Check `railway variable list | grep DATABASE` and verify Railway-provisioned database references with `railway status`.

**Service Unresponsive**: Use `railway restart` then `railway logs -n 50` to monitor.

---

## Environment, Networking, and Local Development

**Environments**: `railway environment` to switch, `railway environment new staging` to create. Use `--environment` flag for env-specific operations (`railway variable set --environment staging DEBUG=true`).

**Domains**: `railway domain` to generate a Railway domain. `railway open` to open the project in the browser.

**SSH/Connect**: `railway ssh` to SSH into the container. `railway connect` to open a database shell.

**Local Development**: `railway run <command>` injects all Railway env vars into the command (useful for migrations: `railway run python manage.py migrate`). `railway shell` opens a shell with Railway env vars.

---

## Safety Guards

### Destructive Operation Rules

[HARD] NEVER execute `railway down` without explicit user confirmation. This removes the latest deployment and can cause service outage.

[HARD] NEVER execute `railway unlink` during active debugging. This disconnects the project linkage and disrupts all subsequent CLI operations.

[HARD] ALWAYS run `railway status` before any destructive operation to verify the correct project and environment are targeted.

[HARD] ALWAYS use the `--service` flag when the project has multiple services to avoid operating on the wrong service.

### Operational Best Practices

- **Audit Trail**: When modifying variables, record what changed, previous/new values (redact secrets), and reason. Verify with `railway variable list`.
- **JSON Output**: Use `--json` flag when parsing output programmatically (`railway variable list --json`, `railway status --json`) to avoid format changes.
- **Skip Confirmation**: Use `--yes` flag for automated workflows (`railway variable delete OLD_KEY --yes`).

---

## Project-Specific Context

This project (music-trainer) uses the following Railway setup:

- **Backend**: FastAPI application deployed via Dockerfile
- **Auto-deploy**: Triggered on git push to main branch
- **Health endpoint**: `/health` or `/api/health`
- **Key variables**: CORS_ORIGINS, DATABASE_URL, environment-specific configuration
- **Configuration files**: `railway.json` in project root, `Dockerfile` for build

---

## Works Well With

- expert-devops agent for CI/CD pipeline configuration and infrastructure management
- expert-debug agent for production issue diagnosis and autonomous debugging workflows
- expert-backend agent for backend deployment issues, API configuration, and server-side debugging
- moai-platform-deployment skill for cross-platform deployment comparison and strategy
- moai-lang-python skill for Python/FastAPI-specific deployment patterns

---

Status: Production Ready
Version: 1.0.0
Updated: 2026-02-17
Platform: Railway CLI v4.30.2
