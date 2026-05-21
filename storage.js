/**
 * storage.js — Abstracted data layer
 * Locally:   reads/writes redirects.json
 * Netlify:   reads/writes a GitHub Gist (persistent, free)
 *
 * Required env vars for Netlify:
 *   GITHUB_TOKEN  — Personal Access Token with "gist" scope
 *   GIST_ID       — ID of the Gist to use as database
 */

const fs   = require('fs');
const path = require('path');

const LOCAL_FILE  = path.join(__dirname, 'redirects.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID      = process.env.GIST_ID;
const USE_GIST     = !!(GITHUB_TOKEN && GIST_ID);

// ── GitHub Gist helpers ───────────────────────────────────────────────────────

async function gistRead() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!res.ok) throw new Error(`Gist read failed: ${res.status}`);
  const gist = await res.json();
  const content = gist.files['redirects.json']?.content;
  return content ? JSON.parse(content) : { campaigns: {} };
}

async function gistWrite(data) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: { 'redirects.json': { content: JSON.stringify(data, null, 2) } }
    })
  });
  if (!res.ok) throw new Error(`Gist write failed: ${res.status}`);
}

// ── Local file helpers ────────────────────────────────────────────────────────

function localRead() {
  try { return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')); }
  catch { return { campaigns: {} }; }
}

function localWrite(data) {
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Public API ────────────────────────────────────────────────────────────────

async function readData() {
  if (USE_GIST) return gistRead();
  return localRead();
}

async function writeData(data) {
  if (USE_GIST) return gistWrite(data);
  localWrite(data);
}

module.exports = { readData, writeData };
