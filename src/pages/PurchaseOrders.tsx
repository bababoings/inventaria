import { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Package, Download, Mail, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { generateCSV, downloadCSV } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";

interface PurchaseOrder {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_email: string | null;
  status: string;
  items: number;
  total: number;
  created_at: string;
  received_at: string | null;
  lineItems: POItem[];
}

interface POItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  cost: number;
}

export default function PurchaseOrders() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [newPO, setNewPO] = useState({
    supplier_id: "",
    items: [] as Array<{ product_id: string; quantity: number; unit_cost: number }>,
  });
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");

  // Fetch suppliers
  const fetchSuppliers = useCallback(async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, email")
      .eq("organization_id", profile.organization_id)
      .eq("status", "ACTIVE")
      .order("name");

    if (error) {
      console.error("Error fetching suppliers:", error);
      return;
    }

    setSuppliers(data || []);
  }, [profile?.organization_id]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, cost")
      .eq("organization_id", profile.organization_id)
      .eq("status", "ACTIVE")
      .order("name");

    if (error) {
      console.error("Error fetching products:", error);
      return;
    }

    setProducts(data || []);
  }, [profile?.organization_id]);

  // Fetch purchase orders
  const fetchPurchaseOrders = useCallback(async () => {
    if (!profile?.organization_id) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        id,
        supplier_id,
        status,
        created_at,
        received_at,
        suppliers(name, email),
        purchase_order_line_items(
          product_id,
          quantity,
          unit_cost,
          line_total,
          products(name, sku)
        )
      `)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching purchase orders:", error);
      toast.error("Failed to load purchase orders");
      setIsLoading(false);
      return;
    }

    const mappedOrders: PurchaseOrder[] = (data || []).map((po: any) => {
      const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
      const lineItems = Array.isArray(po.purchase_order_line_items)
        ? po.purchase_order_line_items
        : po.purchase_order_line_items
        ? [po.purchase_order_line_items]
        : [];

      const mappedLineItems: POItem[] = lineItems.map((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        return {
          product_id: item.product_id,
          product_name: product?.name || "",
          product_sku: product?.sku || "",
          quantity: item.quantity,
          unit_cost: Number(item.unit_cost),
          line_total: Number(item.line_total),
        };
      });

      const total = mappedLineItems.reduce((sum, item) => sum + item.line_total, 0);

      return {
        id: po.id,
        supplier_id: po.supplier_id,
        supplier_name: supplier?.name || "",
        supplier_email: supplier?.email || null,
        status: po.status,
        items: mappedLineItems.length,
        total,
        created_at: po.created_at,
        received_at: po.received_at,
        lineItems: mappedLineItems,
      };
    });

    setOrders(mappedOrders);
    setIsLoading(false);
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchPurchaseOrders();
  }, [fetchSuppliers, fetchProducts, fetchPurchaseOrders]);

  const selectedSupplier = useMemo(() => 
    suppliers.find(s => s.id === newPO.supplier_id),
    [newPO.supplier_id, suppliers]
  );

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    
    const query = searchQuery.toLowerCase();
    return orders.filter((order) =>
      order.id.toLowerCase().includes(query) ||
      order.supplier_name.toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query)
    );
  }, [orders, searchQuery]);

  const generateEmailMessage = (items: Array<{ product_id: string; quantity: number; unit_cost: number }>, supplierName: string) => {
    if (items.length === 0) return "";
    const itemsList = items
      .map(item => {
        const product = products.find(p => p.id === item.product_id);
        return `- ${product?.name || item.product_id} (${product?.sku || "N/A"}): ${item.quantity} units @ $${item.unit_cost.toFixed(2)}`;
      })
      .join("\n");
    const total = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
    
    return `Dear ${supplierName},

I would like to place an order for the following items:

${itemsList}

Total estimated value: $${total.toFixed(2)}

Please confirm availability and expected delivery date.

Best regards`;
  };

  const handleAddItem = () => {
    const product = products.find((p) => p.id === selectedProduct);
    if (!product || !quantity) {
      toast.error("Please select a product and enter quantity");
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantity must be a positive number");
      return;
    }

    setNewPO({
      ...newPO,
      items: [
        ...newPO.items,
        {
          product_id: product.id,
          quantity: qty,
          unit_cost: product.cost,
        },
      ],
    });
    setSelectedProduct("");
    setQuantity("");
  };

  const handleCreatePO = async () => {
    if (!newPO.supplier_id || newPO.items.length === 0) {
      toast.error("Please select a supplier and add items");
      return;
    }

    if (!user?.id || !profile?.organization_id) {
      toast.error("User not authenticated");
      return;
    }

    try {
      // Create purchase order
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          organization_id: profile.organization_id,
          supplier_id: newPO.supplier_id,
          created_by: user.id,
          status: "DRAFT",
        })
        .select()
        .single();

      if (poError) {
        console.error("Error creating purchase order:", poError);
        toast.error("Failed to create purchase order");
        return;
      }

      // Create line items
      const lineItems = newPO.items.map((item) => ({
        purchase_order_id: po.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        line_total: item.quantity * item.unit_cost,
      }));

      const { error: lineItemsError } = await supabase
        .from("purchase_order_line_items")
        .insert(lineItems);

      if (lineItemsError) {
        console.error("Error creating line items:", lineItemsError);
        toast.error("Failed to create purchase order line items");
        // Clean up the PO if line items fail
        await supabase.from("purchase_orders").delete().eq("id", po.id);
        return;
      }

      if (sendEmail && selectedSupplier?.email) {
        toast.success(`Purchase order created. Email ready to send to ${selectedSupplier.email}`);
      } else {
        toast.success("Purchase order created");
      }
      
      // Reset form
      setNewPO({ supplier_id: "", items: [] });
      setSendEmail(false);
      setEmailMessage("");
      setIsCreateOpen(false);
      
      // Refresh purchase orders
      await fetchPurchaseOrders();
    } catch (error) {
      console.error("Error creating purchase order:", error);
      toast.error("Failed to create purchase order");
    }
  };

  const handleReceive = async () => {
    if (!selectedOrder || !user?.id || !profile?.organization_id) return;

    if (selectedOrder.status === "RECEIVED") {
      toast.error("This purchase order has already been received");
      return;
    }

    setIsReceiving(true);

    try {
      // Update purchase order status
      const { error: updateError } = await supabase
        .from("purchase_orders")
        .update({
          status: "RECEIVED",
          received_at: new Date().toISOString(),
        })
        .eq("id", selectedOrder.id);

      if (updateError) {
        console.error("Error updating purchase order:", updateError);
        toast.error("Failed to receive purchase order");
        setIsReceiving(false);
        return;
      }

      // Update inventory and create movements for each line item
      for (const lineItem of selectedOrder.lineItems) {
        // Get or create inventory item
        const { data: invItem } = await supabase
          .from("inventory_items")
          .select("id, on_hand")
          .eq("product_id", lineItem.product_id)
          .eq("organization_id", profile.organization_id)
          .maybeSingle();

        const currentStock = invItem?.on_hand || 0;
        const newStock = currentStock + lineItem.quantity;

        if (invItem) {
          // Update existing inventory item
          await supabase
            .from("inventory_items")
            .update({ on_hand: newStock })
            .eq("id", invItem.id);
        } else {
          // Create new inventory item
          await supabase.from("inventory_items").insert({
            product_id: lineItem.product_id,
            organization_id: profile.organization_id,
            on_hand: newStock,
          });
        }

        // Create inventory movement record
        await supabase.from("inventory_movements").insert({
          organization_id: profile.organization_id,
          product_id: lineItem.product_id,
          quantity_delta: lineItem.quantity,
          type: "PURCHASE_RECEIPT",
          reference_id: selectedOrder.id,
          reference_type: "purchase_order",
          created_by: user.id,
          reason: `Purchase order ${selectedOrder.id} received`,
        });
      }

      toast.success("Purchase order received and inventory updated");
      setIsReceiveOpen(false);
      setSelectedOrder(null);
      
      // Refresh data
      await fetchPurchaseOrders();
      await fetchProducts();
    } catch (error) {
      console.error("Error receiving purchase order:", error);
      toast.error("Failed to receive purchase order");
    } finally {
      setIsReceiving(false);
    }
  };

  const handleExport = () => {
    // Flatten PO data for CSV export
    const flatPOs = orders.flatMap((po) =>
      po.lineItems.map((item) => ({
        poId: po.id,
        supplier: po.supplier_name,
        status: po.status,
        createdAt: po.created_at.split("T")[0],
        sku: item.product_sku,
        productName: item.product_name,
        quantity: item.quantity,
        unitCost: item.unit_cost,
        lineTotal: item.line_total,
        poTotal: po.total,
      }))
    );

    const csv = generateCSV(flatPOs, [
      { key: "poId", header: "PO ID" },
      { key: "supplier", header: "Supplier" },
      { key: "status", header: "Status" },
      { key: "createdAt", header: "Created Date" },
      { key: "sku", header: "SKU" },
      { key: "productName", header: "Product Name" },
      { key: "quantity", header: "Quantity" },
      { key: "unitCost", header: "Unit Cost" },
      { key: "lineTotal", header: "Line Total" },
      { key: "poTotal", header: "PO Total" },
    ]);
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `purchase-orders-${date}.csv`);
    toast.success("Purchase orders exported successfully");
  };

  const getStatusVariant = (status: string) => {
    switch (status.toUpperCase()) {
      case "RECEIVED":
        return "success";
      case "ORDERED":
        return "info";
      case "DRAFT":
        return "warning";
      default:
        return "warning";
    }
  };

  const columns = [
    {
      key: "id",
      header: "PO ID",
      className: "font-mono font-medium w-24",
    },
    {
      key: "supplier_name",
      header: "Supplier",
      className: "w-40",
      render: (item: PurchaseOrder) => <span>{item.supplier_name}</span>,
    },
    {
      key: "products",
      header: "Products",
      render: (item: PurchaseOrder) => (
        <div className="space-y-1">
          {item.lineItems.map((lineItem, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{lineItem.product_sku}</span>
              <span>{lineItem.product_name}</span>
              <span className="text-muted-foreground">×</span>
              <span className="font-medium">{lineItem.quantity}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      className: "w-24",
      render: (item: PurchaseOrder) => (
        <span className="font-medium">${item.total.toFixed(2)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-28",
      render: (item: PurchaseOrder) => (
        <StatusBadge variant={getStatusVariant(item.status)}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-28",
      render: (item: PurchaseOrder) =>
        item.status !== "RECEIVED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedOrder(item);
              setIsReceiveOpen(true);
            }}
          >
            <Package className="mr-2 h-3 w-3" />
            Receive
          </Button>
        ),
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <PageHeader
          title="Purchase Orders"
          description="Create and manage supplier orders"
        />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading purchase orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Purchase Orders"
        description="Create and manage supplier orders"
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add PO
          </Button>
        </div>
      </PageHeader>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by PO ID, supplier, or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredOrders}
        emptyState={{
          title: "No purchase orders",
          description: "Create your first purchase order to restock inventory.",
        }}
      />

      {/* Create PO Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Select a supplier and add products to order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select
                value={newPO.supplier_id}
                onValueChange={(v) => {
                  setNewPO({ ...newPO, supplier_id: v });
                  if (sendEmail && newPO.items.length > 0) {
                    const supplier = suppliers.find(s => s.id === v);
                    if (supplier) {
                      setEmailMessage(generateEmailMessage(newPO.items, supplier.name));
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSupplier && (
                <p className="text-xs text-muted-foreground">
                  {selectedSupplier.email ? `Email: ${selectedSupplier.email}` : "No email on file"}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Add Product</Label>
              <div className="flex gap-2">
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.sku}) - ${p.cost.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Qty"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-20"
                />
                <Button variant="outline" onClick={handleAddItem}>
                  Add
                </Button>
              </div>
            </div>

            {newPO.items.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2">
                <Label className="text-xs text-muted-foreground">Order Items</Label>
                {newPO.items.map((item, i) => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span>
                        {product?.name || item.product_id} × {item.quantity}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ${(item.quantity * item.unit_cost).toFixed(2)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setNewPO({
                              ...newPO,
                              items: newPO.items.filter((_, idx) => idx !== i),
                            });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>
                    $
                    {newPO.items
                      .reduce((sum, item) => sum + item.quantity * item.unit_cost, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Email to Supplier Section */}
            {newPO.items.length > 0 && selectedSupplier && selectedSupplier.email && (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send-email"
                    checked={sendEmail}
                    onCheckedChange={(checked) => {
                      setSendEmail(checked === true);
                      if (checked && selectedSupplier) {
                        setEmailMessage(generateEmailMessage(newPO.items, selectedSupplier.name));
                      }
                    }}
                  />
                  <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="w-4 h-4" />
                    Send email to supplier
                  </Label>
                </div>
                
                {sendEmail && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      To: {selectedSupplier.email}
                    </p>
                    <Textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={8}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePO}>Create Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive PO Dialog */}
      <Dialog open={isReceiveOpen} onOpenChange={setIsReceiveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Receive Purchase Order</DialogTitle>
            <DialogDescription>
              Mark {selectedOrder?.id} from {selectedOrder?.supplier_name} as received?
              This will update inventory levels.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-success" />
              </div>
              <p className="text-lg font-medium">{selectedOrder?.items} items</p>
              <p className="text-muted-foreground">
                Total: ${selectedOrder?.total.toFixed(2)}
              </p>
            </div>
            
            {selectedOrder && selectedOrder.lineItems.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                <Label className="text-xs text-muted-foreground">Items to receive:</Label>
                {selectedOrder.lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>
                      {item.product_name} ({item.product_sku}) × {item.quantity}
                    </span>
                    <span className="text-muted-foreground">
                      ${item.line_total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={isReceiving}>
              {isReceiving ? "Receiving..." : "Receive All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
