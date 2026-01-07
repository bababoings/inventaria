import { useState, useCallback } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  suggestion?: {
    action: string;
    items: { name: string; quantity: number }[];
  };
}

const promptChips = [
  "What should I reorder today?",
  "Which products are low on stock?",
  "What are my best sellers?",
  "Suggest reorder quantities",
];

export default function AIAsk() {
  const { profile } = useUserProfile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch inventory context
  const fetchInventoryContext = useCallback(async () => {
    if (!profile?.organization_id) return [];

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        sku,
        name,
        reorder_point,
        inventory_items(on_hand)
      `)
      .eq("organization_id", profile.organization_id)
      .eq("status", "ACTIVE")
      .order("name");

    if (error) {
      console.error("Error fetching inventory:", error);
      return [];
    }

    return (data || []).map((p) => {
      const invItem = Array.isArray(p.inventory_items)
        ? p.inventory_items[0]
        : p.inventory_items;

      return {
        name: p.name,
        sku: p.sku,
        onHand: invItem?.on_hand ?? 0,
        reorderPoint: p.reorder_point,
      };
    });
  }, [profile?.organization_id]);

  // Fetch comprehensive sales context
  const fetchSalesContext = useCallback(async () => {
    if (!profile?.organization_id) return { sales: [], statistics: null };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch detailed sales data
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        recorded_at,
        total,
        sale_line_items(
          quantity,
          unit_price,
          line_total,
          products(sku, name)
        )
      `)
      .eq("organization_id", profile.organization_id)
      .gte("recorded_at", thirtyDaysAgo.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching sales:", error);
      return { sales: [], statistics: null };
    }

    const sales: Array<{
      saleId: string;
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      saleTotal: number;
      date: string;
    }> = [];

    let totalRevenue = 0;
    let totalQuantity = 0;
    const productSales: Record<string, { quantity: number; revenue: number }> = {};

    (data || []).forEach((sale) => {
      const lineItems = Array.isArray(sale.sale_line_items)
        ? sale.sale_line_items
        : sale.sale_line_items
        ? [sale.sale_line_items]
        : [];

      totalRevenue += Number(sale.total);

      lineItems.forEach((item: any) => {
        const product = Array.isArray(item.products)
          ? item.products[0]
          : item.products;

        const productName = product?.name || "Unknown";
        const sku = product?.sku || "";
        const quantity = item.quantity;
        const lineTotal = Number(item.line_total);

        totalQuantity += quantity;

        // Aggregate product sales
        if (!productSales[productName]) {
          productSales[productName] = { quantity: 0, revenue: 0 };
        }
        productSales[productName].quantity += quantity;
        productSales[productName].revenue += lineTotal;

        sales.push({
          saleId: sale.id.substring(0, 8),
          productName,
          sku,
          quantity,
          unitPrice: Number(item.unit_price),
          lineTotal,
          saleTotal: Number(sale.total),
          date: new Date(sale.recorded_at).toISOString().split("T")[0],
        });
      });
    });

    // Calculate statistics
    const saleCount = data?.length || 0;
    const averageSale = saleCount > 0 ? totalRevenue / saleCount : 0;
    const averageQuantity = saleCount > 0 ? totalQuantity / saleCount : 0;

    // Get top products by revenue
    const topProducts = Object.entries(productSales)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      sales,
      statistics: {
        totalRevenue,
        saleCount,
        averageSale,
        averageQuantity,
        topProducts,
        period: "30 days",
      },
    };
  }, [profile?.organization_id]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Fetch context data
      const [inventory, sales] = await Promise.all([
        fetchInventoryContext(),
        fetchSalesContext(),
      ]);

      // Get the current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      // Call the Edge Function
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "ai-ask",
        {
          body: {
            message: text,
            context: {
              inventory,
              sales,
            },
          },
        }
      );

      if (functionError) {
        throw functionError;
      }

      // Log token usage if available
      if (functionData?.tokenUsage) {
        const { promptTokens, completionTokens, totalTokens } = functionData.tokenUsage;
        console.log(`Token Usage - Input: ${promptTokens}, Output: ${completionTokens}, Total: ${totalTokens}`);
        // Estimate cost (gpt-4o-mini pricing as of 2024: $0.15/$0.60 per 1M tokens)
        const estimatedCost = (promptTokens * 0.15 + completionTokens * 0.60) / 1000000;
        console.log(`Estimated Cost: $${estimatedCost.toFixed(6)}`);
      }

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: functionData?.message || "I'm sorry, I couldn't generate a response.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Error calling AI:", error);
      toast.error(error.message || "Failed to get AI response");

      const errorMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: "I'm sorry, I encountered an error while processing your request. Please try again.",
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <PageHeader
        title="AI Ask"
        description="Get intelligent insights about your inventory"
      />

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ask about your inventory</h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Get AI-powered insights about stock levels, reorder suggestions, and sales analysis.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {promptChips.map((chip) => (
                <Button
                  key={chip}
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  onClick={() => handleSend(chip)}
                >
                  {chip}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" && "justify-end"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.content.split("\n").map((line, i) => (
                      <p key={i} className="mb-1 last:mb-0">
                        {line || <br />}
                      </p>
                    ))}
                  </div>
                  {message.suggestion && (
                    <div className="mt-4 p-3 bg-background rounded-lg border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Suggested Action
                      </p>
                      <div className="space-y-1 text-sm mb-3">
                        {message.suggestion.items.map((item, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{item.name}</span>
                            <span className="font-medium">{item.quantity} units</span>
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="w-full">
                        {message.suggestion.action}
                      </Button>
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about inventory or reordering..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
