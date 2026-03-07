## Kaal Chatbot

Embeddable AI chatbot widget with a React-based frontend and a Node.js API. The widget mounts via a single script tag on any site, talks only to your `/api/chat` and `/api/leads` endpoints, and stores leads in Supabase.

---

### 1. Repository Structure

- `widget/` – React 18 + Vite chat widget, built as an IIFE for script-tag embedding.
- `server/` – Node.js + Express API (`/api/chat`, `/api/leads`) + Supabase integration.
- `src/data/knowledge-base.json` – FAQ-style intents for deterministic answers.
- `tests/` – Playwright E2E tests (`tests/e2e`).

---

### 2. Environment Variables

Copy `.env.example` to `.env` in the repo root and fill:

- **Widget / frontend**
  - `VITE_API_BASE_URL` – base URL of the backend API, e.g. `https://api.yourdomain.com`.
  - `WIDGET_BRAND_COLOR` – primary hex color for the widget (e.g. `#1E3A5F`).
  - `WIDGET_POSITION` – `bottom-right` or `bottom-left`.

- **Backend / server**
  - `OPENAI_API_KEY` – OpenAI key (used only in `server`).
  - `SUPABASE_URL` – Supabase project URL.
  - `SUPABASE_ANON_KEY` – optional, not required by this server, for reference.
  - `SUPABASE_SERVICE_KEY` – Supabase service role key, used server-side only.
  - `CORS_ORIGIN` – comma-separated list of allowed origins, e.g. `https://client-site.com`.

You will also usually set a `.env` file inside `server/` in production (Vercel/Railway UI).

---

### 3. Local Development

#### 3.1 Start the API

```bash
cd server
npm install
cp ../.env.example .env   # edit values
npm run dev               # defaults to http://localhost:4000
```

Health check:

```bash
curl http://localhost:4000/health
```

#### 3.2 Start the Widget

```bash
cd widget
npm install
echo "VITE_API_BASE_URL=http://localhost:4000" > .env
echo "WIDGET_BRAND_COLOR=#1E3A5F" >> .env
echo "WIDGET_POSITION=bottom-right" >> .env
npm run dev               # http://localhost:5173
```

Open `http://localhost:5173` to interact with the widget in a sandbox page.

---

### 4. API Contracts

#### 4.1 `POST /api/chat`

- **Request body**

```json
{
  "message": "string",
  "sessionId": "uuid-string",
  "context": [{ "role": "user|assistant", "content": "string" }]
}
```

- **Response body**

```json
{
  "reply": "string",
  "intent": "string",
  "requiresLead": false,
  "sessionId": "uuid-string | null"
}
```

Logic:

- If `message` matches an intent in `knowledge-base.json`, returns that answer.
- Otherwise, uses OpenAI (if configured) with a system prompt + knowledge base injected.
- Sets `requiresLead: true` for lead-trigger intents (pricing, demo, contact).

#### 4.2 `POST /api/leads`

- **Request body**

```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "query": "string",
  "sessionId": "uuid-string",
  "timestamp": "ISO-8601",
  "sourceUrl": "string"
}
```

- **Responses**

- `201` – `{ "success": true, "leadId": "uuid" }`
- `400` – `{ "error": "Validation failed", "fields": ["name", "email"] }`
- `500` – `{ "error": "Lead insert failed" }`

The handler inserts into a `leads` table in Supabase with columns:
`id, name, email, phone, query, session_id, source_url, created_at`.

---

### 5. Building the Widget for Production

From `widget/`:

```bash
cd widget
npm run build:widget
```

This outputs `dist/kaal-chatbot-widget.iife.js`, which you can host on a CDN.

#### Embed on a Client Website

Place this before `</body>` on the host site:

```html
<script
  src="https://cdn.yourdomain.com/kaal-chatbot-widget.iife.js"
  data-brand-color="#1E3A5F"
  data-position="bottom-right"
  data-api-url="https://api.yourdomain.com"
  defer
></script>
```

The widget:

- Injects a shadow DOM root (`#kaal-chatbot-root`) to isolate styles.
- Renders a floating launcher button, animated chat window, quick options, and inline lead form.

---

### 6. Supabase Setup

Run this against your Supabase project:

```sql
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  query       TEXT,
  session_id  UUID,
  source_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
```

Recommended RLS:

- Allow `INSERT` for the `anon` key (if you ever write from the browser).
- Allow full access only for the service-role key, used by this API.

---

### 7. Testing & CI

#### 7.1 Unit tests (Vitest)

From repo root:

```bash
npm run test:unit
```

This runs Vitest in the `widget` package (currently with a lead-form test).

#### 7.2 E2E tests (Playwright)

```bash
npm run test:e2e
```

Playwright uses `playwright.config.ts`:

- Spins up `widget` dev server on port `5173`.
- Runs `tests/e2e/widget-basic.spec.ts` on desktop + mobile Chrome.

#### 7.3 GitHub Actions CI

Workflow: `.github/workflows/ci.yml`

- On `push`/`pull_request` to `main`:
  - Install root, widget, and server dependencies.
  - Run `npm run test:unit` (Vitest).
  - Run `npm run test:e2e` (Playwright).
  - Run `npm run build` to compile the widget bundle.

Wire your deployment steps into the `deploy` script or add a separate workflow.

---

### 8. Handover Checklist

For a new client/project:

- [ ] Configure OpenAI + Supabase environment variables in your hosting platform.
- [ ] Apply the Supabase `leads` table migration and RLS rules.
- [ ] Build and upload `kaal-chatbot-widget.iife.js` to your CDN.
- [ ] Embed the `<script>` tag on the target site.
- [ ] Run through the E2E flow: greeting → FAQ reply → options → inline lead form → Supabase row.
