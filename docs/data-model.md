# QuickNotes – Data Model

---

## Table of Contents

1. [Entity Overview](#entity-overview)
2. [Relationships](#relationships)
3. [Schema — Column Definitions](#schema--column-definitions)
4. [CREATE TABLE Statements](#create-table-statements)
5. [Indexes](#indexes)
6. [Example SQL Queries](#example-sql-queries)
7. [SQL vs. NoSQL Justification](#sql-vs-nosql-justification)

---

## Entity Overview

QuickNotes uses four tables: **users**, **notes**, **tags**, and **note_tags**.

| Entity | Purpose |
|--------|---------|
| `users` | Stores registered accounts |
| `notes` | Stores individual notes owned by a user |
| `tags` | A global catalogue of reusable label slugs |
| `note_tags` | Junction table — links many notes to many tags |

---

## Relationships

### One-to-Many: `users` → `notes`

A single user can own zero or many notes; every note belongs to exactly one user.  
Implemented via `notes.user_id → users.id` (foreign key with `ON DELETE CASCADE`).

```
users (1) ──────────< notes (many)
```

### Many-to-Many: `notes` ↔ `tags`

A note can be labelled with multiple tags, and the same tag can appear on multiple notes.  
This is decomposed into two one-to-many relationships through the `note_tags` junction table.

```
notes (many) >──── note_tags ────< tags (many)
```

- `note_tags.note_id → notes.id` (cascade delete — removing a note cleans up its tag links)
- `note_tags.tag_id  → tags.id`  (restrict delete — cannot delete a tag while notes still use it)

---

## Schema — Column Definitions

### `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `BIGINT` | **PK**, AUTO_INCREMENT | Surrogate primary key |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Login identifier |
| `password_hash` | `VARCHAR(255)` | NOT NULL | Bcrypt hash — never the raw password |
| `display_name` | `VARCHAR(100)` | NOT NULL | Shown in the UI |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Account creation time |

---

### `notes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `BIGINT` | **PK**, AUTO_INCREMENT | Surrogate primary key |
| `user_id` | `BIGINT` | **FK → users.id**, NOT NULL | Owner of the note |
| `title` | `VARCHAR(100)` | NOT NULL | Note heading (max 100 chars, mirrors API validation) |
| `body` | `TEXT` | | Note content (nullable — a title-only note is valid) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Last modification timestamp |

---

### `tags`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `BIGINT` | **PK**, AUTO_INCREMENT | Surrogate primary key |
| `slug` | `VARCHAR(50)` | UNIQUE, NOT NULL | URL-safe lowercase label, e.g. `work`, `study` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | When the tag was first created |

---

### `note_tags` (Junction Table)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `note_id` | `BIGINT` | **PK (composite)**, **FK → notes.id** | References the note |
| `tag_id` | `BIGINT` | **PK (composite)**, **FK → tags.id** | References the tag |
| `tagged_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | When the tag was applied to the note |

> **Composite PK** on `(note_id, tag_id)` ensures the same tag cannot be attached to the same note twice at the database level.

---

## CREATE TABLE Statements

```sql
-- 1. Users
CREATE TABLE users (
    id            BIGSERIAL       PRIMARY KEY,
    email         VARCHAR(255)    NOT NULL UNIQUE,
    password_hash VARCHAR(255)    NOT NULL,
    display_name  VARCHAR(100)    NOT NULL,
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 2. Notes
CREATE TABLE notes (
    id         BIGSERIAL     PRIMARY KEY,
    user_id    BIGINT        NOT NULL,
    title      VARCHAR(100)  NOT NULL,
    body       TEXT,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_notes_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

-- 3. Tags
CREATE TABLE tags (
    id         BIGSERIAL    PRIMARY KEY,
    slug       VARCHAR(50)  NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4. Note–Tag junction
CREATE TABLE note_tags (
    note_id   BIGINT      NOT NULL,
    tag_id    BIGINT      NOT NULL,
    tagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (note_id, tag_id),

    CONSTRAINT fk_note_tags_note
        FOREIGN KEY (note_id)
        REFERENCES notes (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_note_tags_tag
        FOREIGN KEY (tag_id)
        REFERENCES tags (id)
        ON DELETE RESTRICT
);
```

---

## Indexes

### Index 1 — `notes.user_id`

```sql
CREATE INDEX idx_notes_user_id
    ON notes (user_id);
```

**Reason:** The most common query is `GET /notes` which filters all notes by the authenticated user (`WHERE user_id = ?`). Without this index, Postgres would perform a full sequential scan of the entire `notes` table for every request. At 1 million users with an average of 50 notes each (50 M rows), a full scan would be catastrophically slow. This B-tree index reduces the lookup to O(log n) plus a small range scan.

---

### Index 2 — `notes.user_id, created_at DESC` (Composite)

```sql
CREATE INDEX idx_notes_user_created
    ON notes (user_id, created_at DESC);
```

**Reason:** `GET /notes` also sorts by newest first (`ORDER BY created_at DESC`). A composite index on `(user_id, created_at DESC)` satisfies both the `WHERE` filter and the `ORDER BY` in a single index scan — eliminating a separate sort step entirely.

---

### Index 3 — `note_tags.tag_id`

```sql
CREATE INDEX idx_note_tags_tag_id
    ON note_tags (tag_id);
```

**Reason:** The composite PK on `(note_id, tag_id)` already gives an efficient lookup when querying by `note_id`. However, filtering notes by tag (`GET /notes?tag=work`) requires joining from `tags → note_tags → notes`, traversing `note_tags` by `tag_id`. Without this index, that join would be a full scan of the junction table. This index makes the tag-filter query fast regardless of table size.

---

## Example SQL Queries

### Query 1 — Get a user's 10 most recent notes (paginated)

```sql
SELECT
    n.id,
    n.title,
    n.body,
    n.created_at,
    n.updated_at
FROM notes n
WHERE n.user_id = 7
ORDER BY n.created_at DESC
LIMIT 10
OFFSET 0;  -- page 1; OFFSET = (page - 1) * limit
```

---

### Query 2 — Get all notes for a user with a specific tag (JOIN)

```sql
SELECT
    n.id,
    n.title,
    n.body,
    n.created_at,
    t.slug AS tag
FROM notes n
    INNER JOIN note_tags nt ON nt.note_id = n.id
    INNER JOIN tags      t  ON t.id       = nt.tag_id
WHERE n.user_id = 7
  AND t.slug    = 'study'
ORDER BY n.created_at DESC;
```

---

### Query 3 — Fetch a single note with all its tags (aggregated)

```sql
SELECT
    n.id,
    n.title,
    n.body,
    n.created_at,
    n.updated_at,
    ARRAY_AGG(t.slug ORDER BY t.slug) AS tags
FROM notes n
    LEFT JOIN note_tags nt ON nt.note_id = n.id
    LEFT JOIN tags      t  ON t.id       = nt.tag_id
WHERE n.id      = 42
  AND n.user_id = 7          -- ownership check prevents 403 bypasses
GROUP BY n.id;
```

> `ARRAY_AGG` collapses the joined tag rows into a single PostgreSQL array, avoiding N+1 queries in the application layer.

---

### Query 4 — Count notes per tag for a user (analytics)

```sql
SELECT
    t.slug,
    COUNT(nt.note_id) AS note_count
FROM tags t
    INNER JOIN note_tags nt ON nt.tag_id  = t.id
    INNER JOIN notes     n  ON n.id       = nt.note_id
WHERE n.user_id = 7
GROUP BY t.slug
ORDER BY note_count DESC;
```

---

## SQL vs. NoSQL Justification

QuickNotes uses **PostgreSQL (relational / SQL)** rather than a document store such as MongoDB.

The core data has clearly defined relationships: every note belongs to exactly one user (one-to-many), and notes share tags across many notes (many-to-many). Representing these in a document database would require either embedding tags inside each note document — leading to stale duplicates when a tag is renamed — or storing tag references that require application-level joins, which are slower and harder to keep consistent. PostgreSQL's foreign keys with `ON DELETE CASCADE` enforce referential integrity automatically, preventing orphaned notes if a user is deleted and preventing a tag from being silently removed while notes still reference it (`ON DELETE RESTRICT`). ACID transactions are equally important: when a note is created and tags are attached in the same request, both writes succeed or both roll back, so the database never holds a half-written note. Finally, the query patterns for QuickNotes — filter by user, sort by date, join to tags — are exactly the workloads that relational indexes and the query planner excel at. A NoSQL store would be appropriate if notes had wildly varying, unpredictable schemas or if the dominant operation was key–value lookups at extreme write throughput (> 100k writes/s), neither of which applies to a note-taking application.

---

*Document version: 1.0 · Last updated: 2026-10-16*
