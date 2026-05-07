# SAREGO Deployment Guide

Production hosting for the SAREGO platform.

## Architecture

sarego.africa             ->  Vercel        (frontend, React+Vite)
www.sarego.africa         ->  Vercel        (redirects to apex)
api.sarego.africa         ->  Render        (backend, Node+Express)
[managed]                 ->  Supabase      (Postgres database)

## Production environment variables

### Backend (Render)

Set in Render dashboard under Environment for the sarego-api service. Do not commit these values.

| Variable               | Value                                                                  | Notes                                  |
|------------------------|------------------------------------------------------------------------|----------------------------------------|
| NODE_ENV               | production                                                             | (set automatically via render.yaml)    |
| PORT                   | 4000                                                                   | (set automatically via render.yaml)    |
| DATABASE_URL           | Supabase pooled connection string                                      | Same as in local .env                  |
| JWT_ACCESS_SECRET      | 64-byte hex string                                                     | Generate fresh for production          |
| JWT_REFRESH_SECRET     | 64-byte hex string                                                     | Generate fresh for production          |
| JWT_ACCESS_TTL         | 15m                                                                    | (set via render.yaml)                  |
| JWT_REFRESH_TTL_DAYS   | 7                                                                      | (set via render.yaml)                  |
| CORS_ORIGIN            | https://sarego.africa,https://www.sarego.africa                        | Comma-separated allowed origins        |
| COOKIE_DOMAIN          | .sarego.africa                                                         | Leading dot for subdomains             |
| COOKIE_SECURE          | true                                                                   | (set via render.yaml)                  |

To generate a fresh JWT secret:

    node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

### Frontend (Vercel)

Set in Vercel project Settings -> Environment Variables:

| Variable                      | Value                          |
|-------------------------------|--------------------------------|
| VITE_API_URL                  | https://api.sarego.africa      |

## DNS records (Bluehost)

In Bluehost DNS Manager for sarego.africa, add:

| Type    | Host | Value                          | TTL  |
|---------|------|--------------------------------|------|
| A       | @    | 76.76.21.21                    | 1 h  |
| CNAME   | www  | cname.vercel-dns.com           | 1 h  |
| CNAME   | api  | sarego-api.onrender.com        | 1 h  |

Vercel may give a different A record IP - always use the value Vercel shows in its domain config UI.

## Deploy procedure

### First deploy

1. Render
   - Sign in with GitHub at https://render.com
   - New -> Blueprint -> select SAREGO-AFRICA/platform -> it picks up render.yaml
   - Add the secret env vars listed above
   - Wait for first build (~3-5 min)
   - Confirm https://sarego-api.onrender.com/health returns ok

2. Vercel
   - Sign in with GitHub at https://vercel.com
   - New Project -> import SAREGO-AFRICA/platform
   - Vercel detects vercel.json automatically
   - Add VITE_API_URL=https://api.sarego.africa
   - Deploy

3. Domain
   - In Vercel, add custom domain sarego.africa and www.sarego.africa
   - In Render, add custom domain api.sarego.africa
   - Add DNS records in Bluehost (table above)
   - Wait for DNS propagation (typically 5-30 min)
   - Both platforms issue SSL certs automatically once DNS resolves

### Subsequent deploys

Push to main. Vercel and Render auto-redeploy.

## Common issues

CORS error in browser console -> make sure CORS_ORIGIN on Render includes your real domain
Cookies not setting -> COOKIE_DOMAIN=.sarego.africa and COOKIE_SECURE=true must be set on Render
Backend 503 on first hit -> free tier waking up; refresh after a minute
404 on direct route visit -> confirm vercel.json rewrites are live
