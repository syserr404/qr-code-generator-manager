require('dotenv').config();
const { createApp } = require('./server-core');

const PORT = process.env.PORT || 3000;
const app  = createApp();

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   Xduce Dynamic QR Generator             ║');
  console.log(`  ║   Local:  http://localhost:${PORT}           ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  const { readData } = require('./storage');
  const using = process.env.GITHUB_TOKEN ? 'GitHub Gist' : 'Local file (redirects.json)';
  console.log(`  Storage: ${using}`);
  console.log('');
});
