# TaskFlow API

A task management API with team collaboration, notifications, and webhook integrations.

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

- **auth** — JWT tokens (access + refresh), bcrypt password hashing, login/register routes
- **users** — User repository with pagination, role-based access, profile updates
- **tasks** — Task CRUD with status workflow enforcement, priority sorting, comments
- **notifications** — Multi-channel dispatch (email via SMTP, webhooks with HMAC signing, in-app)
- **shared** — PostgreSQL pool, Zod validators, Winston logger, error classes, type definitions

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
