/**
 * GitHub App Manifest Flow — Step 1
 *
 * Redirects to GitHub's App creation page with a pre-filled manifest.
 * User clicks "Create GitHub App" once, and we get back credentials automatically.
 *
 * Usage: visit /api/auth/setup in a browser (one-time setup, owner only)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Guard: only allow if not already configured
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    return res.status(200).json({
      status: 'already_configured',
      message: 'GitHub App credentials are already set. No setup needed.',
      client_id: process.env.GITHUB_CLIENT_ID,
    })
  }

  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:5173'

  const callbackUrl = `${host}/api/auth/setup/callback`

  const manifest = {
    name: 'Session Brain',
    url: host,
    hook_attributes: { url: `${host}/api/webhook`, active: false },
    redirect_url: callbackUrl,
    callback_urls: [`${host}/api/auth/callback`],
    description: 'Personal AI session article reader — per-user private access',
    public: false,
    default_permissions: {
      // Read-only: we only need to identify the user
    },
    default_events: [],
    // Request user identity (equivalent to OAuth scope: read:user)
    request_oauth_on_install: true,
  }

  // GitHub Manifest Flow: POST the manifest as a form field
  // We embed it in an auto-submitting HTML form (GitHub requires POST, not GET)
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Setting up Session Brain GitHub App...</title>
  <style>
    body { font-family: system-ui; background: #0a0a1a; color: #e2e8f0;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .card { background: #1a1a2e; border: 1px solid #2d2d4a; border-radius: 12px;
            padding: 32px; max-width: 400px; text-align: center; }
    h2 { color: #06b6d4; margin: 0 0 12px; }
    p { color: #94a3b8; margin: 0 0 24px; line-height: 1.5; }
    .spinner { width: 24px; height: 24px; border: 2px solid #2d2d4a;
               border-top-color: #06b6d4; border-radius: 50%;
               animation: spin 0.8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <h2>One-time GitHub App Setup</h2>
    <p>Redirecting you to GitHub to create the Session Brain app.<br>
       You'll click <strong>"Create GitHub App"</strong> once — that's it.</p>
    <div class="spinner"></div>
  </div>
  <form id="f" method="post" action="https://github.com/settings/apps/new">
    <input type="hidden" name="manifest" value="${JSON.stringify(manifest).replace(/"/g, '&quot;')}">
  </form>
  <script>document.getElementById('f').submit()</script>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(html)
}
