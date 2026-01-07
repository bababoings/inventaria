import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface RequestBody {
  message: string;
  context?: {
    inventory?: Array<{
      name: string;
      sku: string;
      onHand: number;
      reorderPoint: number;
    }>;
    sales?: {
      sales: Array<{
        saleId: string;
        productName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        saleTotal: number;
        date: string;
      }>;
      statistics?: {
        totalRevenue: number;
        saleCount: number;
        averageSale: number;
        averageQuantity: number;
        topProducts: Array<{
          name: string;
          quantity: number;
          revenue: number;
        }>;
        period: string;
      } | null;
    };
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { 
          status: 401, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          } 
        }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { 
          status: 401, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          } 
        }
      );
    }

    // Parse request body
    let requestBody: RequestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          } 
        }
      );
    }

    const { message, context } = requestBody;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          } 
        }
      );
    }

    // Build system prompt with context
    let systemPrompt = `You are an AI assistant for an inventory management system. You help users understand their inventory levels, suggest reorders, analyze sales, and provide insights about their stock.

Your responses should be:
- Clear and actionable
- Data-driven when context is provided
- Professional but friendly
- Focused on inventory management best practices

When suggesting reorder quantities, consider:
- Current stock levels vs reorder points
- Sales velocity (if available)
- Lead times and safety stock
- Cost optimization`;

    if (context?.inventory && context.inventory.length > 0) {
      systemPrompt += `\n\nCurrent Inventory Context:\n`;
      context.inventory.forEach((item) => {
        const status = item.onHand <= item.reorderPoint ? "⚠️ LOW STOCK" : "✓ OK";
        systemPrompt += `- ${item.name} (SKU: ${item.sku}): ${item.onHand} units on hand, reorder point: ${item.reorderPoint} ${status}\n`;
      });
    }

    if (context?.sales) {
      const salesData = context.sales;
      
      // Add sales statistics if available
      if (salesData.statistics) {
        const stats = salesData.statistics;
        systemPrompt += `\n\nSales Statistics (Last ${stats.period}):\n`;
        systemPrompt += `- Total Revenue: $${stats.totalRevenue.toFixed(2)}\n`;
        systemPrompt += `- Total Sales: ${stats.saleCount} transactions\n`;
        systemPrompt += `- Average Sale: $${stats.averageSale.toFixed(2)}\n`;
        systemPrompt += `- Average Items per Sale: ${stats.averageQuantity.toFixed(1)} units\n`;
        
        if (stats.topProducts && stats.topProducts.length > 0) {
          systemPrompt += `\nTop Products by Revenue:\n`;
          stats.topProducts.forEach((product, index) => {
            systemPrompt += `${index + 1}. ${product.name}: ${product.quantity} units sold, $${product.revenue.toFixed(2)} revenue\n`;
          });
        }
      }
      
      // Add recent sales details
      if (salesData.sales && salesData.sales.length > 0) {
        systemPrompt += `\n\nRecent Sales Details (Last 20 transactions):\n`;
        salesData.sales.slice(0, 20).forEach((sale) => {
          systemPrompt += `- Sale ${sale.saleId}: ${sale.productName} (SKU: ${sale.sku}) - ${sale.quantity} units @ $${sale.unitPrice.toFixed(2)} = $${sale.lineTotal.toFixed(2)} (Sale Total: $${sale.saleTotal.toFixed(2)}) - ${sale.date}\n`;
        });
      }
    }

    // Call OpenAI API
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiMessage = openaiData.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    
    // Extract token usage information
    const tokenUsage = openaiData.usage || {};
    const promptTokens = tokenUsage.prompt_tokens || 0;
    const completionTokens = tokenUsage.completion_tokens || 0;
    const totalTokens = tokenUsage.total_tokens || 0;
    
    // Log token usage for monitoring
    console.log(`Token usage - Prompt: ${promptTokens}, Completion: ${completionTokens}, Total: ${totalTokens}`);

    return new Response(
      JSON.stringify({ 
        message: aiMessage,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});

