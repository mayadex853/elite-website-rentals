# Elite Website Rentals

Marketing site for elitewebsiterentals.com. Static HTML/CSS plus one Vercel function.

- Vercel project: `elite-website-rentals`, deploys from `main` of this repo (Root Directory left blank).
- `api/contact.js` emails contact form leads via Resend. Requires the `RESEND_API_KEY` env var in Vercel; every submission is also logged in the Vercel runtime logs.
