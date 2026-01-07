# AI Ask Edge Function

This Supabase Edge Function integrates with the OpenAI API to provide AI-powered inventory management assistance.

## Setup

### 1. Get your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the API key (you won't be able to see it again)

### 2. Set the Environment Variable

You need to set the `OPENAI_API_KEY` environment variable in your Supabase project.

#### Using Supabase CLI (Local Development)

```bash
supabase secrets set OPENAI_API_KEY=your-api-key-here
```

#### Using Supabase Dashboard (Production)

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** > **Edge Functions** > **Secrets**
3. Add a new secret:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

### 3. Deploy the Edge Function

#### Option A: Using Supabase CLI (Recommended)

First, make sure you have the Supabase CLI installed:
```bash
npm install -g supabase
```

Then login and link your project:
```bash
supabase login
supabase link --project-ref nvmnpczxnptmfqgwfiqf
```

Deploy the function:
```bash
supabase functions deploy ai-ask
```

#### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** in the sidebar
3. Click **Create a new function**
4. Name it `ai-ask`
5. Copy the contents of `index.ts` into the function editor
6. Click **Deploy**

**Note:** The 404 error you're seeing means the function hasn't been deployed yet. Once deployed, the function will be available at:
```
https://nvmnpczxnptmfqgwfiqf.supabase.co/functions/v1/ai-ask
```

## Usage

The Edge Function is automatically called by the AIAsk component when a user sends a message. It:

1. Authenticates the user via Supabase Auth
2. Receives the user's message and inventory/sales context
3. Calls the OpenAI API with a system prompt that includes the context
4. Returns the AI-generated response

## API Endpoint

The function is available at:
```
https://<your-project-ref>.supabase.co/functions/v1/ai-ask
```

## Request Format

```json
{
  "message": "What should I reorder today?",
  "context": {
    "inventory": [
      {
        "name": "Product Name",
        "sku": "SKU123",
        "onHand": 5,
        "reorderPoint": 10
      }
    ],
    "sales": [
      {
        "productName": "Product Name",
        "quantity": 2,
        "total": 50.00,
        "date": "12/19/2024"
      }
    ]
  }
}
```

## Response Format

```json
{
  "message": "AI-generated response text"
}
```

## Error Handling

The function returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing message)
- `401`: Unauthorized (missing or invalid auth token)
- `500`: Internal server error (OpenAI API error or other issues)

## Model Used

Currently uses `gpt-4o-mini` for cost-effective responses. You can modify the model in `index.ts` if needed.

