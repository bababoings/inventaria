import { useState, useCallback, useEffect } from "react";
import { Search, Plus, Minus, Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateCSV, downloadCSV, CSVRow } from "@/lib/csv";
import { CSVImportDialog } from "@/components/csv/CSVImportDialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

interface InventoryItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  onHand: number;
  reorderPoint: number;
}

const importColumns = [
  { key: "sku", header: "SKU", required: true },
  { key: "quantity", header: "Quantity", required: true },
];

export default function Inventory() {
  const { profile, canManageProducts } = useUserProfile();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        sku,
        name,
        reorder_point,
        inventory_items(id, on_hand)
      `)
      .eq("status", "ACTIVE")
      .order("name");

    if (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Failed to load inventory");
      setIsLoading(false);
      return;
    }

    const mappedInventory: InventoryItem[] = (data || []).map((p) => {
      // Handle both array and object responses for inventory_items
      const invItem = Array.isArray(p.inventory_items) 
        ? p.inventory_items[0] 
        : p.inventory_items;
      
      return {
        id: invItem?.id || "",
        productId: p.id,
        sku: p.sku,
        name: p.name,
        onHand: invItem?.on_hand ?? 0,
        reorderPoint: p.reorder_point,
      };
    });

    setInventory(mappedInventory);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentQty(0);
    setIsDialogOpen(true);
  };

  const handleAdjust = async () => {
    if (!selectedItem || !profile?.organization_id) return;

    const newQty = selectedItem.onHand + adjustmentQty;
    if (newQty < 0) {
      toast.error("Quantity cannot be negative");
      return;
    }

    setIsSaving(true);

    if (selectedItem.id) {
      // Update existing inventory item
      const { error } = await supabase
        .from("inventory_items")
        .update({ on_hand: newQty })
        .eq("id", selectedItem.id);

      if (error) {
        console.error("Error updating inventory:", error);
        toast.error("Failed to adjust stock");
        setIsSaving(false);
        return;
      }
    } else {
      // Create inventory item if it doesn't exist
      const { error } = await supabase.from("inventory_items").insert({
        product_id: selectedItem.productId,
        organization_id: profile.organization_id,
        on_hand: newQty,
      });

      if (error) {
        console.error("Error creating inventory item:", error);
        toast.error("Failed to adjust stock");
        setIsSaving(false);
        return;
      }
    }

    toast.success(`Stock adjusted for ${selectedItem.name}`);
    setIsSaving(false);
    setIsDialogOpen(false);
    fetchInventory();
  };

  const handleExport = () => {
    const csv = generateCSV(inventory, [
      { key: "sku", header: "SKU" },
      { key: "name", header: "Product Name" },
      { key: "onHand", header: "On Hand" },
      { key: "reorderPoint", header: "Reorder Point" },
    ]);
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `inventory-snapshot-${date}.csv`);
    toast.success("Inventory exported successfully");
  };

  const validateImportRow = useCallback(
    (row: CSVRow, index: number): string[] => {
      const errors: string[] = [];

      const sku = String(row.sku || row.SKU || "").trim();
      if (!sku) {
        errors.push("SKU is required");
      } else {
        const exists = inventory.some((item) => item.sku === sku);
        if (!exists) {
          errors.push(`SKU "${sku}" not found`);
        }
      }

      const qty = Number(row.quantity || row.Quantity || row.onHand || row["On Hand"]);
      if (isNaN(qty)) {
        errors.push("Quantity must be a number");
      } else if (qty < 0) {
        errors.push("Quantity cannot be negative");
      }

      return errors;
    },
    [inventory]
  );

  const handleImport = async (rows: CSVRow[]) => {
    if (!profile?.organization_id) {
      toast.error("No organization found");
      return;
    }

    let updated = 0;

    for (const row of rows) {
      const sku = String(row.sku || row.SKU || "").trim();
      const qty = Number(row.quantity || row.Quantity || row.onHand || row["On Hand"]) || 0;

      const item = inventory.find((i) => i.sku === sku);
      if (!item) continue;

      if (item.id) {
        await supabase
          .from("inventory_items")
          .update({ on_hand: qty })
          .eq("id", item.id);
      } else {
        await supabase.from("inventory_items").insert({
          product_id: item.productId,
          organization_id: profile.organization_id,
          on_hand: qty,
        });
      }
      updated++;
    }

    toast.success(`Updated ${updated} inventory items`);
    fetchInventory();
  };

  const columns = [
    {
      key: "sku",
      header: "SKU",
      className: "font-mono text-sm",
    },
    {
      key: "name",
      header: "Product",
      render: (item: InventoryItem) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: "onHand",
      header: "On Hand",
      className: "text-center",
      render: (item: InventoryItem) => (
        <span
          className={
            item.onHand <= item.reorderPoint
              ? "text-warning font-semibold"
              : "font-medium"
          }
        >
          {item.onHand}
        </span>
      ),
    },
    {
      key: "reorderPoint",
      header: "Reorder Point",
      className: "text-center text-muted-foreground",
    },
    {
      key: "status",
      header: "Status",
      render: (item: InventoryItem) =>
        item.onHand <= item.reorderPoint ? (
          <StatusBadge variant="warning">Low</StatusBadge>
        ) : (
          <StatusBadge variant="success">OK</StatusBadge>
        ),
    },
    ...(canManageProducts
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (item: InventoryItem) => (
              <Button variant="outline" size="sm" onClick={() => handleOpenAdjust(item)}>
                Adjust Stock
              </Button>
            ),
          },
        ]
      : []),
  ];

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <PageHeader title="Inventory" description="Track and adjust stock levels" />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Inventory"
        description="Track and adjust stock levels"
      >
        <div className="flex gap-2">
          {canManageProducts && (
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </PageHeader>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search inventory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats Summary */}
      <div className="flex gap-6 mb-6 text-sm">
        <div>
          <span className="text-muted-foreground">Total Items: </span>
          <span className="font-medium">{inventory.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Low Stock: </span>
          <span className="font-medium text-warning">
            {inventory.filter((i) => i.onHand <= i.reorderPoint).length}
          </span>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredInventory}
        emptyState={{
          title: "No inventory items",
          description: "Add products to start tracking inventory.",
        }}
      />

      {/* Stock Adjustment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {selectedItem?.name} — Current: {selectedItem?.onHand} units
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <Label className="mb-3 block">Adjustment Quantity</Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdjustmentQty((q) => q - 1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={adjustmentQty}
                onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                className="text-center text-lg font-medium w-24"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdjustmentQty((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              New quantity:{" "}
              <span className="font-medium text-foreground">
                {(selectedItem?.onHand || 0) + adjustmentQty}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Import Inventory Quantities"
        description="Upload a CSV file with SKU and Quantity columns to adjust inventory levels. Only existing SKUs will be updated."
        expectedColumns={importColumns}
        validator={validateImportRow}
        onImport={handleImport}
      />
    </div>
  );
}
