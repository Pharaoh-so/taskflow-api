# TaskFlow API

A task management API with team collaboration, notifications, and webhook integrations.

This repo doubles as a working example for [Pharaoh](https://pharaoh.so) multi-agent teams. It's a real TypeScript project with 6 modules, cross-module dependencies, and enough architectural complexity to show what graph-powered AI tools can do. Fork it, connect Pharaoh, and try the playbooks below.

## Architecture

```
src/
├── auth/           # JWT authentication, password hashing
├── users/          # User CRUD, profile management
├── tasks/          # Task lifecycle, comments, team boards
├── notifications/  # Email, webhooks, in-app notifications
├── middleware/      # Auth guards, error handling
└── shared/         # Database, types, validators, logging
```

## Modules

- **auth** - JWT tokens (access + refresh), bcrypt password hashing, login/register routes
- **users** - User repository with pagination, role-based access, profile updates
- **tasks** - Task CRUD with status workflow enforcement, priority sorting, comments
- **notifications** - Multi-channel dispatch (email via SMTP, webhooks with HMAC signing, in-app)
- **shared** - PostgreSQL pool, Zod validators, Winston logger, error classes, type definitions

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Authenticate |
| POST | /auth/refresh | Refresh access token |
| GET | /users | List users |
| GET | /users/me | Current user profile |
| PATCH | /users/:id | Update user |
| POST | /tasks | Create task |
| GET | /tasks | List team tasks |
| GET | /tasks/stats | Task counts by status |
| PATCH | /tasks/:id | Update task |
| POST | /tasks/:id/comments | Add comment |
| GET | /notifications | List notifications |
| POST | /notifications/webhooks | Subscribe to events |

## Setup

```bash
pnpm install
cp .env.example .env  # Configure database and SMTP
pnpm build
pnpm start
```

---

## Using This Repo with Pharaoh

This is a good repo to try Pharaoh on because it has the kind of structure that trips up AI agents - shared modules, cross-module callers, middleware chains, and webhook dispatch logic where a change in one place ripples to others.

### 1. Connect Pharaoh

```bash
# Option A: Install the GitHub App (maps all your org repos automatically)
# Visit github.com/apps/pharaoh-so

# Option B: Map just this repo via upload
npx @pharaoh-so/mcp
# Follow the auth flow, then ask your AI tool:
# "Map the Pharaoh-so/taskflow-api repo"
```

### 2. Try it

Once mapped, ask your AI tool any of these:

```
Show me the architecture of taskflow-api
```

```
What's the blast radius of the authenticate middleware?
```

```
Does a webhook signing function already exist somewhere?
```

```
What happens if I change the Task type in shared/types.ts?
```

```
Find dead code in this repo
```

The agent queries Pharaoh's knowledge graph instead of reading files one at a time. It gets the full picture in ~2 seconds.

---

## Multi-Agent Playbooks

This repo comes with pre-built multi-agent team configurations. Each playbook defines specialized agents that use Pharaoh skills for architectural awareness.

### Quick start

```bash
# Install Pharaoh skills into your OpenClaw workspace
npx @pharaoh-so/mcp --install-skills

# Copy a playbook config into your openclaw.json (see below)
```

### Feature Development Team

Three agents: a planner designs the implementation using Pharaoh recon, a tester writes failing tests first, a coder implements minimal code to pass them.

**Try it:**

```
@planner Add rate limiting to the auth/login endpoint - max 5 attempts per IP per minute
```

The planner will:
1. Query `get_codebase_map` to see all modules
2. Query `get_module_context` on auth and middleware
3. Query `search_functions` to check if rate limiting already exists
4. Query `get_blast_radius` on the login route handler
5. Produce a step-by-step plan with wiring declarations

Then the tester writes failing tests, the coder implements, and the planner verifies.

<details>
<summary>openclaw.json config</summary>

```json
{
  "mcpServers": {
    "pharaoh": {
      "command": "npx",
      "args": ["@pharaoh-so/mcp"]
    }
  },
  "agents": {
    "list": [
      {
        "id": "planner",
        "name": "Feature Planner",
        "workspace": ".",
        "model": { "primary": "anthropic/claude-opus-4-5" },
        "tools": {
          "allow": ["read", "exec"],
          "deny": ["write", "edit", "apply_patch"],
          "agentToAgent": { "enabled": true, "allow": ["coder", "tester"] }
        }
      },
      {
        "id": "coder",
        "name": "Feature Coder",
        "workspace": ".",
        "model": { "primary": "anthropic/claude-sonnet-4-5" },
        "tools": {
          "allow": ["read", "write", "edit", "apply_patch", "exec"],
          "agentToAgent": { "enabled": true, "allow": ["planner", "tester"] }
        }
      },
      {
        "id": "tester",
        "name": "Test Engineer",
        "workspace": ".",
        "model": { "primary": "anthropic/claude-sonnet-4-5" },
        "tools": {
          "allow": ["read", "write", "edit", "exec"],
          "deny": ["apply_patch"],
          "agentToAgent": { "enabled": true, "allow": ["planner", "coder"] }
        }
      }
    ]
  }
}
```

</details>

### Code Review Team

Three agents: a coordinator triages PRs and delegates structural analysis to a Pharaoh specialist and code-level review to a reviewer. All read-only.

**Try it:**

```
@coordinator Review the changes in the last commit
```

<details>
<summary>openclaw.json config</summary>

```json
{
  "mcpServers": {
    "pharaoh": {
      "command": "npx",
      "args": ["@pharaoh-so/mcp"]
    }
  },
  "agents": {
    "list": [
      {
        "id": "coordinator",
        "name": "Review Coordinator",
        "workspace": ".",
        "model": { "primary": "anthropic/claude-sonnet-4-5" },
        "tools": {
          "allow": ["read", "exec"],
          "deny": ["write", "edit", "apply_patch"],
          "agentToAgent": { "enabled": true, "allow": ["pharaoh-specialist", "reviewer"] }
        }
      },
      {
        "id": "pharaoh-specialist",
        "name": "Architecture Analyst",
        "workspace": ".",
        "model": { "primary": "anthropic/claude-sonnet-4-5" },
        "tools": {
          "allow": ["read", "exec"],
          "deny": ["write", "edit", "apply_patch"],
          "agentToAgent": { "enabled": true, "allow": ["coordinator"] }
        }
      },
      {
        "id": "reviewer",
        "name": "Code Reviewer",
        "workspace": ".",
        "model": { "primary": "anthropic/claude-sonnet-4-5" },
        "tools": {
          "allow": ["read", "exec"],
          "deny": ["write", "edit", "apply_patch"],
          "agentToAgent": { "enabled": true, "allow": ["coordinator"] }
        }
      }
    ]
  }
}
```

</details>

### Tech Debt Sprint

Two agents: an auditor grades the codebase A-F and categorizes debt, a fixer implements the highest-priority cleanup items.

**Try it:**

```
@auditor Run a full tech debt audit
```

<details>
<summary>openclaw.json config</summary>

```json
{
  "mcpServers": {
    "pharaoh": {
      "command": "npx",
      "args": ["@pharaoh-so/mcp"]
    }
  },
  "agents": {
    "list": [
      {
        "id": "auditor",
        "name": "Debt Auditor",
        "workspace": ".",
        "model": { "primary": "anthropic/claude-opus-4-5" },
        "tools": {
          "allow": ["read", "exec"],
          "deny": ["write", "edit", "apply_patch"],
          "agentToAgent": { "enabled": true, "allow": ["fixer"] }
        }
      },
      {
        "id": "fixer",
        "name": "Debt Fixer",
        "workspace": ".",
        "model": { "primary": "anthropic/claude-sonnet-4-5" },
        "tools": {
          "allow": ["read", "write", "edit", "apply_patch", "exec"],
          "agentToAgent": { "enabled": true, "allow": ["auditor"] }
        }
      }
    ]
  }
}
```

</details>

### Codebase Onboarding

A single read-only agent that maps architecture, finds entry points, and produces an orientation summary. Free-tier only.

**Try it:**

```
@onboarder Help me understand this codebase
```

---

## More Playbooks

Full playbook docs with per-agent AGENTS.md workspace files:
- [Code Review Team](https://github.com/Pharaoh-so/pharaoh/tree/main/docs/openclaw/playbooks/code-review-team.md)
- [Feature Development](https://github.com/Pharaoh-so/pharaoh/tree/main/docs/openclaw/playbooks/feature-development.md)
- [Codebase Onboarding](https://github.com/Pharaoh-so/pharaoh/tree/main/docs/openclaw/playbooks/codebase-onboarding.md)
- [Tech Debt Sprint](https://github.com/Pharaoh-so/pharaoh/tree/main/docs/openclaw/playbooks/tech-debt-sprint.md)

## License

MIT
