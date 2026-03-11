# OAuth Provider Setup Guide

This guide walks you through enabling Google, Microsoft (Azure AD), and Slack social login in your Supabase project for GrantLume.

## Prerequisites

- Access to your Supabase project dashboard
- Your app URL: `https://app.grantlume.com`
- Supabase callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`

You can find your Supabase callback URL at:
**Supabase Dashboard → Authentication → Providers → (any provider) → Callback URL**

---

## 1. Google

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Application type: **Web application**
6. Name: `GrantLume`
7. **Authorized JavaScript origins:**
   ```
   https://app.grantlume.com
   ```
8. **Authorized redirect URIs:**
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
9. Click **Create** and copy the **Client ID** and **Client Secret**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. User Type: **External** (or Internal if using Google Workspace)
3. Fill in:
   - App name: `GrantLume`
   - User support email: `support@grantlume.com`
   - Developer contact email: `dev@grantlume.com`
4. Scopes: add `email`, `profile`, `openid`
5. Save and publish (move from Testing to Production when ready)

### Step 3: Enable in Supabase

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Find **Google** and toggle it **ON**
3. Paste the **Client ID** and **Client Secret**
4. Click **Save**

---

## 2. Microsoft (Azure AD)

### Step 1: Register an App in Azure

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Name: `GrantLume`
4. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
5. Redirect URI:
   - Platform: **Web**
   - URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
6. Click **Register**

### Step 2: Get Client ID & Secret

1. Copy the **Application (client) ID** from the Overview page
2. Go to **Certificates & secrets → New client secret**
3. Description: `GrantLume Supabase Auth`
4. Expiry: choose appropriate duration (e.g., 24 months)
5. Click **Add** and immediately copy the **Value** (you won't see it again)

### Step 3: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission → Microsoft Graph → Delegated permissions**
3. Add: `email`, `openid`, `profile`, `User.Read`
4. Click **Grant admin consent** (if you have admin access)

### Step 4: Enable in Supabase

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Find **Azure (Microsoft)** and toggle it **ON**
3. Paste:
   - **Azure Tenant URL**: `https://login.microsoftonline.com/common` (for multi-tenant)
   - **Client ID**: Application (client) ID from Azure
   - **Client Secret**: The secret value you copied
4. Click **Save**

---

## 3. Slack

### Step 1: Create a Slack App

1. Go to [Slack API → Your Apps](https://api.slack.com/apps)
2. Click **Create New App → From scratch**
3. App Name: `GrantLume`
4. Workspace: select your development workspace
5. Click **Create App**

### Step 2: Configure OAuth & Permissions

1. Go to **OAuth & Permissions**
2. **Redirect URLs** → Add:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
3. **User Token Scopes** → Add:
   - `identity.basic`
   - `identity.email`
   - `identity.avatar`

### Step 3: Get Client ID & Secret

1. Go to **Basic Information**
2. Copy the **Client ID** and **Client Secret**

### Step 4: Enable in Supabase

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Find **Slack** and toggle it **ON**
3. Paste the **Client ID** and **Client Secret**
4. Click **Save**

---

## Verification

After enabling each provider:

1. Go to `https://app.grantlume.com/login`
2. Click the provider button (Google / Slack / Microsoft)
3. You should be redirected to the provider's login page
4. After authenticating, you'll be redirected back to `/auth/callback`
5. If this is a new account, you'll land on the onboarding wizard

### Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `provider is not enabled` | Provider not toggled ON in Supabase | Enable it in Supabase → Auth → Providers |
| `redirect_uri_mismatch` | Callback URL mismatch | Ensure the Supabase callback URL is added to the provider's redirect URIs |
| `invalid_client` | Wrong client ID or secret | Double-check credentials in Supabase |
| `access_denied` | User denied consent | User must approve the requested permissions |
| OAuth consent screen in "Testing" mode | Only test users can sign in (Google) | Add users to test list or publish the consent screen |

---

## Environment Variables

No additional `.env` variables are needed for OAuth — all configuration lives in Supabase Dashboard. The frontend uses `signInWithOAuth()` which redirects to Supabase, which handles the provider redirect.

The only required env vars remain:
```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```
