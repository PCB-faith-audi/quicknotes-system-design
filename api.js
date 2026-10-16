/* ============================================================
   QuickNotes – API Client
   Endpoint: https://jsonplaceholder.typicode.com/posts
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const API_URL = 'https://jsonplaceholder.typicode.com/posts';

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
 * @param {number} id
 * @param {HTMLElement} listItem - The <li> to remove from the DOM.
 */
async function deleteNote(id, listItem) {
  setStatus(`Deleting note ${id}…`, 'loading');
  setButtonsDisabled(true);

  try {
    await request(`${API_URL}/${id}`, { method: 'DELETE' });

    listItem.remove();
    setStatus(`✓ Note ${id} deleted.`, 'success');

    // Check if list is now empty
    if (notesList.children.length === 0) {
      renderEmptyState();
    }
  } catch (err) {
    setStatus(`Error deleting note: ${err.message}`, 'error');
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
function buildNoteItem(note) {
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
