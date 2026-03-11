# Supabase Email Templates

Paste these templates into **Supabase Dashboard → Authentication → Email Templates**.

---

## 1. Confirm Signup

**Subject:** `Confirm your GrantLume account`

**Body (HTML):**

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="padding:32px 24px;background:linear-gradient(135deg,#2563eb 0%,#4338ca 100%);border-radius:12px 12px 0 0;text-align:center;">
    <div style="display:inline-block;width:48px;height:48px;line-height:48px;background:rgba(255,255,255,0.2);border-radius:12px;font-size:24px;font-weight:bold;color:#fff;">G</div>
    <h1 style="margin:12px 0 0;color:#fff;font-size:22px;">Welcome to GrantLume</h1>
  </div>
  <div style="padding:32px 24px;background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">Thank you for signing up! Please confirm your email address to activate your account and start your <strong>14-day free trial</strong>.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Confirm Email Address</a>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">This link will expire in 24 hours. If you didn't create a GrantLume account, you can safely ignore this email.</p>
  </div>
  <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#9ca3af;">GrantLume Ltd. — Grant project management made simple</p>
</div>
```

---

## 2. Magic Link

**Subject:** `Your GrantLume login link`

**Body (HTML):**

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="padding:32px 24px;background:linear-gradient(135deg,#2563eb 0%,#4338ca 100%);border-radius:12px 12px 0 0;text-align:center;">
    <div style="display:inline-block;width:48px;height:48px;line-height:48px;background:rgba(255,255,255,0.2);border-radius:12px;font-size:24px;font-weight:bold;color:#fff;">G</div>
    <h1 style="margin:12px 0 0;color:#fff;font-size:22px;">Sign in to GrantLume</h1>
  </div>
  <div style="padding:32px 24px;background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">Click the button below to sign in to your GrantLume account.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Sign In</a>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  </div>
  <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#9ca3af;">GrantLume Ltd. — Grant project management made simple</p>
</div>
```

---

## 3. Reset Password

**Subject:** `Reset your GrantLume password`

**Body (HTML):**

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="padding:32px 24px;background:linear-gradient(135deg,#2563eb 0%,#4338ca 100%);border-radius:12px 12px 0 0;text-align:center;">
    <div style="display:inline-block;width:48px;height:48px;line-height:48px;background:rgba(255,255,255,0.2);border-radius:12px;font-size:24px;font-weight:bold;color:#fff;">G</div>
    <h1 style="margin:12px 0 0;color:#fff;font-size:22px;">Reset Your Password</h1>
  </div>
  <div style="padding:32px 24px;background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">We received a request to reset the password for your GrantLume account. Click the button below to set a new password.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Reset Password</a>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
  </div>
  <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#9ca3af;">GrantLume Ltd. — Grant project management made simple</p>
</div>
```

---

## 4. Change Email Address

**Subject:** `Confirm your new email address — GrantLume`

**Body (HTML):**

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="padding:32px 24px;background:linear-gradient(135deg,#2563eb 0%,#4338ca 100%);border-radius:12px 12px 0 0;text-align:center;">
    <div style="display:inline-block;width:48px;height:48px;line-height:48px;background:rgba(255,255,255,0.2);border-radius:12px;font-size:24px;font-weight:bold;color:#fff;">G</div>
    <h1 style="margin:12px 0 0;color:#fff;font-size:22px;">Confirm Email Change</h1>
  </div>
  <div style="padding:32px 24px;background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">Click the button below to confirm changing your email address to this address.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Confirm Email Change</a>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">If you didn't request this change, please contact support immediately at support@grantlume.com.</p>
  </div>
  <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#9ca3af;">GrantLume Ltd. — Grant project management made simple</p>
</div>
```

---

## Notes

- All templates use `{{ .ConfirmationURL }}` — this is Supabase's built-in variable for the confirmation link.
- The GrantLume blue gradient matches the app's login/signup pages.
- Configure these at: **Supabase Dashboard → Authentication → Email Templates**
