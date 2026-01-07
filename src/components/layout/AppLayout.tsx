import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const CURRENCIES = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "MXN", label: "MXN - Mexican Peso" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "BRL", label: "BRL - Brazilian Real" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Mexico_City", label: "Mexico City (CST)" },
  { value: "America/Toronto", label: "Toronto (EST)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
];

export function AppLayout() {
  const { user } = useAuth();
  const [showOrgSetup, setShowOrgSetup] = useState(false);
  const [orgFormData, setOrgFormData] = useState({
    name: "",
    currency: "USD",
    timezone: "America/New_York",
  });
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [hasCheckedOrg, setHasCheckedOrg] = useState(false);

  // Check for organization setup after user is authenticated
  useEffect(() => {
    const checkAndShowOrgSetup = async () => {
      if (!user || hasCheckedOrg) return;

      // Check if we've already completed org setup in this session
      const orgSetupComplete = sessionStorage.getItem(`org_setup_complete_${user.id}`);
      if (orgSetupComplete === 'true') {
        setHasCheckedOrg(true);
        return;
      }

      // Wait a bit for the database trigger to create the organization
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        // Profile might not be created yet, try again later
        setHasCheckedOrg(true);
        return;
      }

      // Check if organization needs to be created (organization_id is NULL)
      if (!profile.organization_id) {
        // Show setup dialog to create organization
        setShowOrgSetup(true);
      } else {
        // Organization already exists, mark as complete
        sessionStorage.setItem(`org_setup_complete_${user.id}`, 'true');
      }
      
      setHasCheckedOrg(true);
    };

    if (user) {
      checkAndShowOrgSetup();
    }
  }, [user, hasCheckedOrg]);

  const handleOrgSetup = async () => {
    if (!orgFormData.name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    if (!user) {
      toast.error("User not found");
      return;
    }

    setIsSavingOrg(true);

    try {
      // Get user's profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, organization_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        toast.error("Failed to find your profile. Please try signing in again.");
        setIsSavingOrg(false);
        return;
      }

      // Create the organization using the database function (bypasses RLS)
      const { data: result, error: orgError } = await supabase.rpc(
        'create_user_organization',
        {
          p_name: orgFormData.name.trim(),
          p_currency: orgFormData.currency,
          p_timezone: orgFormData.timezone,
        }
      );

      if (orgError || !result || !result.success) {
        console.error("Error creating organization:", orgError);
        toast.error(orgError?.message || "Failed to create organization");
        setIsSavingOrg(false);
        return;
      }

      // Mark org setup as complete in sessionStorage before reload
      if (user) {
        sessionStorage.setItem(`org_setup_complete_${user.id}`, 'true');
      }

      toast.success("Organization setup complete!");
      setShowOrgSetup(false);
      // Reload the page to refresh user context
      window.location.reload();
    } catch (error) {
      console.error("Error setting up organization:", error);
      toast.error("An unexpected error occurred");
      setIsSavingOrg(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Organization Setup Dialog */}
      <Dialog open={showOrgSetup} onOpenChange={(open) => {
        // Prevent closing the dialog until setup is complete
        if (!open && !isSavingOrg) {
          // Allow closing only if not saving
          setShowOrgSetup(false);
        }
      }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Set Up Your Organization</DialogTitle>
            <DialogDescription>
              Please provide some details about your organization to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">
                Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-name"
                value={orgFormData.name}
                onChange={(e) =>
                  setOrgFormData({ ...orgFormData, name: e.target.value })
                }
                placeholder="My Company"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={orgFormData.currency}
                onValueChange={(value) =>
                  setOrgFormData({ ...orgFormData, currency: value })
                }
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={orgFormData.timezone}
                onValueChange={(value) =>
                  setOrgFormData({ ...orgFormData, timezone: value })
                }
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleOrgSetup}
              disabled={isSavingOrg || !orgFormData.name.trim()}
            >
              {isSavingOrg ? "Saving..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
