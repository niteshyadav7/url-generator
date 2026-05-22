# url-generator

Amazon link generator built with React and Vite.

## Deployment

This project is frontend-only. It does not need backend services, Supabase, or Vercel environment variables.

Vercel settings:

```text
Root Directory: client
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

## Local Development

```bash
cd client
npm install
npm run dev
```

Generated links, keyword tags, and settings are saved in the browser with `localStorage`.
