Deployment (Render + Supabase Auth)

1) Supabase setup
- Enable Google provider in Supabase Auth.
- Add redirect URLs:
  - https://<your-render-url>/ (and /changelog, /authors if needed)
- Get:
  - SUPABASE_URL (Project Settings → API)
  - SUPABASE_ANON_KEY (Project Settings → API)

2) Render setup
- Create a new Web Service from this repo.
- Render will read render.yaml automatically.
- Set environment variables:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - ALLOWED_EMAIL_DOMAINS (comma-separated, e.g. mercor.com,c-mercor.com)
  - MERCOR_API_KEY (for scrape job)
  - MERCOR_CAMPAIGN_ID
  - MERCOR_COMPANY_ID

3) Data refresh
- Run `python3 src/scrape.py` locally and push the updated `data/` files, or
- Add a scheduled job in Render to run `python3 src/scrape.py` (requires the same env vars as scrape).
  - A cron job is defined in `render.yaml` to run every 30 minutes.
  - You can change the schedule in `render.yaml` under `cron`.

Notes
- The frontend pulls data from `/api/data` and `/api/changelog`, which require a valid Supabase JWT.
- Only users with emails matching ALLOWED_EMAIL_DOMAIN can access the API.

Supabase redirect URLs for this app
- https://rls-81e2.onrender.com/
- https://rls-81e2.onrender.com/changelog
- https://rls-81e2.onrender.com/authors
