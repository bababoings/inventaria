import { useState, useCallback, useEffect } from "react";
import { Plus, Search, MoreHorizontal, Edit, Archive, Download, Upload } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateCSV, downloadCSV, CSVRow } from "@/lib/csv";
import { CSVImportDialog } from "@/components/csv/CSVImportDialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Product {
  id: string;
  sku: string;
  name: string;
  cost: number;
  price: number;
  onHand: number;
  reorderPoint: number;
  reorderQty: number;
  status: string;
}

const importColumns = [
  { key: "sku", header: "SKU", required: true },
  { key: "name", header: "Name", required: true },
  { key: "cost", header: "Cost", required: true },
  { key: "price", header: "Price", required: true },
  { key: "onHand", header: "On Hand", required: false },
  { key: "reorderPoint", header: "Reorder Point", required: false },
  { key: "reorderQty", header: "Reorder Qty", required: false },
];

export default function Products() {
  const { profile, canManageProducts } = useUserProfile();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    cost: "",
    price: "",
    reorderPoint: "",
    reorderQty: "",
    initialStock: "",
  });

  // Fetch products from Supabase
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    
    // Fetch products with their inventory
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select(`
        id,
        sku,
        name,
        cost,
        price,
        reorder_point,
        reorder_qty,
        status,
        inventory_items(on_hand)
      `)
      .order("name");

    if (productsError) {
      console.error("Error fetching products:", productsError);
      toast.error("Failed to load products");
      setIsLoading(false);
      return;
    }

    const mappedProducts: Product[] = (productsData || []).map((p) => {
      // Handle both array and object responses for inventory_items
      const invItem = Array.isArray(p.inventory_items) 
        ? p.inventory_items[0] 
        : p.inventory_items;
      
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        cost: Number(p.cost),
        price: Number(p.price),
        onHand: invItem?.on_hand ?? 0,
        reorderPoint: p.reorder_point,
        reorderQty: p.reorder_qty,
        status: p.status,
      };
    });

    setProducts(mappedProducts);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku,
        name: product.name,
        cost: product.cost.toString(),
        price: product.price.toString(),
        reorderPoint: product.reorderPoint.toString(),
        reorderQty: product.reorderQty.toString(),
        initialStock: "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        sku: "SKU-",
        name: "",
        cost: "",
        price: "",
        reorderPoint: "",
        reorderQty: "",
        initialStock: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!profile?.organization_id) {
      toast.error("No organization found");
      return;
    }

    if (!formData.sku.trim() || !formData.name.trim()) {
      toast.error("SKU and Name are required");
      return;
    }

    setIsSaving(true);

    const productData = {
      sku: formData.sku.trim(),
      name: formData.name.trim(),
      cost: parseFloat(formData.cost) || 0,
      price: parseFloat(formData.price) || 0,
      reorder_point: parseInt(formData.reorderPoint) || 0,
      reorder_qty: parseInt(formData.reorderQty) || 1,
      organization_id: profile.organization_id,
    };

    if (editingProduct) {
      // Update existing product
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        console.error("Error updating product:", error);
        toast.error("Failed to update product");
        setIsSaving(false);
        return;
      }
      toast.success("Product updated successfully");
    } else {
      // Create new product
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single();

      if (error) {
        console.error("Error creating product:", error);
        if (error.code === "23505") {
          toast.error("A product with this SKU already exists");
        } else {
          toast.error("Failed to create product");
        }
        setIsSaving(false);
        return;
      }

      // Create inventory item for the new product with initial stock
      if (newProduct) {
        const initialStock = parseInt(formData.initialStock) || 0;
        await supabase.from("inventory_items").insert({
          product_id: newProduct.id,
          organization_id: profile.organization_id,
          on_hand: initialStock,
        });
      }

      toast.success("Product added successfully");
    }

    setIsSaving(false);
    setIsDialogOpen(false);
    fetchProducts();
  };

  const handleExport = () => {
    const csv = generateCSV(products, [
      { key: "sku", header: "SKU" },
      { key: "name", header: "Name" },
      { key: "cost", header: "Cost" },
      { key: "price", header: "Price" },
      { key: "onHand", header: "On Hand" },
      { key: "reorderPoint", header: "Reorder Point" },
      { key: "reorderQty", header: "Reorder Qty" },
    ]);
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `products-${date}.csv`);
    toast.success("Products exported successfully");
  };

  const validateImportRow = useCallback(
    (row: CSVRow, index: number): string[] => {
      const errors: string[] = [];

      const sku = String(row.sku || row.SKU || "").trim();
      if (!sku) {
        errors.push("SKU is required");
      }

      const name = String(row.name || row.Name || "").trim();
      if (!name) {
        errors.push("Name is required");
      }

      const cost = Number(row.cost || row.Cost);
      if (isNaN(cost)) {
        errors.push("Cost must be a number");
      } else if (cost < 0) {
        errors.push("Cost cannot be negative");
      }

      const price = Number(row.price || row.Price);
      if (isNaN(price)) {
        errors.push("Price must be a number");
      } else if (price < 0) {
        errors.push("Price cannot be negative");
      }

      const onHand = row.onHand ?? row["On Hand"] ?? 0;
      if (onHand !== "" && onHand !== undefined) {
        const qty = Number(onHand);
        if (isNaN(qty)) {
          errors.push("On Hand must be a number");
        } else if (qty < 0) {
          errors.push("On Hand cannot be negative");
        }
      }

      return errors;
    },
    []
  );

  const handleImport = async (rows: CSVRow[]) => {
    if (!profile?.organization_id) {
      toast.error("No organization found");
      return;
    }

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const sku = String(row.sku || row.SKU || "").trim();
      const name = String(row.name || row.Name || "").trim();
      const cost = Number(row.cost || row.Cost) || 0;
      const price = Number(row.price || row.Price) || 0;
      const reorderPoint = Number(row.reorderPoint || row["Reorder Point"]) || 0;
      const reorderQty = Number(row.reorderQty || row["Reorder Qty"]) || 1;

      // Check if product exists
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("sku", sku)
        .single();

      if (existing) {
        // Update existing product
        await supabase
          .from("products")
          .update({ name, cost, price, reorder_point: reorderPoint, reorder_qty: reorderQty })
          .eq("id", existing.id);
        updated++;
      } else {
        // Create new product
        const { data: newProduct } = await supabase
          .from("products")
          .insert({
            sku,
            name,
            cost,
            price,
            reorder_point: reorderPoint,
            reorder_qty: reorderQty,
            organization_id: profile.organization_id,
          })
          .select()
          .single();

        if (newProduct) {
          await supabase.from("inventory_items").insert({
            product_id: newProduct.id,
            organization_id: profile.organization_id,
            on_hand: 0,
          });
        }
        created++;
      }
    }

    const messages: string[] = [];
    if (created > 0) messages.push(`Created ${created} products`);
    if (updated > 0) messages.push(`Updated ${updated} products`);
    toast.success(messages.join(", "));
    
    fetchProducts();
  };

  const handleArchive = async (product: Product) => {
    const { error } = await supabase
      .from("products")
      .update({ status: "ARCHIVED" })
      .eq("id", product.id);

    if (error) {
      console.error("Error archiving product:", error);
      toast.error("Failed to archive product");
      return;
    }

    toast.success(`${product.name} has been archived`);
    fetchProducts();
  };

  const columns = [
    {
      key: "sku",
      header: "SKU",
      className: "font-mono text-sm",
    },
    {
      key: "name",
      header: "Product Name",
      render: (item: Product) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: "price",
      header: "Price",
      render: (item: Product) => `$${item.price.toFixed(2)}`,
    },
    {
      key: "onHand",
      header: "On Hand",
      className: "text-center",
      render: (item: Product) => (
        <span className={item.onHand <= item.reorderPoint ? "text-warning font-medium" : ""}>
          {item.onHand}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Product) =>
        item.status === "ARCHIVED" ? (
          <StatusBadge variant="default">Archived</StatusBadge>
        ) : item.onHand <= item.reorderPoint ? (
          <StatusBadge variant="warning">Low Stock</StatusBadge>
        ) : (
          <StatusBadge variant="success">In Stock</StatusBadge>
        ),
    },
    ...(canManageProducts
      ? [
          {
            key: "actions",
            header: "",
            className: "w-12",
            render: (item: Product) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenDialog(item)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  {item.status === "ACTIVE" && (
                    <DropdownMenuItem onClick={() => handleArchive(item)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]
      : []),
  ];

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <PageHeader title="Products" description="Manage your product catalog" />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Products" description="Manage your product catalog">
        <div className="flex gap-2">
          {canManageProducts && (
            <>
              <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {canManageProducts && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredProducts}
        emptyState={{
          title: "No products yet",
          description: canManageProducts 
            ? "Add your first product to get started with inventory management."
            : "No products available.",
        }}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add Product"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update the product details below."
                : "Enter the details for your new product."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                  SKU-
                </span>
                <Input
                  id="sku"
                  value={formData.sku.replace(/^SKU-/, '')}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, sku: `SKU-${numericValue}` });
                  }}
                  placeholder="001"
                  className="rounded-l-none"
                  disabled={!!editingProduct}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Wireless Mouse"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cost">Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  placeholder="15.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="29.99"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reorderPoint">Reorder Point</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  min="0"
                  value={formData.reorderPoint}
                  onChange={(e) =>
                    setFormData({ ...formData, reorderPoint: e.target.value })
                  }
                  placeholder="10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reorderQty">Reorder Quantity</Label>
                <Input
                  id="reorderQty"
                  type="number"
                  min="1"
                  value={formData.reorderQty}
                  onChange={(e) =>
                    setFormData({ ...formData, reorderQty: e.target.value })
                  }
                  placeholder="25"
                />
              </div>
            </div>
            {!editingProduct && (
              <div className="grid gap-2">
                <Label htmlFor="initialStock">Initial Stock</Label>
                <Input
                  id="initialStock"
                  type="number"
                  min="0"
                  value={formData.initialStock}
                  onChange={(e) =>
                    setFormData({ ...formData, initialStock: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingProduct ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Import Products"
        description="Upload a CSV file to create or update products. Existing SKUs will be updated, new SKUs will be created."
        expectedColumns={importColumns}
        validator={validateImportRow}
        onImport={handleImport}
      />
    </div>
  );
}
