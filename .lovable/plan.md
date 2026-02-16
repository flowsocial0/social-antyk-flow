

## Fix: Pinterest Connection Test - Use Sandbox API for Everything

### Problem
Pinterest "Trial" access apps must use the sandbox API (`api-sandbox.pinterest.com`) for **all** API calls, not just writes. The current code uses the production API for the connection test, which returns 401 "Authentication failed."

The OAuth callback works because Pinterest allows the token exchange and initial user info fetch during the OAuth flow itself, but all subsequent API calls must go through sandbox.

### Solution
Change the connection test in `publish-to-pinterest` to use the sandbox API endpoint instead of the production API.

### Technical Details

**File: `supabase/functions/publish-to-pinterest/index.ts`**

- Line 59: Change `${PINTEREST_API_PROD}` to `${PINTEREST_API_SANDBOX}` for the `/v5/user_account` call in the test connection block
- Simplify the constants: since both reads and writes use sandbox, we can use a single `PINTEREST_API_BASE` constant pointing to sandbox, with a comment noting this needs to change to production after full access approval
- Redeploy the edge function

This is a one-line change that switches the test connection endpoint from `api.pinterest.com` to `api-sandbox.pinterest.com`.

