# Fixcar Deployment Design

## Overview

Deploy the fixcar static site (a single `index.html` — a 2013 Camaro RS fender installation guide) to `fixcar.raiteri.net` using Cloudflare Pages with GitHub auto-deploy.

## Architecture

```
GitHub (fixcar, public)
    │
    │  push to main
    ▼
Cloudflare Pages (auto-build)
    │
    │  no build step, serves static files
    ▼
fixcar.raiteri.net (CNAME → Pages)
```

## Components

### 1. GitHub Repository

- **Name:** `fixcar`
- **Visibility:** Public
- **Contents:** `index.html` + any future app code
- **Owner:** User's GitHub account

### 2. Cloudflare Pages Project

- **Project name:** `fixcar`
- **Connected to:** `fixcar` GitHub repo
- **Production branch:** `main`
- **Build command:** None (static site)
- **Build output directory:** `/` (root)
- **Framework preset:** None

### 3. DNS

- **Record:** CNAME `fixcar` on `raiteri.net` zone
- **Target:** `fixcar.pages.dev` (Cloudflare Pages default domain)
- **Proxied:** Yes (Cloudflare orange cloud)
- Cloudflare Pages automatically provisions SSL for custom domains

## Deploy Flow

1. Push code to `main` branch on GitHub
2. Cloudflare Pages detects the push and deploys
3. Site is live at `fixcar.raiteri.net` (and `fixcar.pages.dev`)

## Future Considerations

- When migrating to React, add a build command (`npm run build`) and output directory (`dist` or `build`) in Pages settings
- No changes to DNS or repo structure needed for that migration
