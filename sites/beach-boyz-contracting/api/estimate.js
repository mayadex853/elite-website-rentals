// Estimate-request handler for Beach Boyz Contracting.
// Same architecture as the root Elite Website Rentals contact form (api/contact.js):
// a Vercel serverless function that emails each submission via Resend. This shape
// is meant to be copy-pasted for future EWR customer sites — only TO/FROM and the
// field list change per business.
//
// Env vars (set in Vercel -> this project -> Settings -> Environment Variables):
//   RESEND_API_KEY   required to send email
//   CONTACT_TO       required — the real inbox that should receive Beach Boyz leads.
//                    There is no default here on purpose: unlike the EWR team inbox,
//                    no verified monitoring address for Beach Boyz has been confirmed
//                    yet, so this must be set explicitly before the form can deliver.
//   CONTACT_FROM     optional, defaults to Resend's shared sender (works without
//                    verifying a domain, as long as CONTACT_TO is the address the
//                    Resend account was created with)
//
// Until both RESEND_API_KEY and CONTACT_TO are set, submissions are logged (visible
// in Vercel's function logs) but NOT delivered anywhere, and the form tells the
// visitor to call or text instead rather than claiming the message went through.

const FROM = process.env.CONTACT_FROM || 'Beach Boyz Contracting <onboarding@resend.dev>';
const FIELDS = ['name', 'phone', 'email', 'city', 'service', 'details'];
const LABELS = {
  name: 'Name', phone: 'Phone', email: 'Email', city: 'City',
  service: 'Service needed', details: 'Project details',
};

const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  // Honeypot: real visitors never fill this hidden field. Pretend success for bots.
  if (body.company_url) return res.status(200).json({ ok: true });

  const data = {};
  for (const f of FIELDS) data[f] = String(body[f] || '').trim().slice(0, f === 'details' ? 5000 : 300);

  if (!data.name || !data.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).json({ error: 'Name, phone, and a valid email are required.' });
  }

  console.log('NEW ESTIMATE REQUEST', JSON.stringify(data));

  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_TO) {
    console.error('Lead delivery not configured: RESEND_API_KEY and/or CONTACT_TO env var missing. Lead logged but not emailed.');
    return res.status(503).json({ error: 'Estimate requests are not yet configured for email delivery. Please call or text (949) 510-8296.' });
  }

  const rows = FIELDS.filter((f) => data[f]).map(
    (f) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6676;vertical-align:top;white-space:nowrap">${LABELS[f]}</td>` +
      `<td style="padding:6px 0;white-space:pre-wrap">${escape(data[f])}</td></tr>`
  ).join('');
  const text = FIELDS.filter((f) => data[f]).map((f) => `${LABELS[f]}: ${data[f]}`).join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [process.env.CONTACT_TO],
        reply_to: data.email,
        subject: `New estimate request: ${data.name} (${data.city || 'city not given'})`,
        html: `<h2 style="font-family:sans-serif">New estimate request from the Beach Boyz Contracting site</h2>` +
          `<table style="font-family:sans-serif;font-size:15px">${rows}</table>`,
        text,
      }),
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      return res.status(502).json({ error: 'Could not send email' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend request failed', err);
    return res.status(502).json({ error: 'Could not send email' });
  }
};
