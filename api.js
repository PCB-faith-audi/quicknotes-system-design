/* ============================================================
   QuickNotes – API Client
   Endpoint: https://jsonplaceholder.typicode.com/posts
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const API_URL = 'https://jsonplaceholder.typicode.com/posts';

// ── English Content Mapping for Sample Notes ──────────────────
// JSONPlaceholder returns placeholder pseudo-Latin text. We map sample post IDs
// to clear, professional English notes so users always see notes in English.
const ENGLISH_SAMPLE_NOTES = {
  1: {
    title: 'Team Standup Notes & Weekly Priorities',
    body: 'Discussed sprint deliverables, resolved blocker on the auth service, and scheduled the architecture review for Thursday.',
  },
  2: {
    title: 'System Design: Microservices vs Monolith',
    body: 'A modular monolith is often the best initial choice. Extract microservices only when bounded contexts and team scaling demand it.',
  },
  3: {
    title: 'Recommended Engineering Books',
    body: 'Designing Data-Intensive Applications by Martin Kleppmann, Clean Code by Robert C. Martin, and System Design Interview by Alex Xu.',
  },
  4: {
    title: 'Weekly Grocery & Household List',
    body: 'Oat milk, whole wheat bread, fair-trade coffee beans, avocados, olive oil, and Greek yogurt.',
  },
  5: {
    title: 'Database Indexing Guidelines',
    body: 'Always index foreign keys used in frequent joins. Ensure composite indexes align with query predicates and sort orders.',
  },
  6: {
    title: 'RESTful API Best Practices',
    body: 'Use plural nouns for resource paths, return standard HTTP status codes, and maintain a consistent JSON error envelope.',
  },
  7: {
    title: 'Workout Routine: Core & Strength',
    body: 'Warm up with 5 minutes of dynamic stretches, followed by squats (4x8), overhead press (3x8), pull-ups, and planks.',
  },
  8: {
    title: 'Client Onboarding Checklist',
    body: 'Send welcome email with account credentials, configure workspace permissions, and schedule initial 30-minute kickoff walkthrough.',
  },
  9: {
    title: 'Q4 Product Roadmap Discussion',
    body: 'Focus on high availability (99.9%) and sub-200ms p99 latency for all note-reading endpoints prior to the public launch.',
  },
  10: {
    title: 'Weekend Project Ideas',
    body: 'Build a minimal offline-first markdown note editor with IndexedDB persistence and client-side full-text search.',
  },
};

/**
 * Ensures note title and body are presented in English.
 * @param {object} note
 * @returns {object}
 */
function localizeNoteToEnglish(note) {
  if (ENGLISH_SAMPLE_NOTES[note.id]) {
    return {
      ...note,
      title: ENGLISH_SAMPLE_NOTES[note.id].title,
      body: ENGLISH_SAMPLE_NOTES[note.id].body,
    };
  }
  return note;
}

// ── DOM References ───────────────────────────────────────────
const statusEl   = document.getElementById('status');
const loadBtn    = document.getElementById('load-btn');
const noteForm   = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const bodyInput  = document.getElementById('body-input');
const submitBtn  = document.getElementById('submit-btn');
const notesList  = document.getElementById('notes-list');
const titleCounter = document.getElementById('title-counter');

// ── UI State Helpers ─────────────────────────────────────────

/**
 * Set the status message with a visual class.
 * @param {string} message - Text to display.
 * @param {'loading'|'success'|'error'|''} type - CSS modifier class.
 */
function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = type ? `status status--${type}` : 'status';
}

/**
 * Disable or enable all interactive buttons at once.
 * @param {boolean} disabled
 */
function setButtonsDisabled(disabled) {
  loadBtn.disabled   = disabled;
  submitBtn.disabled = disabled;
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.disabled = disabled;
  });
}

// ── Core Request Utility ─────────────────────────────────────

/**
 * Reusable async wrapper around fetch.
 * Checks response.ok and throws a descriptive Error on failure.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>} Parsed JSON body, or null for 204 No Content.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  // 204 No Content – nothing to parse
  if (response.status === 204) return null;

  const data = await response.json();
  if (data && typeof data === 'object') {
    data.statusCode = response.status;
  }
  return data;
}

// ── API Functions ────────────────────────────────────────────

/**
 * GET /posts?_limit=10 – Fetch the ten most recent notes.
 */
async function loadNotes() {
  setStatus('Loading notes...', 'loading');
  setButtonsDisabled(true);

  try {
    const notes = await request(`${API_URL}?_limit=10`);

    if (!notes || notes.length === 0) {
      setStatus('No notes found.', '');
      renderEmptyState();
      return;
    }

    setStatus(`Loaded ${notes.length} notes from the server.`, 'success');
    renderNotes(notes);
  } catch (err) {
    setStatus('Failed to load notes. Please check your connection and try again.', 'error');
  } finally {
    setButtonsDisabled(false);
  }
}

/**
 * POST /posts – Create a new note.
 * @param {{ title: string, body: string }} noteData
 */
async function createNote(noteData) {
  setStatus('Creating note...', 'loading');
  setButtonsDisabled(true);

  try {
    const created = await request(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...noteData, userId: 1 }),
    });

    const status = created.statusCode || 201;
    setStatus(`Note created (status ${status}, id ${created.id}).`, 'success');
    prependNote(created);
    noteForm.reset();
    updateCharCounter();
  } catch (err) {
    setStatus(`Failed to create note: ${err.message}`, 'error');
  } finally {
    setButtonsDisabled(false);
  }
}

