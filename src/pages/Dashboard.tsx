import { useState, useEffect, useCallback } from "react";
import { Package, AlertTriangle, DollarSign, TrendingUp } from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import { AlertCard } from "@/components/ui/alert-card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format, formatDistanceToNow, parseISO, startOfDay, endOfDay, isToday } from "date-fns";

interface RecentSale {
  id: string;
  saleId: string;
  total: number;
  time: string;
  products: string;
}

interface LowStockItem {
  id: string;
  sku: string;
  name: string;
  onHand: number;
  reorderPoint: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [isLoading, setIsLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!profile?.organization_id) return;

    setIsLoading(true);

    try {
      // Fetch products with inventory
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          sku,
          name,
          reorder_point,
          inventory_items(on_hand)
        `)
        .eq("organization_id", profile.organization_id)
        .eq("status", "ACTIVE");

      if (productsError) {
        console.error("Error fetching products:", productsError);
      } else {
        const products = productsData || [];
        
        // Calculate total items in stock (sum of all inventory quantities)
        const totalItemsInStock = products.reduce((sum, p) => {
          const invItem = Array.isArray(p.inventory_items)
            ? p.inventory_items[0]
            : p.inventory_items;
          return sum + (invItem?.on_hand ?? 0);
        }, 0);
        
        setTotalProducts(totalItemsInStock);

        // Calculate low stock items
        const lowStock = products.filter((p) => {
          const invItem = Array.isArray(p.inventory_items)
            ? p.inventory_items[0]
            : p.inventory_items;
          const onHand = invItem?.on_hand ?? 0;
          return onHand <= p.reorder_point;
        });

        setLowStockCount(lowStock.length);

        // Map low stock items for display
        const mappedLowStock: LowStockItem[] = lowStock.map((p) => {
          const invItem = Array.isArray(p.inventory_items)
            ? p.inventory_items[0]
            : p.inventory_items;
          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            onHand: invItem?.on_hand ?? 0,
            reorderPoint: p.reorder_point,
          };
        });

        setLowStockItems(mappedLowStock.slice(0, 5)); // Show top 5
      }

      // Fetch today's sales
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(`
          id,
          recorded_at,
          total,
          sale_line_items(
            quantity,
            products(name)
          )
        `)
        .eq("organization_id", profile.organization_id)
        .gte("recorded_at", todayStart)
        .lte("recorded_at", todayEnd)
        .order("recorded_at", { ascending: false })
        .limit(10);

      if (salesError) {
        console.error("Error fetching sales:", salesError);
      } else {
        const sales = salesData || [];
        setTodaySalesCount(sales.length);
        setTodayRevenue(sales.reduce((sum, sale) => sum + Number(sale.total), 0));

        // Map recent sales for display
        const mappedRecentSales: RecentSale[] = sales.slice(0, 5).map((sale) => {
          const lineItems = Array.isArray(sale.sale_line_items)
            ? sale.sale_line_items
            : sale.sale_line_items
            ? [sale.sale_line_items]
            : [];

          const productNames = lineItems
            .map((item: any) => {
              const product = Array.isArray(item.products)
                ? item.products[0]
                : item.products;
              return `${product?.name || "Unknown"} (×${item.quantity})`;
            })
            .join(", ");

          return {
            id: sale.id,
            saleId: sale.id.substring(0, 8),
            total: Number(sale.total),
            time: formatDistanceToNow(parseISO(sale.recorded_at), { addSuffix: true }),
            products: productNames || "No products",
          };
        });

        setRecentSales(mappedRecentSales);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const salesColumns = [
    {
      key: "saleId",
      header: "Sale ID",
      className: "font-mono text-sm",
    },
    {
      key: "products",
      header: "Products",
      render: (item: RecentSale) => (
        <span className="text-sm">{item.products}</span>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (item: RecentSale) => (
        <span className="font-medium">${item.total.toFixed(2)}</span>
      ),
    },
    {
      key: "time",
      header: "Time",
      className: "text-right text-muted-foreground text-sm",
      render: (item: RecentSale) => <span>{item.time}</span>,
    },
  ];

  const lowStockColumns = [
    { key: "sku", header: "SKU", className: "font-mono text-sm" },
    { key: "name", header: "Product" },
    {
      key: "onHand",
      header: "On Hand",
      className: "text-center",
      render: (item: LowStockItem) => (
        <span className="font-medium text-warning">{item.onHand}</span>
      ),
    },
    {
      key: "reorderPoint",
      header: "Reorder Point",
      className: "text-center text-muted-foreground text-sm",
    },
    {
      key: "status",
      header: "Status",
      render: () => <StatusBadge variant="warning">Low Stock</StatusBadge>,
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Dashboard"
          description="Overview of your inventory and sales performance"
        />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description="Overview of your inventory and sales performance"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Total Items in Stock"
          value={totalProducts}
          icon={Package}
        />
        <KPICard
          title="Low Stock Items"
          value={lowStockCount}
          icon={AlertTriangle}
          variant="warning"
        />
        <KPICard
          title="Today's Sales"
          value={`$${todayRevenue.toFixed(2)}`}
          icon={DollarSign}
          trend={
            todaySalesCount > 0
              ? { value: `${todaySalesCount} transaction${todaySalesCount !== 1 ? "s" : ""}`, positive: true }
              : undefined
          }
        />
        <KPICard
          title="Sales Count (Today)"
          value={todaySalesCount}
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Alert */}
      {lowStockCount > 0 && (
        <AlertCard
          variant="warning"
          title="Low Stock Alert"
          description={`${lowStockCount} product${lowStockCount !== 1 ? "s are" : " is"} below ${lowStockCount !== 1 ? "their" : "its"} reorder point. Consider creating a purchase order.`}
          action={{
            label: "View Items",
            onClick: () => navigate("/inventory"),
          }}
          className="mb-8"
        />
      )}

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-medium mb-4">Recent Sales</h2>
          <DataTable
            columns={salesColumns}
            data={recentSales}
            emptyState={{
              title: "No sales today",
              description: "Sales completed today will appear here.",
            }}
            onRowClick={() => navigate("/sales")}
          />
        </div>

        <div>
          <h2 className="text-lg font-medium mb-4">Low Stock Items</h2>
          <DataTable
            columns={lowStockColumns}
            data={lowStockItems}
            emptyState={{
              title: "All items in stock",
              description: "No products are below their reorder point.",
            }}
            onRowClick={() => navigate("/inventory")}
          />
        </div>
      </div>
    </div>
  );
}
