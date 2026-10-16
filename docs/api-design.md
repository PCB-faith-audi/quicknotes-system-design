# QuickNotes – API Design

> **Base URL (production):** `https://api.quicknotes.io/v1`  
> **Content-Type:** `application/json` for all request and response bodies  
> **Authentication:** Bearer token in the `Authorization` header (`Authorization: Bearer <token>`)

---

## Table of Contents

1. [Endpoints](#endpoints)
2. [Request & Response Examples](#request--response-examples)
3. [Error Codes & Error Body](#error-codes--error-body)

---

## Endpoints

| # | Method | Path | Description | Success Status |
|---|--------|------|-------------|----------------|
| 1 | `GET` | `/notes` | List the authenticated user's notes (paginated, 10 per page) | `200 OK` |
| 2 | `POST` | `/notes` | Create a new note for the authenticated user | `201 Created` |
| 3 | `GET` | `/notes/{id}` | Retrieve a single note by its ID | `200 OK` |
| 4 | `PUT` | `/notes/{id}` | Replace an existing note's title and body entirely | `200 OK` |
| 5 | `DELETE` | `/notes/{id}` | Permanently delete a note | `204 No Content` |
| 6 | `GET` | `/notes?tag={slug}` | Filter notes by a tag slug (e.g. `?tag=work`) | `200 OK` |
| 7 | `POST` | `/notes/{id}/tags` | Attach one or more tags to a note | `201 Created` |
| 8 | `DELETE` | `/notes/{id}/tags/{tag_id}` | Remove a tag from a note | `204 No Content` |

### Endpoint Details

---

### 1. `GET /notes` — List Notes

Returns a paginated list of the authenticated user's notes, newest first.

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: `1`) |
| `limit` | integer | No | Items per page (default: `10`, max: `50`) |
| `tag` | string | No | Filter by tag slug |

---

### 2. `POST /notes` — Create a Note

Creates a new note owned by the authenticated user.

**Request Body Fields**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | **Yes** | 1–100 characters |
| `body` | string | No | Max 10,000 characters |
| `tags` | string[] | No | Array of existing tag slugs |

---

### 3. `GET /notes/{id}` — Get a Note

Returns a single note. Returns `403` if the note belongs to another user.

---

### 4. `PUT /notes/{id}` — Update a Note

Fully replaces `title` and `body`. Partial updates should use `PATCH` (future work).

---

### 5. `DELETE /notes/{id}` — Delete a Note

Hard-deletes the note. Returns `204 No Content` with an empty body on success.

---

### 6. `GET /notes?tag={slug}` — Filter by Tag

Combines with pagination parameters. Returns only notes that have the specified tag attached.

---

### 7. `POST /notes/{id}/tags` — Add Tags to a Note

Attaches tags to an existing note. Idempotent — re-attaching an existing tag is silently ignored.

---

### 8. `DELETE /notes/{id}/tags/{tag_id}` — Remove a Tag from a Note

Detaches a single tag from a note. Does not delete the tag itself.

---

## Request & Response Examples

### Creating a Note — `POST /notes`

**Request**

```http
POST /v1/notes HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "System Design Interview Prep",
  "body": "Review CAP theorem, consistent hashing, and load balancing strategies before Friday.",
  "tags": ["study", "interviews"]
}
```

**Response — `201 Created`**

```json
{
  "data": {
    "id": 42,
    "userId": 7,
    "title": "System Design Interview Prep",
    "body": "Review CAP theorem, consistent hashing, and load balancing strategies before Friday.",
    "tags": ["study", "interviews"],
    "createdAt": "2026-10-16T13:05:00Z",
    "updatedAt": "2026-10-16T13:05:00Z"
  }
}
```

---

### Listing Notes — `GET /notes`

**Request**

```http
GET /v1/notes?page=1&limit=10 HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response — `200 OK`**

```json
{
  "data": [
    {
      "id": 42,
      "userId": 7,
      "title": "System Design Interview Prep",
      "body": "Review CAP theorem, consistent hashing, and load balancing strategies before Friday.",
      "tags": ["study", "interviews"],
      "createdAt": "2026-10-16T13:05:00Z",
      "updatedAt": "2026-10-16T13:05:00Z"
    },
    {
      "id": 41,
      "userId": 7,
      "title": "Grocery List",
      "body": "Milk, eggs, bread, and coffee.",
      "tags": ["personal"],
      "createdAt": "2026-10-15T08:22:10Z",
      "updatedAt": "2026-10-15T08:22:10Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

---

## Error Codes & Error Body

All errors follow a uniform JSON envelope so clients can handle them consistently.

### Standard Error Response Body

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of what went wrong.",
    "details": [
      {
        "field": "title",
        "issue": "Title is required and must not exceed 100 characters."
      }
    ]
  }
}
```

> `details` is optional and only present when field-level information is available (e.g., validation failures).

---

### Error Status Code Reference

| Status | Code | Meaning | When It Occurs |
|--------|------|---------|----------------|
| `400` | `VALIDATION_ERROR` | Bad Request | Request body is missing required fields, or a field fails validation (e.g., title > 100 chars, invalid type) |
| `401` | `UNAUTHORIZED` | Unauthorized | No `Authorization` header was supplied, or the Bearer token is missing, expired, or malformed |
| `403` | `FORBIDDEN` | Forbidden | The authenticated user does not own the requested note (e.g., trying to read or delete another user's note) |
| `404` | `NOT_FOUND` | Not Found | The note `id` does not exist in the database |
| `500` | `INTERNAL_ERROR` | Internal Server Error | An unexpected server-side error occurred; the client should retry with exponential back-off |

---

### Example Error Bodies per Code

#### `400 Bad Request` — Validation failure on `POST /notes`

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "title", "issue": "Title is required." },
      { "field": "title", "issue": "Title must not exceed 100 characters." }
    ]
  }
}
```

#### `401 Unauthorized` — Missing or expired token

```json
{
  "error": {
    "status": 401,
    "code": "UNAUTHORIZED",
    "message": "Authentication token is missing or has expired. Please log in again."
  }
}
```

#### `403 Forbidden` — Accessing another user's note

```json
{
  "error": {
    "status": 403,
    "code": "FORBIDDEN",
    "message": "You do not have permission to access note 42."
  }
}
```

#### `404 Not Found` — Note does not exist

```json
{
  "error": {
    "status": 404,
    "code": "NOT_FOUND",
    "message": "Note with id 99 was not found."
  }
}
```

#### `500 Internal Server Error` — Unhandled exception

```json
{
  "error": {
    "status": 500,
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Please try again later.",
    "requestId": "req_8f3a1c7d-2b0e-4f9a-a123-456789abcdef"
  }
}
```

> The `requestId` field is included in `500` responses to help operations teams trace the failure in server logs.

---

*Document version: 1.0 · Last updated: 2026-10-16*
