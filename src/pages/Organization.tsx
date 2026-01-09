import { useState, useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Users, UserPlus, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface OrganizationMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

interface StaffInvitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
  invited_by: string;
}

export default function Organization() {
  const { profile, isAdmin } = useUserProfile();
  const [organization, setOrganization] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (!profile?.organization_id || !isAdmin) return;
    fetchOrganizationData();
  }, [profile, isAdmin]);

  const fetchOrganizationData = async () => {
    if (!profile?.organization_id) return;

    setIsLoading(true);
    try {
      // Fetch organization details
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", profile.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(orgData);

      // Fetch members using the database function
      const { data: membersData, error: membersError } = await supabase.rpc(
        "get_organization_members",
        { org_id: profile.organization_id }
      );

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch pending invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from("staff_invitations")
        .select("id, email, status, created_at, expires_at, invited_by")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (invitationsError) throw invitationsError;
      setInvitations(invitationsData || []);
    } catch (error) {
      console.error("Error fetching organization data:", error);
      toast.error("Failed to load organization data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !profile?.organization_id) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsInviting(true);
    try {
      const { data, error } = await supabase.rpc("invite_staff_member", {
        p_email: inviteEmail.trim(),
        p_organization_id: profile.organization_id,
      });

      if (error) throw error;

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setShowInviteDialog(false);
      fetchOrganizationData();
    } catch (error: any) {
      console.error("Error inviting staff member:", error);
      toast.error(error.message || "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const copyOrganizationId = async () => {
    if (!organization?.id) return;

    try {
      await navigator.clipboard.writeText(organization.id);
      setCopiedId(true);
      toast.success("Organization ID copied to clipboard");
      setTimeout(() => setCopiedId(false), 2000);
    } catch (error) {
      toast.error("Failed to copy organization ID");
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <PageHeader
          title="Organization"
          description="You don't have permission to view this page"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Organization" description="Loading..." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Organization & Team"
        description="Manage your organization members and invitations"
      />

      {/* Organization Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
          <CardDescription>Your organization details and ID</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Organization Name</Label>
            <p className="text-sm font-medium mt-1">{organization?.name}</p>
          </div>
          <div>
            <Label>Organization ID</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                {organization?.id}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyOrganizationId}
                className="shrink-0"
              >
                {copiedId ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Share this ID with staff members during registration
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                {members.length} {members.length === 1 ? "member" : "members"} in your organization
              </CardDescription>
            </div>
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No members yet. Invite someone to get started!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name || "N/A"}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={member.role}
                        variant={member.role === "ADMIN" ? "default" : "secondary"}
                      >
                        {member.role}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(member.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invitations Section */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              {invitations.filter((inv) => inv.status === "pending").length} pending invitation
              {invitations.filter((inv) => inv.status === "pending").length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={invitation.status}
                        variant={
                          invitation.status === "accepted"
                            ? "success"
                            : invitation.status === "expired"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {invitation.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(invitation.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invitation.expires_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization. They'll need to sign up with your
              organization ID.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inviteEmail.trim()) {
                    handleInvite();
                  }
                }}
              />
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Organization ID:</strong> {organization?.id}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Share this ID with the invitee. They'll need it during registration.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
              {isInviting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

