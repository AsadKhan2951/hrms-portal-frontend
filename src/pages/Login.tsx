import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function Login() {
  const { theme } = useTheme();
  const logoClassName = theme === "dark" ? "h-10 w-auto object-contain" : "h-10 w-auto object-contain invert";
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorSetup, setTwoFactorSetup] = useState(false);
  const [twoFactorQr, setTwoFactorQr] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  /**
   * Where to land after signing in.
   *
   * This used to refetch auth.me and read the role off that. It was the same
   * GET URL the page had already fetched while signed out, and API responses
   * carried no cache headers, so the browser could replay the earlier `null` -
   * the role came back undefined and the dashboard's own auth check then
   * bounced straight back here. That was the login loop on iPhones.
   *
   * The role now comes from the sign-in response itself, which cannot be a
   * stale read of anything.
   */
  const redirectByRole = (role?: string) => {
    window.location.href = role === "admin" ? "/admin" : "/dashboard";
  };

  const loginMutation = trpc.auth.customLogin.useMutation({
    onSuccess: async (data: any) => {
      if (data?.requiresTwoFactor) {
        setTwoFactorRequired(true);
        setTwoFactorToken(data.twoFactorToken);
        setTwoFactorSetup(Boolean(data.setupRequired));
        setTwoFactorQr(data.qrCodeDataUrl ?? null);
        setTwoFactorSecret(data.secret ?? null);
        toast.message("Enter your verification code");
        return;
      }
      toast.success("Login successful!");
      redirectByRole(data?.user?.role);
    },
    onError: (error) => {
      toast.error(error.message || "Login failed");
    },
  });

  const verifyMutation = trpc.auth.verifyTwoFactor.useMutation({
    onSuccess: async (data: any) => {
      toast.success("Verification successful!");
      // Only admins are sent through two-factor, so this is "admin" in
      // practice; reading it from the response keeps that from being an
      // assumption baked into the client.
      redirectByRole(data?.role);
    },
    onError: (error) => {
      toast.error(error.message || "Verification failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ employeeId, password });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    verifyMutation.mutate({
      token: twoFactorToken,
      code: twoFactorCode,
    });
  };

  const resetToLogin = () => {
    setTwoFactorRequired(false);
    setTwoFactorToken("");
    setTwoFactorSetup(false);
    setTwoFactorQr(null);
    setTwoFactorSecret(null);
    setTwoFactorCode("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img
              src="/new-logo-v2.png"
              alt="Now HRMS"
              className={logoClassName}
            />
          </div>
          <CardDescription className="text-center">
            Enter your employee credentials to access the portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!twoFactorRequired ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee Name</Label>
                <Input
                  id="employeeId"
                  type="text"
                  placeholder="Employee Name"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  disabled={loginMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loginMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                {twoFactorSetup
                  ? "Scan the QR code in your authenticator app, then enter the 6-digit code."
                  : "Enter the 6-digit code from your authenticator app."}
              </div>

              {twoFactorSetup && (
                <div className="space-y-3">
                  {twoFactorQr && (
                    <div className="flex justify-center">
                      <img
                        src={twoFactorQr}
                        alt="Authenticator QR"
                        className="h-40 w-40 rounded-md border"
                      />
                    </div>
                  )}
                  {twoFactorSecret && (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Secret: <span className="font-mono">{twoFactorSecret}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={setTwoFactorCode}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <InputOTPSlot key={idx} index={idx} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={verifyMutation.isPending || twoFactorCode.length < 6}
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Continue"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={resetToLogin}
                disabled={verifyMutation.isPending}
              >
                Back to login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
