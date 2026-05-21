/**
 * server-core.js — Shared Express app (local dev + Netlify Functions)
 * QR image is generated WITHOUT Jimp (logo overlay happens client-side via Canvas)
 */

const express  = require('express');
const QRCode   = require('qrcode');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('./storage');

function shortId() { return uuidv4().replace(/-/g,'').slice(0, 8); }

function createApp() {
  const app = express();
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // ── /r/:code — Dynamic redirect ──────────────────────────────────────────
  app.get('/r/:code', async (req, res) => {
    try {
      const data = await readData();
      let found = null;
      for (const camp of Object.values(data.campaigns || {})) {
        if (camp.qrCodes?.[req.params.code]) {
          found = { camp, entry: camp.qrCodes[req.params.code] };
          break;
        }
      }
      if (!found?.entry?.target) {
        return res.status(404).send(`
          <html><body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;
          align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;">
            <h2 style="color:#e63946;">QR Code Not Configured</h2>
            <p>No destination URL has been set for this QR code.</p>
          </body></html>`);
      }
      // Fire-and-forget scan count (non-blocking)
      found.entry.scanCount = (found.entry.scanCount || 0) + 1;
      found.entry.lastScanned = new Date().toISOString();
      writeData(data).catch(console.error);

      res.redirect(302, found.entry.target);
    } catch (err) {
      console.error('Redirect error:', err);
      res.status(500).send('Internal error');
    }
  });

  // ── Campaigns ─────────────────────────────────────────────────────────────
  app.get('/api/campaigns', async (req, res) => {
    const data = await readData();
    res.json(data.campaigns || {});
  });

  app.post('/api/campaigns', async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const data = await readData();
    const id = shortId();
    data.campaigns[id] = {
      id, name, description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      qrCodes: {}
    };
    await writeData(data);
    res.json({ id, campaign: data.campaigns[id] });
  });

  app.put('/api/campaigns/:id', async (req, res) => {
    const { name, description } = req.body;
    const data = await readData();
    const camp = data.campaigns[req.params.id];
    if (!camp) return res.status(404).json({ error: 'Campaign not found' });
    if (name) camp.name = name;
    if (description !== undefined) camp.description = description;
    camp.updatedAt = new Date().toISOString();
    await writeData(data);
    res.json({ success: true, campaign: camp });
  });

  app.delete('/api/campaigns/:id', async (req, res) => {
    const data = await readData();
    if (!data.campaigns[req.params.id]) return res.status(404).json({ error: 'Not found' });
    delete data.campaigns[req.params.id];
    await writeData(data);
    res.json({ success: true });
  });

  // ── QR Codes ──────────────────────────────────────────────────────────────
  app.get('/api/campaigns/:campId/qrcodes', async (req, res) => {
    const data = await readData();
    const camp = data.campaigns[req.params.campId];
    if (!camp) return res.status(404).json({ error: 'Campaign not found' });
    res.json(camp.qrCodes || {});
  });

  app.post('/api/campaigns/:campId/qrcodes', async (req, res) => {
    const { label, target } = req.body;
    if (!label) return res.status(400).json({ error: 'Label is required' });
    const data = await readData();
    const camp = data.campaigns[req.params.campId];
    if (!camp) return res.status(404).json({ error: 'Campaign not found' });
    if (!camp.qrCodes) camp.qrCodes = {};
    const code = shortId();
    camp.qrCodes[code] = {
      code, label, target: target || '',
      campaignId: req.params.campId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scanCount: 0, lastScanned: null,
      history: target ? [{ url: target, setAt: new Date().toISOString() }] : []
    };
    await writeData(data);
    res.json({ code, redirectUrl: `${BASE_URL}/r/${code}`, entry: camp.qrCodes[code] });
  });

  app.put('/api/campaigns/:campId/qrcodes/:code', async (req, res) => {
    const { target, label } = req.body;
    const data = await readData();
    const camp = data.campaigns[req.params.campId];
    const entry = camp?.qrCodes?.[req.params.code];
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (target !== undefined && target !== entry.target) {
      if (entry.target) {
        entry.history = entry.history || [];
        entry.history.unshift({ url: entry.target, replacedAt: new Date().toISOString() });
        if (entry.history.length > 20) entry.history = entry.history.slice(0, 20);
      }
      entry.target = target;
    }
    if (label) entry.label = label;
    entry.updatedAt = new Date().toISOString();
    await writeData(data);
    res.json({ success: true, entry });
  });

  app.delete('/api/campaigns/:campId/qrcodes/:code', async (req, res) => {
    const data = await readData();
    const camp = data.campaigns[req.params.campId];
    if (!camp?.qrCodes?.[req.params.code]) return res.status(404).json({ error: 'Not found' });
    delete camp.qrCodes[req.params.code];
    await writeData(data);
    res.json({ success: true });
  });

  // ── QR Image (plain PNG — logo overlay is done client-side) ───────────────
  app.get('/api/qr/:code', async (req, res) => {
    try {
      const data = await readData();
      let entry = null;
      for (const camp of Object.values(data.campaigns || {})) {
        if (camp.qrCodes?.[req.params.code]) { entry = camp.qrCodes[req.params.code]; break; }
      }
      if (!entry) return res.status(404).json({ error: 'Not found' });

      const redirectUrl = `${BASE_URL}/r/${req.params.code}`;
      const qrBuffer = await QRCode.toBuffer(redirectUrl, {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 600,
        margin: 2,
        color: { dark: '#0a0a0f', light: '#ffffff' }
      });

      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache');
      res.send(qrBuffer);
    } catch (err) {
      console.error('QR gen error:', err.message);
      res.status(500).json({ error: 'QR generation failed' });
    }
  });

  return app;
}

module.exports = { createApp };
