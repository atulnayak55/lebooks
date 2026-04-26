# Deployment

This repo is set up to run on a VM with Docker Compose and Caddy serving the frontend, issuing HTTPS certificates, and proxying `/api` to FastAPI.

## Expected Public URL

The pilot production target is:

- `https://lebooks.it`
- `https://www.lebooks.it` redirects to `https://lebooks.it`

Password reset emails will use that public URL.

## DNS

At your domain registrar, create or update these records:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `46.225.99.187` |
| A | `www` | `46.225.99.187` |

If your registrar uses the full host name, use `lebooks.it` instead of `@` and `www.lebooks.it` instead of `www`.

## Server Requirements

- Docker Engine
- Docker Compose plugin
- Ports `80` and `443` open on the VM firewall/security group
- SSH access to pull from `git@github.com:atulnayak55/lebooks.git`

## First Deploy

1. Copy `.env.example` to `.env`
2. Fill in at least:
   - `APP_HOST=lebooks.it`
   - `APP_SCHEME=https`
   - `APP_SITE=lebooks.it, www.lebooks.it`
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET_KEY`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
3. From the repo root run:

```bash
docker compose up -d --build
```

## Updating Production

From the server repo directory:

```bash
git pull
docker compose up -d --build
docker compose ps
```

## Verification

```bash
docker compose ps
docker compose logs backend --tail=100
docker compose logs caddy --tail=100
curl -I https://lebooks.it
curl https://lebooks.it/api/health
```

Expected health response:

```json
{"status":"ok"}
```

## Services

- `caddy`: serves the built React app and proxies `/api/*` to FastAPI
- `backend`: runs Alembic migrations and starts FastAPI on internal port `8000`
- `db`: PostgreSQL 16 with a persistent named volume

## Notes

- The frontend talks to the backend through same-origin `/api`
- Uploaded files are persisted in the `backend_uploads` volume
- PostgreSQL data is persisted in the `postgres_data` volume
- Caddy certificates and config are persisted in the `caddy_data` and `caddy_config` volumes
- If you temporarily deploy directly on the raw IP, use `APP_SCHEME=http`, `APP_HOST=46.225.99.187`, and `APP_SITE=:80`

## Rollback

If a deployment fails after a new commit:

```bash
git log --oneline -5
git checkout <previous-good-commit>
docker compose up -d --build
```

When ready to return to normal updates:

```bash
git switch main
```
