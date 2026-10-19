// Contact form handler: emails each inquiry to the team via Resend.
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY  required to send email
//   CONTACT_TO      optional, defaults to team@elitewebsiterentals.com
//   CONTACT_FROM    optional, defaults to Resend's shared sender (works without
//                   verifying a domain, as long as CONTACT_TO is the address the
//                   Resend account was created with)
// Every submission is also logged, so a lead is never lost if email fails.

const TO = process.env.CONTACT_TO || 'team@elitewebsiterentals.com';
const FROM = process.env.CONTACT_FROM || 'Elite Website Rentals <onboarding@resend.dev>';
const FIELDS = ['name', 'business', 'email', 'phone', 'website', 'interest', 'message'];
const LABELS = {
  name: 'Name', business: 'Business', email: 'Email', phone: 'Phone',
  website: 'Current website', interest: 'Interested in', message: 'Message',
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
  for (const f of FIELDS) data[f] = String(body[f] || '').trim().slice(0, f === 'message' ? 5000 : 300);

  if (!data.name || !data.business || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).json({ error: 'Name, business, and a valid email are required.' });
  }

  console.log('NEW LEAD', JSON.stringify(data));

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set; lead logged but not emailed.');
    return res.status(503).json({ error: 'Email not configured' });
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
        to: [TO],
        reply_to: data.email,
        subject: `New website inquiry: ${data.business}`,
        html: `<h2 style="font-family:sans-serif">New inquiry from elitewebsiterentals.com</h2>` +
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
