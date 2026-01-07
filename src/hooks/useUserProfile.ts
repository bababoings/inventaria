import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UserProfile {
  id: string;
  organization_id: string;
  full_name: string | null;
  role: string;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, organization_id, full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        setProfile(null);
      } else {
        setProfile(data);
      }
      setIsLoading(false);
    }

    fetchProfile();
  }, [user]);

  const isAdmin = profile?.role === "ADMIN";
  const isStaff = profile?.role === "STAFF";
  const canManageProducts = isAdmin; // Only ADMIN can add/edit products and inventory

  return { profile, isLoading, isAdmin, isStaff, canManageProducts };
}
