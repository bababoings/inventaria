import { useState, useCallback, useMemo, useEffect } from "react";
import { Search, Plus, Minus, Trash2, ShoppingCart, AlertCircle, Download, History, Upload, CalendarIcon, X, Play, Square } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { generateCSV, downloadCSV, CSVRow } from "@/lib/csv";
import { CSVImportDialog } from "@/components/csv/CSVImportDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  inventoryItemId: string | null;
}

interface CartItem extends Product {
  quantity: number;
}

interface CompletedSale {
  id: string;
  date: string;
  items: number;
  subtotal: number;
  total: number;
  products: { sku: string; name: string; quantity: number; price: number }[];
}

const importColumns = [
  { key: "Date", header: "Date", required: true },
  { key: "SKU", header: "SKU", required: true },
  { key: "Quantity", header: "Quantity", required: true },
  { key: "Unit Price", header: "Unit Price", required: true },
];

export default function Sales() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [completedSales, setCompletedSales] = useState<CompletedSale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [activeShift, setActiveShift] = useState<{ id: string; started_at: string } | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [isStartingShift, setIsStartingShift] = useState(false);
  const [isEndingShift, setIsEndingShift] = useState(false);
  const [showEndShiftDialog, setShowEndShiftDialog] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<{
    totalRevenue: number;
    saleCount: number;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Fetch products with inventory
  const fetchProducts = useCallback(async () => {
    if (!profile?.organization_id) return;

    setIsLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        sku,
        name,
        price,
        status,
        inventory_items(id, on_hand)
      `)
      .eq("status", "ACTIVE")
      .eq("organization_id", profile.organization_id)
      .order("name");

    if (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
      setIsLoadingProducts(false);
      return;
    }

    const mappedProducts: Product[] = (data || []).map((p) => {
      const invItem = Array.isArray(p.inventory_items)
        ? p.inventory_items[0]
        : p.inventory_items;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: Number(p.price),
        stock: invItem?.on_hand ?? 0,
        inventoryItemId: invItem?.id || null,
      };
    });

    setProducts(mappedProducts);
    
    // Update cart items with latest stock
    setCart((currentCart) =>
      currentCart
        .map((cartItem) => {
          const updatedProduct = mappedProducts.find((p) => p.id === cartItem.id);
          if (updatedProduct) {
            // Adjust quantity if it exceeds available stock
            const adjustedQuantity = Math.min(cartItem.quantity, updatedProduct.stock);
            if (adjustedQuantity < cartItem.quantity && updatedProduct.stock > 0) {
              toast.warning(
                `${cartItem.name} quantity adjusted to ${adjustedQuantity} (available stock)`
              );
            }
            return {
              ...cartItem,
              stock: updatedProduct.stock,
              price: updatedProduct.price,
              quantity: adjustedQuantity,
            };
          }
          return null;
        })
        .filter((item): item is CartItem => {
          // Remove items that no longer exist or are out of stock
          return item !== null && item.stock > 0 && item.quantity > 0;
        })
    );
    
    setIsLoadingProducts(false);
  }, [profile?.organization_id]);

  // Fetch completed sales
  const fetchSales = useCallback(async () => {
    if (!profile?.organization_id) return;

    setIsLoadingSales(true);
    
    // Build query with optional date filters
    let query = supabase
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
      .eq("organization_id", profile.organization_id);

    // Apply date filters if set
    if (startDate) {
      query = query.gte("recorded_at", startOfDay(startDate).toISOString());
    }
    if (endDate) {
      query = query.lte("recorded_at", endOfDay(endDate).toISOString());
    }

    const { data, error } = await query.order("recorded_at", { ascending: false });

    if (error) {
      console.error("Error fetching sales:", error);
      toast.error("Failed to load sales history");
      setIsLoadingSales(false);
      return;
    }

    const mappedSales: CompletedSale[] = (data || []).map((sale) => {
      const lineItems = Array.isArray(sale.sale_line_items)
        ? sale.sale_line_items
        : sale.sale_line_items
        ? [sale.sale_line_items]
        : [];

      const saleProducts = lineItems.map((item: any) => {
        const product = Array.isArray(item.products)
          ? item.products[0]
          : item.products;
        return {
          sku: product?.sku || "",
          name: product?.name || "",
          quantity: item.quantity,
          price: Number(item.unit_price),
        };
      });

      const subtotal = lineItems.reduce(
        (sum: number, item: any) => sum + Number(item.line_total),
        0
      );

      return {
        id: sale.id,
        date: format(parseISO(sale.recorded_at), "yyyy-MM-dd HH:mm"),
        items: lineItems.reduce((sum: number, item: any) => sum + item.quantity, 0),
        subtotal,
        total: Number(sale.total),
        products: saleProducts,
      };
    });

    setCompletedSales(mappedSales);
    setIsLoadingSales(false);
  }, [profile?.organization_id, startDate, endDate]);

  // Fetch active shift
  const fetchActiveShift = useCallback(async () => {
    if (!profile?.organization_id) return;

    setIsLoadingShift(true);
    const { data, error } = await supabase
      .from("shifts")
      .select("id, started_at")
      .eq("organization_id", profile.organization_id)
      .eq("status", "OPEN")
      .maybeSingle();

    if (error) {
      console.error("Error fetching active shift:", error);
      setIsLoadingShift(false);
      return;
    }

    if (data) {
      setActiveShift({ id: data.id, started_at: data.started_at });
      // Clear any previous shift summary when fetching a new active shift
      setShowEndShiftDialog(false);
      setShiftSummary(null);
    } else {
      setActiveShift(null);
      // Clear dialog when no active shift
      setShowEndShiftDialog(false);
      setShiftSummary(null);
    }
    setIsLoadingShift(false);
  }, [profile?.organization_id]);

  // Start a new shift
  const startShift = async () => {
    if (!user?.id || !profile?.organization_id) {
      toast.error("User not authenticated");
      return;
    }

    setIsStartingShift(true);
    
    // Clear any previous shift summary dialog state
    setShowEndShiftDialog(false);
    setShiftSummary(null);
    
    const { data: newShift, error } = await supabase
      .from("shifts")
      .insert({
        organization_id: profile.organization_id,
        opened_by: user.id,
        status: "OPEN",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error starting shift:", error);
      toast.error(`Failed to start shift: ${error.message}`);
      setIsStartingShift(false);
      return;
    }

    setActiveShift({ id: newShift.id, started_at: newShift.started_at });
    toast.success("Shift started successfully");
    setIsStartingShift(false);
  };

  // End the current shift and show summary
  const endShift = async () => {
    if (!activeShift || !user?.id || !profile?.organization_id) return;

    setIsEndingShift(true);

    // Fetch shift sales summary
    const { data: shiftSales, error: salesError } = await supabase
      .from("sales")
      .select("id, total, recorded_at")
      .eq("organization_id", profile.organization_id)
      .eq("shift_id", activeShift.id);

    if (salesError) {
      console.error("Error fetching shift sales:", salesError);
      toast.error("Failed to fetch shift summary");
      setIsEndingShift(false);
      return;
    }

    const saleCount = shiftSales?.length || 0;
    const totalRevenue = shiftSales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;

    // Update shift to closed
    const { error: updateError } = await supabase
      .from("shifts")
      .update({
        status: "CLOSED",
        closed_by: user.id,
        ended_at: new Date().toISOString(),
      })
      .eq("id", activeShift.id);

    if (updateError) {
      console.error("Error closing shift:", updateError);
      toast.error("Failed to close shift");
      setIsEndingShift(false);
      return;
    }

    // Set summary and show dialog
    setShiftSummary({
      totalRevenue: totalRevenue,
      saleCount: saleCount,
      startTime: activeShift.started_at,
      endTime: new Date().toISOString(),
    });

    setActiveShift(null);
    setIsEndingShift(false);
    setShowEndShiftDialog(true);
    toast.success("Shift ended successfully");
    
    // Refresh sales to show updated data
    await fetchSales();
  };

  useEffect(() => {
    fetchActiveShift();
    fetchProducts();
  }, [fetchActiveShift, fetchProducts]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);


  // Get active shift ID (must have active shift to complete sales)
  const getActiveShiftId = (): string | null => {
    return activeShift?.id || null;
  };

  // Sales are already filtered at the database level in fetchSales
  const filteredSales = completedSales;

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start);
    setEndDate(end);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error("Product out of stock");
      return;
    }

    const existingItem = cart.find((item) => item.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error("Insufficient stock");
        return;
      }
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty < 0) {
              return item;
            }
            if (newQty > item.stock) {
              toast.error("Insufficient stock");
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!user?.id || !profile?.organization_id) {
      toast.error("User not authenticated");
      return;
    }

    setIsCompletingSale(true);

    // Validate stock availability one more time
    for (const cartItem of cart) {
      const product = products.find((p) => p.id === cartItem.id);
      if (!product || product.stock < cartItem.quantity) {
        toast.error(`Insufficient stock for ${product?.name || cartItem.name}`);
        setIsCompletingSale(false);
        return;
      }
    }

    // Get active shift ID (shift must be started first)
    const shiftId = getActiveShiftId();
    if (!shiftId) {
      toast.error("No active shift. Please start a shift first.");
      setIsCompletingSale(false);
      return;
    }

    try {
      // Create sale record
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          organization_id: profile.organization_id,
          created_by: user.id,
          shift_id: shiftId,
          total,
          recorded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saleError) {
        console.error("Error creating sale:", saleError);
        toast.error("Failed to create sale");
        setIsCompletingSale(false);
        return;
      }

      // Create sale line items and update inventory
      for (const cartItem of cart) {
        const lineTotal = cartItem.price * cartItem.quantity;

        // Create sale line item
        const { error: lineItemError } = await supabase
          .from("sale_line_items")
          .insert({
            sale_id: sale.id,
            product_id: cartItem.id,
            quantity: cartItem.quantity,
            unit_price: cartItem.price,
            line_total: lineTotal,
          });

        if (lineItemError) {
          console.error("Error creating line item:", lineItemError);
          toast.error("Failed to create sale line items");
          setIsCompletingSale(false);
          return;
        }

        // Update inventory
        if (cartItem.inventoryItemId) {
          const newStock = cartItem.stock - cartItem.quantity;
          if (newStock < 0) {
            toast.error(`Cannot complete sale: ${cartItem.name} would go below 0`);
            setIsCompletingSale(false);
            return;
          }

          const { error: invError } = await supabase
            .from("inventory_items")
            .update({ on_hand: newStock })
            .eq("id", cartItem.inventoryItemId);

          if (invError) {
            console.error("Error updating inventory:", invError);
            toast.error("Failed to update inventory");
            setIsCompletingSale(false);
            return;
          }
        }

        // Create inventory movement record
        const { error: movementError } = await supabase
          .from("inventory_movements")
          .insert({
            organization_id: profile.organization_id,
            product_id: cartItem.id,
            quantity_delta: -cartItem.quantity,
            type: "SALE",
            reference_id: sale.id,
            reference_type: "sale",
            created_by: user.id,
            reason: "Sale completed",
          });

        if (movementError) {
          console.error("Error creating inventory movement:", movementError);
          // Don't fail the sale if movement logging fails
        }
      }

      toast.success("Sale completed successfully!");
      setCart([]);
      setSearchQuery("");
      await fetchProducts();
      await fetchSales();
    } catch (error) {
      console.error("Error completing sale:", error);
      toast.error("Failed to complete sale");
    } finally {
      setIsCompletingSale(false);
    }
  };

  const handleExportSales = () => {
    // Flatten sales data for CSV export
    const flatSales = completedSales.flatMap((sale) =>
      sale.products.map((product) => ({
        saleId: sale.id,
        date: sale.date,
        sku: product.sku,
        productName: product.name,
        quantity: product.quantity,
        unitPrice: product.price,
        lineTotal: product.quantity * product.price,
        saleTotal: sale.total,
      }))
    );

    const csv = generateCSV(flatSales, [
      { key: "saleId", header: "Sale ID" },
      { key: "date", header: "Date" },
      { key: "sku", header: "SKU" },
      { key: "productName", header: "Product Name" },
      { key: "quantity", header: "Quantity" },
      { key: "unitPrice", header: "Unit Price" },
      { key: "lineTotal", header: "Line Total" },
      { key: "saleTotal", header: "Sale Total" },
    ]);
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `completed-sales-${date}.csv`);
    toast.success("Sales exported successfully");
  };

  const validateImportRow = useCallback(
    (row: CSVRow, index: number): string[] => {
      const errors: string[] = [];

      // Check date - try multiple column name variations
      const date = String(
        row.date || 
        row.Date || 
        row["Sale Date"] ||
        row["Recorded At"] ||
        ""
      ).trim();
      if (!date) {
        errors.push("Date is required");
      }

      // Check SKU exists - try multiple column name variations
      const sku = String(
        row.sku || 
        row.SKU || 
        row["Product SKU"] ||
        ""
      ).trim();
      if (!sku) {
        errors.push("SKU is required");
      } else {
        const product = products.find((p) => p.sku === sku);
        if (!product) {
          errors.push(`SKU "${sku}" not found`);
        }
      }

      // Check quantity is valid number > 0 - try multiple column name variations
      const qty = Number(
        row.quantity || 
        row.Quantity || 
        row["Qty"] ||
        row.qty ||
        0
      );
      if (isNaN(qty)) {
        errors.push("Quantity must be a number");
      } else if (qty <= 0) {
        errors.push("Quantity must be greater than 0");
      }

      // Check unit price is valid number >= 0 - try multiple column name variations
      const price = Number(
        row.unitPrice || 
        row["Unit Price"] || 
        row.price || 
        row.Price ||
        row["Price"] ||
        0
      );
      if (isNaN(price)) {
        errors.push("Unit Price must be a number");
      } else if (price < 0) {
        errors.push("Unit Price cannot be negative");
      }

      return errors;
    },
    [products]
  );

  const handleImport = async (rows: CSVRow[]) => {
    if (!user?.id || !profile?.organization_id) {
      toast.error("User not authenticated");
      return;
    }

    // Use active shift (must have active shift to import)
    const shiftId = getActiveShiftId();
    if (!shiftId) {
      toast.error("No active shift. Please start a shift first.");
      return;
    }

    // Group rows by Sale ID if available, otherwise by date
    const salesByGroup: Record<string, CSVRow[]> = {};
    rows.forEach((row) => {
      // Try to get Sale ID first
      const saleId = String(
        row["Sale ID"] || 
        row.saleId || 
        row.sale_id ||
        row["sale_id"] ||
        ""
      ).trim();
      
      // If no Sale ID, use date as grouping key
      const date = String(
        row.date || 
        row.Date || 
        row["Sale Date"] ||
        row["Recorded At"] ||
        ""
      ).trim();
      
      const groupKey = saleId || date;
      if (!groupKey) {
        console.warn("Row missing both Sale ID and Date, skipping:", row);
        return;
      }
      
      if (!salesByGroup[groupKey]) {
        salesByGroup[groupKey] = [];
      }
      salesByGroup[groupKey].push(row);
    });

    let importedCount = 0;
    let errorCount = 0;

    for (const [groupKey, saleRows] of Object.entries(salesByGroup)) {
      try {
        // Get date from first row in the group
        const firstRow = saleRows[0];
        const dateStr = String(
          firstRow.date || 
          firstRow.Date || 
          firstRow["Sale Date"] ||
          firstRow["Recorded At"] ||
          ""
        ).trim();
        
        if (!dateStr) {
          console.error("Row group missing date:", groupKey);
          errorCount++;
          continue;
        }

        // Parse the date - handle various formats
        let saleDate: Date;
        try {
          // Try parsing with space replacement first
          saleDate = parseISO(dateStr.replace(" ", "T"));
          // If that fails, try other formats
          if (isNaN(saleDate.getTime())) {
            saleDate = new Date(dateStr);
          }
        } catch (e) {
          console.error("Error parsing date:", dateStr, e);
          errorCount++;
          continue;
        }

        // Calculate totals
        const saleProducts = saleRows.map((row) => {
          const sku = String(
            row.sku || 
            row.SKU || 
            row["Product SKU"] ||
            ""
          ).trim();
          const product = products.find((p) => p.sku === sku);
          const qty = Number(
            row.quantity || 
            row.Quantity || 
            row["Qty"] ||
            row.qty ||
            1
          );
          const price =
            Number(
              row.unitPrice || 
              row["Unit Price"] || 
              row.price || 
              row.Price ||
              row["Price"] ||
              0
            ) || product?.price || 0;

          return {
            productId: product?.id || "",
            sku,
            name: product?.name || sku,
            quantity: qty,
            price,
            lineTotal: qty * price,
          };
        });

        // Filter out products that don't exist
        const validProducts = saleProducts.filter((p) => p.productId);
        if (validProducts.length === 0) {
          console.warn("No valid products in sale group:", groupKey);
          errorCount++;
          continue;
        }

        const subtotal = validProducts.reduce((sum, p) => sum + p.lineTotal, 0);
        const total = subtotal;

        // Create sale record
        const { data: sale, error: saleError } = await supabase
          .from("sales")
          .insert({
            organization_id: profile.organization_id,
            created_by: user.id,
            shift_id: shiftId,
            total,
            recorded_at: saleDate.toISOString(),
          })
          .select()
          .single();

        if (saleError) {
          console.error("Error creating sale:", saleError);
          errorCount++;
          continue;
        }

        // Create line items and update inventory
        for (const saleProduct of validProducts) {
          const product = products.find((p) => p.id === saleProduct.productId);
          if (!product) continue;

          // Create line item
          const { error: lineItemError } = await supabase.from("sale_line_items").insert({
            sale_id: sale.id,
            product_id: saleProduct.productId,
            quantity: saleProduct.quantity,
            unit_price: saleProduct.price,
            line_total: saleProduct.lineTotal,
          });

          if (lineItemError) {
            console.error("Error creating line item:", lineItemError);
            // Continue with other items
          }

          // Update inventory if item exists
          if (product.inventoryItemId) {
            const newStock = product.stock - saleProduct.quantity;
            if (newStock >= 0) {
              const { error: invError } = await supabase
                .from("inventory_items")
                .update({ on_hand: newStock })
                .eq("id", product.inventoryItemId);

              if (invError) {
                console.error("Error updating inventory:", invError);
              }

              // Create inventory movement
              await supabase.from("inventory_movements").insert({
                organization_id: profile.organization_id,
                product_id: saleProduct.productId,
                quantity_delta: -saleProduct.quantity,
                type: "SALE",
                reference_id: sale.id,
                reference_type: "sale",
                created_by: user.id,
                reason: "Historical sale import",
              });
            } else {
              console.warn(`Insufficient stock for ${product.name}: ${product.stock} < ${saleProduct.quantity}`);
            }
          }
        }

        importedCount++;
      } catch (error) {
        console.error("Error importing sale:", error);
        errorCount++;
      }
    }

    if (importedCount > 0) {
      toast.success(`Imported ${importedCount} sales with ${rows.length} line items${errorCount > 0 ? ` (${errorCount} failed)` : ""}`);
      await fetchProducts();
      await fetchSales();
    } else {
      toast.error(`Failed to import sales${errorCount > 0 ? ` (${errorCount} errors)` : ""}`);
    }
  };

  const salesColumns = [
    { key: "id", header: "Sale ID", className: "font-mono font-medium" },
    { key: "date", header: "Date" },
    {
      key: "products",
      header: "Products",
      render: (item: CompletedSale) => (
        <div className="space-y-1">
          {item.products.map((product, idx) => (
            <div key={idx} className="text-sm">
              <span className="font-medium">{product.name}</span>
              <span className="text-muted-foreground ml-2">×{product.quantity}</span>
            </div>
          ))}
        </div>
      ),
    },
    { key: "items", header: "Total Qty", className: "text-center" },
    {
      key: "total",
      header: "Total",
      render: (item: CompletedSale) => (
        <span className="font-semibold">${item.total.toFixed(2)}</span>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Sales" description="Create new sales and view history">
        <div className="flex gap-2">
          {activeShift && (
            <>
              <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button variant="outline" onClick={handleExportSales}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                variant="destructive"
                onClick={endShift}
                disabled={isEndingShift}
              >
                <Square className="mr-2 h-4 w-4" />
                {isEndingShift ? "Ending Shift..." : "End Shift"}
              </Button>
            </>
          )}
          {!activeShift && (
            <Button
              onClick={startShift}
              disabled={isStartingShift}
            >
              <Play className="mr-2 h-4 w-4" />
              {isStartingShift ? "Starting Shift..." : "Start Shift"}
            </Button>
          )}
        </div>
      </PageHeader>

      <Tabs defaultValue="new-sale" className="space-y-6">
        <TabsList>
          <TabsTrigger value="new-sale">
            <ShoppingCart className="mr-2 h-4 w-4" />
            New Sale
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            Sales History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new-sale">
          {!activeShift ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-4">
                <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                  <Play className="h-12 w-12 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold mb-2">No Active Shift</h2>
                  <p className="text-muted-foreground mb-6">
                    Start a shift to begin recording sales.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={startShift}
                  disabled={isStartingShift}
                  className="px-8"
                >
                  <Play className="mr-2 h-5 w-5" />
                  {isStartingShift ? "Starting Shift..." : "Start Shift"}
                </Button>
              </div>
            </div>
          ) : isLoadingProducts ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Product Search */}
              <div className="lg:col-span-2 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by SKU or product name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No products found</p>
                    <p className="text-sm mt-1">
                      {searchQuery ? "Try a different search term" : "No active products available"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredProducts.map((product) => (
                      <Card
                        key={product.id}
                        className={`p-4 cursor-pointer hover:border-primary/50 transition-colors ${
                          product.stock <= 0 ? "opacity-50" : ""
                        }`}
                        onClick={() => product.stock > 0 && addToCart(product)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {product.sku}
                            </p>
                          </div>
                          <p className="font-semibold">${product.price.toFixed(2)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className={`text-xs ${
                              product.stock <= 0
                                ? "text-destructive"
                                : product.stock <= 5
                                ? "text-warning"
                                : "text-muted-foreground"
                            }`}
                          >
                            {product.stock <= 0
                              ? "Out of stock"
                              : `${product.stock} in stock`}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            disabled={product.stock <= 0}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

            {/* Cart */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-semibold text-lg">Cart</h2>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {cart.length} items
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Cart is empty</p>
                    <p className="text-sm">Search and add products</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ${item.price.toFixed(2)} each
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Low stock warning */}
                    {cart.some((item) => item.quantity >= item.stock) && (
                      <div className="mt-4 p-3 bg-warning/10 rounded-lg flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">
                          Some items are at maximum available stock
                        </p>
                      </div>
                    )}

                    <Separator className="my-4" />

                    {/* Totals */}
                    <div className="space-y-2 text-sm">
                      <Separator className="my-2" />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full mt-6"
                      size="lg"
                      onClick={completeSale}
                      disabled={isCompletingSale}
                    >
                      {isCompletingSale ? "Processing..." : "Complete Sale"}
                    </Button>
                  </>
                )}
              </Card>
            </div>
          </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {isLoadingSales ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading sales history...</p>
            </div>
          ) : (
            <>
          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Date Filters */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange(3)}
                className={cn(
                  startDate && endDate && 
                  Math.abs(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) - 3) <= 1 &&
                  "bg-primary/10"
                )}
              >
                Last 3 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange(7)}
                className={cn(
                  startDate && endDate && 
                  Math.abs(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) - 7) <= 1 &&
                  "bg-primary/10"
                )}
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange(30)}
                className={cn(
                  startDate && endDate && 
                  Math.abs(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) - 30) <= 1 &&
                  "bg-primary/10"
                )}
              >
                Last 30 Days
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground">to</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={clearDateFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}

            <span className="ml-auto text-sm text-muted-foreground">
              {filteredSales.length} {startDate || endDate ? "filtered" : "total"} sales
            </span>
          </div>

          <DataTable
            columns={salesColumns}
            data={filteredSales}
            emptyState={{
              title: "No sales found",
              description: startDate || endDate 
                ? "No sales match the selected date range." 
                : "Completed sales will appear here.",
            }}
          />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Import Sales"
        description="Upload a CSV file with historical sales data. Rows with the same date will be grouped into a single sale."
        expectedColumns={importColumns}
        validator={validateImportRow}
        onImport={handleImport}
      />

      {/* End Shift Summary Dialog */}
      <Dialog open={showEndShiftDialog} onOpenChange={setShowEndShiftDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shift Summary</DialogTitle>
            <DialogDescription>
              Summary of sales completed during this shift.
            </DialogDescription>
          </DialogHeader>

          {shiftSummary && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Start Time</p>
                  <p className="font-medium">
                    {format(parseISO(shiftSummary.startTime), "PPp")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Time</p>
                  <p className="font-medium">
                    {format(parseISO(shiftSummary.endTime), "PPp")}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Sales</span>
                  <span className="text-lg font-semibold">
                    {shiftSummary.saleCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Revenue</span>
                  <span className="text-lg font-semibold">
                    ${shiftSummary.totalRevenue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowEndShiftDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
