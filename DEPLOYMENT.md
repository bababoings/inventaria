# Deployment Guide for AI Ask Feature

## Quick Start

The AI Ask feature requires a Supabase Edge Function to be deployed. If you're seeing a 404 error, the function hasn't been deployed yet.

## Step-by-Step Deployment

### 1. Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

Or using Homebrew (macOS):
```bash
brew install supabase/tap/supabase
```

### 2. Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate.

### 3. Link Your Project

```bash
supabase link --project-ref nvmnpczxnptmfqgwfiqf
```

You'll need your project's database password. You can find it in your Supabase dashboard under Project Settings > Database.

### 4. Set the OpenAI API Key

```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
```

Replace `your-openai-api-key-here` with your actual OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys).

### 5. Deploy the Edge Function

```bash
supabase functions deploy ai-ask
```

### 6. Verify Deployment

After deployment, you should see a success message. The function will be available at:
```
https://nvmnpczxnptmfqgwfiqf.supabase.co/functions/v1/ai-ask
```

## Alternative: Deploy via Supabase Dashboard

If you prefer not to use the CLI:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Edge Functions** in the sidebar
4. Click **Create a new function**
5. Name it `ai-ask`
6. Copy the contents of `supabase/functions/ai-ask/index.ts` into the editor
7. Click **Deploy**
8. Go to **Project Settings** > **Edge Functions** > **Secrets**
9. Add a new secret:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

## Troubleshooting

### 404 Error
- **Cause**: Function not deployed
- **Solution**: Follow the deployment steps above

### CORS Error
- **Cause**: CORS headers not properly set (should be fixed in the latest version)
- **Solution**: Make sure you've deployed the latest version of the function

### 401 Unauthorized Error
- **Cause**: User not authenticated or session expired
- **Solution**: Make sure the user is logged in

### 500 Internal Server Error
- **Cause**: OpenAI API key not set or invalid
- **Solution**: Verify the API key is set correctly:
  ```bash
  supabase secrets list
  ```

### Function Not Found After Deployment
- **Cause**: Function name mismatch or deployment failed
- **Solution**: 
  1. Check the function name is exactly `ai-ask`
  2. Verify deployment was successful
  3. Check Supabase dashboard to see if function appears in Edge Functions list

## Testing the Function

After deployment, you can test it directly:

```bash
curl -X POST https://nvmnpczxnptmfqgwfiqf.supabase.co/functions/v1/ai-ask \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "What should I reorder today?"}'
```

Replace `YOUR_ANON_KEY` with your Supabase anon key from the dashboard.

