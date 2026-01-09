import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [showExpiredError, setShowExpiredError] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const { signIn, signUp, resendConfirmationEmail } = useAuth();

  // Check for error parameters in URL (e.g., expired confirmation link)
  useEffect(() => {
    const error = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    const errorDescription = searchParams.get("error_description");
    
    if (error === "access_denied" && errorCode === "otp_expired") {
      setShowExpiredError(true);
      setIsSignUp(true);
      // Try to extract email from error description or use stored email
      const emailMatch = errorDescription?.match(/email[:\s]+([^\s]+)/i);
      if (emailMatch) {
        setEmail(emailMatch[1]);
        setPendingEmail(emailMatch[1]);
      }
      toast.error("Confirmation link has expired. Please request a new one.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setIsLoading(true);

    if (isSignUp) {
      // Validate organization ID if staff registration
      if (isStaff && !organizationId.trim()) {
        toast.error("Organization ID is required for staff registration");
        setIsLoading(false);
        return;
      }

      // Validate organization ID format (UUID)
      if (isStaff && organizationId.trim()) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(organizationId.trim())) {
          toast.error("Invalid organization ID format");
          setIsLoading(false);
          return;
        }
      }

      const { error } = await signUp(
        email, 
        password, 
        isStaff ? organizationId.trim() : undefined
      );
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("This email is already registered. Please sign in instead.");
        } else {
          toast.error(error.message);
        }
        setIsLoading(false);
      } else {
        toast.success("Check your email to confirm your account!");
        setIsLoading(false);
        setPendingEmail(email);
        // The useEffect will handle showing the org setup dialog when user becomes available
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Welcome back!");
      }
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const emailToResend = pendingEmail || email;
    if (!emailToResend) {
      toast.error("Please enter your email address");
      return;
    }

    setIsResending(true);
    const { error } = await resendConfirmationEmail(emailToResend);
    if (error) {
      toast.error(error.message || "Failed to resend confirmation email");
    } else {
      toast.success("Confirmation email sent! Please check your inbox.");
      setShowExpiredError(false);
    }
    setIsResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Package className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">InventarIA</CardTitle>
          <CardDescription>
            {isSignUp ? "Create your account" : "Sign in to your account to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showExpiredError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your confirmation link has expired. Please request a new confirmation email.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            {isSignUp && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isStaff"
                    checked={isStaff}
                    onCheckedChange={(checked) => {
                      setIsStaff(checked === true);
                      if (!checked) setOrganizationId("");
                    }}
                  />
                  <Label htmlFor="isStaff" className="text-sm font-normal cursor-pointer">
                    I'm registering as staff member
                  </Label>
                </div>
                {isStaff && (
                  <div className="space-y-2">
                    <Label htmlFor="organizationId">
                      Organization ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="organizationId"
                      type="text"
                      placeholder="Enter organization ID"
                      value={organizationId}
                      onChange={(e) => setOrganizationId(e.target.value)}
                      required={isStaff}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ask your organization admin for the organization ID
                    </p>
                  </div>
                )}
              </>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading 
                ? (isSignUp ? "Creating account..." : "Signing in...") 
                : (isSignUp ? "Create Account" : "Sign In")
              }
            </Button>
          </form>
          {(showExpiredError || pendingEmail) && (
            <div className="mt-4 text-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleResendConfirmation}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? "Sending..." : "Resend Confirmation Email"}
              </Button>
            </div>
          )}
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setShowExpiredError(false);
                setPendingEmail(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {isSignUp 
                ? "Already have an account? Sign in" 
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
