import { useState, useCallback, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Mail, Phone, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  created_at: string;
}

export default function Suppliers() {
  const { profile } = useUserProfile();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  // Fetch suppliers from Supabase
  const fetchSuppliers = useCallback(async () => {
    if (!profile?.organization_id) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("status", "ACTIVE")
      .order("name");

    if (error) {
      console.error("Error fetching suppliers:", error);
      toast.error("Failed to load suppliers");
      setIsLoading(false);
      return;
    }

    setSuppliers(data || []);
    setIsLoading(false);
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (supplier.phone && supplier.phone.includes(searchQuery))
  );

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: "", email: "", phone: "", address: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    if (!profile?.organization_id) {
      toast.error("No organization found");
      return;
    }

    setIsSaving(true);

    const supplierData = {
      name: formData.name.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      organization_id: profile.organization_id,
      status: "ACTIVE",
    };

    if (editingSupplier) {
      // Update existing supplier
      const { error } = await supabase
        .from("suppliers")
        .update(supplierData)
        .eq("id", editingSupplier.id);

      if (error) {
        console.error("Error updating supplier:", error);
        toast.error("Failed to update supplier");
        setIsSaving(false);
        return;
      }

      toast.success("Supplier updated successfully");
    } else {
      // Create new supplier
      const { error } = await supabase
        .from("suppliers")
        .insert(supplierData);

      if (error) {
        console.error("Error creating supplier:", error);
        toast.error("Failed to create supplier");
        setIsSaving(false);
        return;
      }

      toast.success("Supplier added successfully");
    }

    setIsSaving(false);
    setIsDialogOpen(false);
    fetchSuppliers();
  };

  const handleDelete = async (id: string) => {
    // Soft delete by setting status to ARCHIVED
    const { error } = await supabase
      .from("suppliers")
      .update({ status: "ARCHIVED" })
      .eq("id", id);

    if (error) {
      console.error("Error archiving supplier:", error);
      toast.error("Failed to delete supplier");
      return;
    }

    toast.success("Supplier deleted");
    fetchSuppliers();
  };

  const columns: Column<Supplier>[] = [
    { key: "id", header: "ID", className: "w-24 font-mono text-xs" },
    {
      key: "name",
      header: "Supplier Name",
      render: (supplier) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{supplier.name}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (supplier) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="w-4 h-4" />
          <span>{supplier.email || "—"}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (supplier) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="w-4 h-4" />
          <span>{supplier.phone || "—"}</span>
        </div>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (supplier) => (
        <span className="text-muted-foreground">
          {supplier.address || "—"}
        </span>
      ),
    },
    {
      key: "actions" as keyof Supplier,
      header: "",
      className: "w-24",
      render: (supplier) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDialog(supplier);
            }}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(supplier.id);
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <PageHeader title="Suppliers" description="Manage your supplier contacts and information" />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading suppliers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Suppliers" description="Manage your supplier contacts and information">
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </PageHeader>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredSuppliers}
        emptyState={{
          title: "No suppliers yet",
          description: "Add your first supplier to get started",
          action: (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          ),
        }}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Edit Supplier" : "Add Supplier"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Supplier Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter supplier name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="supplier@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 555-0100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="123 Business St, City"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingSupplier
                ? "Save Changes"
                : "Add Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
