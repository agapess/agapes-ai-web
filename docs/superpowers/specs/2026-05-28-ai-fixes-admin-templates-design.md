# Design: AI Error Visibility + Admin Model Selection + Seed Templates

**Date:** 2026-05-28  
**Status:** Approved

---

## Overview

Three independent improvements to the AI Website Builder:

1. **AI errors are silently swallowed** — users see a disappearing spinner instead of a message
2. **Admin panel lacks model selection** — model is typed blind; OpenAI and Claude need better UX
3. **Template gallery is empty** — no starter templates on a fresh install

---

## 1. Fix AI Error Visibility

### Problem

In `ChatPanel.tsx`, the SSE stream event loop handles `event.type === 'error'` by calling `finalizeStreamingMessage()` — which clears the streaming state silently. The user sees the spinner disappear with no feedback.

Additionally, `customInstructions` is sent in the POST body from ChatPanel but `stream/route.ts` does not forward it to the `aiRequest` object sent to the AI service.

### Changes

**`web/src/app/api/ai/stream/route.ts`**
- Add `customInstructions` to the destructured body (it's already in the schema)
- Pass it in the `aiRequest` object: `customInstructions: body.customInstructions`

**`web/src/components/builder/ChatPanel.tsx`**
- In the SSE event loop, change the `error` branch:
  ```
  // Before:
  } else if (event.type === 'error') {
    finalizeStreamingMessage()
  }

  // After:
  } else if (event.type === 'error') {
    addMessage({ role: 'assistant', content: `⚠️ ${event.message}`, timestamp: Date.now() })
    finalizeStreamingMessage()
  }
  ```
- No other changes needed

### Result

Users now see a visible error bubble in the chat, e.g. *"⚠️ Provider 'ollama' is not reachable"*. The streaming state is still cleaned up correctly.

---

## 2. Admin Panel — Model Selection + Provider Improvements

### New Web API Proxy Routes

Both routes require an active admin session (checked via `requireAdmin()`). They forward to the AI service at `AI_INTERNAL_URL` to avoid CORS issues from the browser.

**`web/src/app/api/providers/models/route.ts`** (new file)
- `POST` — accepts `{ provider, baseUrl?, apiKey? }`, forwards to `POST http://AI_INTERNAL_URL/api/providers/models`, returns `{ models: Array<{id, name}> }`
- Admin-only

**`web/src/app/api/providers/health/route.ts`** (new file)
- `POST` — accepts `{ provider, baseUrl?, apiKey? }`, forwards to `POST http://AI_INTERNAL_URL/api/providers/health`, returns `{ available: boolean }`
- Admin-only

### Updated Admin UI

**`web/src/app/admin/providers/AdminProvidersClient.tsx`** — full rewrite of the Add Provider form:

**Provider-aware defaults:** When the provider selector changes, auto-set sensible defaults:
- `ollama` → baseUrl pre-filled to env default; no API key field shown
- `lmstudio` → baseUrl pre-filled; no API key field shown
- `openai` → empty baseUrl; API key required; hardcoded model list
- `claude` → no baseUrl; API key required; hardcoded model list
- `openrouter` → no baseUrl; API key required; free-text model
- `custom` → both baseUrl and API key shown; free-text model

**Model selection control:** A two-part control:
- A dropdown populated after "Fetch Models" is clicked (calls `/api/providers/models`)
- Fallback: if fetch fails or provider is `openrouter`, renders a plain text input
- Hardcoded model lists (pre-populate dropdown without fetching):
  - `openai`: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`
  - `claude`: `claude-opus-4-8`, `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5-20251001`
  - `ollama`/`lmstudio`: empty until "Fetch Models" clicked

**"Test Connection" button:** Calls `/api/providers/health` with current form values; shows inline ✓ (green) or ✗ (red) badge. Only enabled when provider + required fields are filled.

**Provider card display improvements:**
- Show model name prominently
- Show status badge: `active` (green) / `inactive` (gray)
- Show provider type as a colored tag (`ollama`, `openai`, `claude`, etc.)

### No schema changes needed

The existing `upsertProviderConfigSchema` in `shared/src/schemas.ts` already handles all provider types and the `model` field. The existing `POST /api/admin/providers` route already encrypts the API key.

---

## 3. Seed Templates

### Problem

The templates table is empty on a fresh install. Users see "No templates yet" in the gallery. Seeding happens at startup in `seedDefaultProviders()` but templates are not included.

### Approach

**`web/src/lib/seed.ts`** — add `seedDefaultTemplates(userId: string)` function:
- Checks if templates table has any rows; if yes, returns early (idempotent)
- Inserts 5 starter templates using the `userId` of the first admin user as `createdBy`
- Each template has: `name`, `description`, `category`, `previewCode` (full JSX), `pagesSnapshot` (array with one home page entry containing the same JSX), `isPublic: true`

**`web/src/app/api/auth/[...nextauth]/route.ts`** — update startup sequence:
- After `seedDefaultProviders()`, query for the first admin user
- If found, call `seedDefaultTemplates(adminUser.id)`
- If no admin exists yet, skip (templates seed on next request after admin is created)

### The 5 Starter Templates

| Name | Category | Description |
|---|---|---|
| Landing Page | `landing` | Hero section with gradient, features grid, and CTA |
| SaaS App | `saas` | Navbar + hero + 3-tier pricing cards |
| Portfolio | `portfolio` | Centered bio, skills, and project showcase grid |
| E-commerce Store | `ecommerce` | Product grid with hero banner and cart button |
| Admin Dashboard | `dashboard` | Sidebar nav + stats cards + recent activity table |

Each `previewCode` is a complete, standalone React component (same code style as `ComponentLibrary.tsx` — Tailwind classes, dark theme, no external deps beyond what Sandpack provides).

Each `pagesSnapshot` is:
```json
[{ "name": "Home", "slug": "index", "content": "<same JSX>", "isHomePage": true, "order": 0 }]
```

### Idempotency

`seedDefaultTemplates` only runs if `templates` table is empty. Safe to call on every server startup.

---

## Files Changed Summary

| File | Change |
|---|---|
| `web/src/app/api/ai/stream/route.ts` | Forward `customInstructions` to AI service |
| `web/src/components/builder/ChatPanel.tsx` | Show error events as chat messages |
| `web/src/app/api/providers/models/route.ts` | New proxy route (admin-only) |
| `web/src/app/api/providers/health/route.ts` | New proxy route (admin-only) |
| `web/src/app/admin/providers/AdminProvidersClient.tsx` | Full rewrite with model fetch + test button |
| `web/src/lib/seed.ts` | Add `seedDefaultTemplates()` |
| `web/src/app/api/auth/[...nextauth]/route.ts` | Call `seedDefaultTemplates` at startup |

---

## Out of Scope

- Gemini provider UI (adapter exists but not wired; can be added later)
- Template editing from admin panel (user requested auto-seed only)
- User-facing provider selection in the builder chat (future feature)
- Model cost estimation per provider (future feature)
