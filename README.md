# ⚡ QuickNotes

> **Capture ideas at the speed of thought.**  
> A browser-based note-taking client backed by a full system design — built to scale to 1 million users.

---

## Description

QuickNotes is a two-part project:

1. **API Client** — A lightweight, zero-dependency front end (`index.html`, `api.js`, `style.css`) that talks to the [JSONPlaceholder](https://jsonplaceholder.typicode.com) practice REST API. It demonstrates real-world patterns: async fetch with error handling, four distinct UI states (loading / success / error / empty), input validation, and XSS-safe DOM rendering.

2. **System Design** — A set of engineering documents (`docs/`) that define the REST API contract, relational data model, and cloud architecture a backend team would build to take QuickNotes from a prototype to a production service serving 1 million users.

---

## How to Run the API Client

No build step, no dependencies, no server required.

### Option A — Open directly in the browser

```bash
# Clone the repository
git clone https://github.com/PCB-faith-audi/-quicknotes-system-design-.git
cd quicknotes-system-design

# Open index.html in your default browser
xdg-open index.html        # Linux
open index.html            # macOS
start index.html           # Windows
```

### Option B — Serve with a local HTTP server (recommended to avoid CORS issues)

```bash
# Python 3 (built in)
python3 -m http.server 8080

# Then visit:
# http://localhost:8080
```

### Using the app

| Action | How |
|--------|-----|
| **Load notes** | Click **Load Notes** — fetches 10 posts from the JSONPlaceholder API |
| **Create a note** | Fill in the **Title** field (required, max 100 chars) and optional **Body**, then click **Save Note** |
| **Delete a note** | Click the **Delete** button on any note card |
| **Status messages** | Watch the status bar at the top — it shows loading, success, error and empty states in real time |

---

## Project Documents

| Document | Description |
|----------|-------------|
| 📄 [API Design](docs/api-design.md) | 8 RESTful endpoints with request/response JSON examples and all error codes |
| 🗄️ [Data Model](docs/data-model.md) | 4-table relational schema with `CREATE TABLE` SQL, indexes, example queries and a SQL vs. NoSQL justification |
| 🏗️ [Architecture](docs/architecture.md) | Load estimates for 1M users, a full architecture diagram, request flow walkthroughs, trade-offs and SPOF mitigations |

---

## What I Learned

### 1. A reusable `request()` wrapper eliminates error-handling repetition

Writing a single `async function request()` that calls `fetch`, checks `response.ok`, and throws a typed error meant that the three operation functions (`loadNotes`, `createNote`, `deleteNote`) each needed only one `try/catch` instead of duplicating response-checking logic everywhere. This is the same pattern used in production HTTP clients — centralised, consistent, easy to extend (e.g., adding auth headers or retries in one place).

### 2. Cache invalidation is the hardest problem in distributed systems — and the most important one to get right

Designing the `POST /notes` flow revealed that writing to a database is only half the work: you must also immediately invalidate the relevant Redis cache key, or a user who creates a note will see stale data on their next refresh. The 60-second TTL is a safety net, not the primary strategy. This hands-on trade-off analysis made the phrase "there are only two hard things in computer science: cache invalidation and naming things" genuinely meaningful.

### 3. `textContent` vs `innerHTML` is a security decision, not just a style preference

Every DOM insertion in `api.js` uses `.textContent` deliberately. If a malicious note title contained `<script>alert('xss')</script>` and we used `.innerHTML`, that script would execute in the victim's browser. Using `textContent` treats the value as plain text and renders it safely — the browser never parses it as markup. This is a concrete, code-level security choice, not an abstract security concept.

### 4. Async queues decouple latency from correctness

Adding a Message Queue to the architecture taught me that not every side-effect of an action needs to complete before the HTTP response is sent. Sending a welcome email might take 2 seconds; the user's `201 Created` response should arrive in under 200 ms. A queue lets the write commit, the response return, and the email send independently — so a slow SMTP server never becomes the user's problem.

### 5. Read replicas protect the write path — but introduce consistency lag you must design around

Routing all `SELECT` queries to a read replica keeps the primary database free for writes, which is crucial at scale. But PostgreSQL async replication can lag by 10–100 ms, meaning a user could read stale data immediately after writing. The solution — invalidating the cache on write and optionally routing post-write reads to the primary — is a real engineering pattern used in production systems like GitHub and Shopify. Understanding the lag forced me to think about *consistency models*, not just raw performance.

---

## Project Structure

```
quicknotes-system-design/
├── index.html          # HTML5 app skeleton
├── api.js              # Async API client (fetch, GET / POST / DELETE)
├── style.css           # Dark glassmorphism UI with status state styles
├── docs/
│   ├── api-design.md   # REST API specification
│   ├── data-model.md   # Relational schema & SQL
│   └── architecture.md # System design for 1M users
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Front end | Vanilla HTML5, CSS3, JavaScript (ES2020+) |
| Practice API | [JSONPlaceholder](https://jsonplaceholder.typicode.com/posts) |
| Proposed back end | Node.js, PostgreSQL, Redis, RabbitMQ |
| Proposed infra | AWS (ALB, CloudFront, Route 53, RDS) |

---

*QuickNotes · System Design Project · 2026*