/**
 * DELETE /posts/:id – Remove a note by id.
 *
 * Handling JSONPlaceholder mock API behavior:
 * JSONPlaceholder is a mock REST service that simulates API operations without actually
 * persisting writes to a real database. Notes created client-side via POST /posts receive
 * simulated IDs (e.g., id: 101) but do not exist in the remote server state.
 *
 * Approach:
 * 1. We still issue a real HTTP DELETE request (`${API_URL}/${id}`) to test and demonstrate
 *    proper client-to-server HTTP communication.
 * 2. On success (or if the server acknowledges the delete), we immediately remove the note's
 *    corresponding <li> element from the local DOM so the UI remains consistent.
 * 3. If removing the item leaves the list empty, we restore the empty-state placeholder.
 * 4. Any network or HTTP errors are caught and surfaced to the user via the #status element.
 *
 * @param {number} id
 * @param {HTMLElement} listItem - The <li> element to remove from the DOM upon success.
 */
async function deleteNote(id, listItem) {
  setStatus(`Deleting note ${id}...`, 'loading');
  setButtonsDisabled(true);

  try {
    await request(`${API_URL}/${id}`, { method: 'DELETE' });

    listItem.remove();
    setStatus(`Note ${id} deleted successfully.`, 'success');

    // Check if list is now empty
    if (notesList.children.length === 0) {
      renderEmptyState();
    }
  } catch (err) {
    setStatus(`Failed to delete note ${id}: ${err.message}`, 'error');
  } finally {
    setButtonsDisabled(false);
  }
}

// ── Render Functions ─────────────────────────────────────────

/**
 * Build a single <li> for a note and return it.
 * IMPORTANT: all user-supplied text is inserted via textContent only.
 * @param {{ id: number, title: string, body: string }} note
 * @returns {HTMLLIElement}
 */
function buildNoteItem(rawNote) {
  const note = localizeNoteToEnglish(rawNote);
  const li = document.createElement('li');
  li.className = 'note-item';
  li.dataset.id = note.id;

  const header = document.createElement('div');
  header.className = 'note-header';

  const idBadge = document.createElement('span');
  idBadge.className = 'note-id';
  idBadge.textContent = `#${note.id}`;

  const title = document.createElement('h3');
  title.className = 'note-title';
  title.textContent = note.title;        // ← textContent only (XSS-safe)

  const body = document.createElement('p');
  body.className = 'note-body';
  body.textContent = note.body;          // ← textContent only (XSS-safe)

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-delete';
  delBtn.type = 'button';
  delBtn.textContent = 'Delete';
  delBtn.setAttribute('aria-label', `Delete note ${note.id}`);
  delBtn.addEventListener('click', () => deleteNote(note.id, li));

  header.appendChild(idBadge);
  header.appendChild(title);
  header.appendChild(delBtn);

  li.appendChild(header);
  li.appendChild(body);

  return li;
}

/**
 * Clear the list and render all notes.
 * @param {Array} notes
 */
function renderNotes(notes) {
  notesList.innerHTML = '';
  const fragment = document.createDocumentFragment();
  notes.forEach(note => fragment.appendChild(buildNoteItem(note)));
  notesList.appendChild(fragment);
}

/**
 * Insert a new note at the top of the list (after POST).
 * @param {object} note
 */
function prependNote(note) {
  // Remove the empty-state placeholder if present
  const emptyMsg = notesList.querySelector('.notes-empty');
  if (emptyMsg) emptyMsg.remove();

  notesList.insertBefore(buildNoteItem(note), notesList.firstChild);
}

/**
 * Show an empty-state message inside the list.
 */
function renderEmptyState() {
  notesList.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'notes-empty';
  li.textContent = 'No notes yet. Create one above or click "Load notes".';
  notesList.appendChild(li);
}

// ── Validation ───────────────────────────────────────────────

/**
 * Validate the note form.
 * @returns {{ valid: boolean, title: string, body: string }}
 */
function validateForm() {
  const title = titleInput.value.trim();
  const body  = bodyInput.value.trim();

  if (!title) {
    setStatus('Validation error: Title is required.', 'error');
    titleInput.focus();
    return { valid: false };
  }

  if (title.length > 100) {
    setStatus('Validation error: Title must be 100 characters or fewer.', 'error');
    titleInput.focus();
    return { valid: false };
  }

  return { valid: true, title, body };
}

// ── Character Counter ────────────────────────────────────────

function updateCharCounter() {
  const len = titleInput.value.length;
  titleCounter.textContent = `${len} / 100`;
  titleCounter.className = len > 90
    ? 'char-counter char-counter--warn'
    : 'char-counter';
}

// ── Event Listeners ──────────────────────────────────────────

loadBtn.addEventListener('click', loadNotes);

noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const { valid, title, body } = validateForm();
  if (!valid) return;
  createNote({ title, body });
});

titleInput.addEventListener('input', updateCharCounter);

// ── Init ─────────────────────────────────────────────────────
// Show a welcoming empty state on page load
renderEmptyState();
