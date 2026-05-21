fetch('https://qr-codegen-manager.netlify.app/api/campaigns', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'test' })
}).then(r => r.text()).then(console.log).catch(console.error);
