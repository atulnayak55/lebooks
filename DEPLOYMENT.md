# Deployment

This repo is set up to run on a VM with Docker Compose and Caddy serving the frontend on port `80`.

## Expected Public URL

The current production target is:

- `http://46.225.99.187`

Password reset emails will use that public URL.

## Steps

1. Copy `.env.example` to `.env`
2. Fill in at least:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET_KEY`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
3. Open port `80` on the VM firewall/security group
4. From the repo root run:

```bash
docker compose up -d --build
```

## Services

- `caddy`: serves the built React app and proxies `/api/*` to FastAPI
- `backend`: runs Alembic migrations and starts FastAPI on internal port `8000`
- `db`: PostgreSQL 16 with a persistent named volume

## Notes

- The frontend talks to the backend through same-origin `/api`
- Uploaded files are persisted in the `backend_uploads` volume
- PostgreSQL data is persisted in the `postgres_data` volume
- This setup is HTTP-only because the app is deployed directly on a raw IP. For HTTPS, use a real domain and point DNS to the VM
