# Supabase Security Configuration

This document explains how to apply the security fixes for your Supabase project.

## Security Issues Fixed

1. **Auth DB Connection Strategy** - Changed to percentage-based allocation
2. **Leaked Password Protection** - Enabled HaveIBeenPwned integration

## Applying to Your Hosted Project

### Option 1: Using Supabase Dashboard (Recommended)

#### Fix 1: Auth DB Connection Strategy

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Database**
4. Scroll to **Connection pooling** section
5. Find **Auth pool mode** or **Connection pool configuration**
6. Change from **Fixed (10 connections)** to **Percentage-based**
7. Set pool size to **20%** (recommended)
8. Click **Save**

#### Fix 2: Enable Leaked Password Protection

1. In your Supabase Dashboard
2. Navigate to **Authentication** → **Policies** (or **Authentication** → **Settings**)
3. Scroll to **Security and Protection** section
4. Find **Leaked Password Protection** or **Password Breach Detection**
5. Toggle it **ON** to enable HaveIBeenPwned integration
6. Click **Save**

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed and linked to your project:

```bash
# Link your project (if not already linked)
supabase link --project-ref your-project-ref

# Push the configuration
supabase db push

# Or manually update auth settings
supabase secrets set AUTH_PASSWORD_PWNED_CHECK_ENABLED=true
```

## Local Development

The `config.toml` file in this directory is already configured with these security settings for local development. When you run:

```bash
supabase start
```

These settings will be automatically applied to your local Supabase instance.

## Verification

After applying these changes, verify they're active:

1. **Connection Strategy**: Check Dashboard → Settings → Database → Connection pooling shows percentage-based
2. **Leaked Password Protection**: Try signing up with a known compromised password (e.g., "password123") - it should be rejected

## Additional Security Recommendations

- Enable MFA (Multi-Factor Authentication) for admin accounts
- Set up Row Level Security (RLS) policies on all tables (already done in migrations)
- Enable email verification for production environments
- Configure rate limiting for authentication endpoints
- Review and rotate API keys regularly
