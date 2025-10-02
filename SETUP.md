# SocialFlow Setup Guide

## Step 1: Set Up Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for your project to be provisioned
3. Go to Project Settings > API
4. Copy your project URL and anon/public key

## Step 2: Run Database Schema

1. In your Supabase dashboard, go to SQL Editor
2. Open the `supabase-schema.sql` file from this project
3. Copy and paste the entire SQL script
4. Click "Run" to create all tables and policies

## Step 3: Configure the App

1. Open `src/integrations/supabase/client.ts`
2. Replace `YOUR_SUPABASE_URL` with your project URL
3. Replace `YOUR_SUPABASE_ANON_KEY` with your anon/public key

## Step 4: Enable Authentication

1. In Supabase dashboard, go to Authentication > Providers
2. Enable Email provider
3. (Optional) Disable email confirmation for testing: Settings > Auth > Email Confirmations

## Step 5: Social Media API Setup (Future)

For Facebook, X (Twitter), and Instagram integrations, you'll need to:
- Create developer accounts on each platform
- Generate API keys and access tokens
- Store them securely in the `platform_connections` table

## Next Steps

After setup, you can:
- Import books via CSV or manually
- Connect social media platforms
- Schedule posts across platforms
- Monitor publishing activity

## Security Notes

- Never commit your Supabase credentials to version control
- Use environment variables for production deployments
- Keep API keys encrypted in the database
