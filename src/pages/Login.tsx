import { useEffect, useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { trpc } from "@/lib/trpc";
import { isAnyHead, isOrgWide } from "@/lib/roles";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  // Off unless the person turned it on last time: signing in to check a
  // payslip in the evening should not start a shift by surprise.
  const [clockMeIn, setClockMeInState] = useState(() => {
    try {
      return localStorage.getItem("now-clock-on-signin") === "1";
    } catch {
      return false;
    }
  });
  const setClockMeIn = (value: boolean) => {
    setClockMeInState(value);
    try {
      localStorage.setItem("now-clock-on-signin", value ? "1" : "0");
    } catch {
      // Private browsing; the choice just will not persist.
    }
  };
  const [clockingIn, setClockingIn] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
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
  const clockInMutation = trpc.timeTracking.clockIn.useMutation();

  /**
   * "Clock me in as I sign in". Runs after the session cookie is set and
   * before the redirect. Best effort: it sends the same optional GPS fix the
   * clock-in dialog sends, and a failure (already clocked in, say) never
   * blocks the sign-in itself - the person can still clock in from Home.
   */
  const clockInIfAsked = async () => {
    if (!clockMeIn) return;
    setClockingIn(true);
    try {
      const location = await new Promise<
        { lat: number; lng: number; accuracy: number; source: "gps" } | undefined
      >(resolve => {
        if (!navigator.geolocation) return resolve(undefined);
        navigator.geolocation.getCurrentPosition(
          position =>
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              source: "gps",
            }),
          () => resolve(undefined),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
        );
      });
      await clockInMutation.mutateAsync(location ? { location } : undefined);
    } catch {
      // Already clocked in, or the clock refused; Home shows the real state.
    } finally {
      setClockingIn(false);
    }
  };

  const redirectByRole = (role?: string) => {
    // Org-wide roles get the full admin overview; a department head lands on
    // their own team, since the overview is organisation-wide and not theirs
    // to see; everyone else gets the employee dashboard.
    const target = isOrgWide(role) ? "/admin" : isAnyHead(role) ? "/admin/team" : "/dashboard";
    window.location.href = target;
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
      await clockInIfAsked();
      redirectByRole(data?.user?.role);
    },
    onError: (error) => {
      toast.error(error.message || "Login failed");
    },
  });

  const verifyMutation = trpc.auth.verifyTwoFactor.useMutation({
    onSuccess: async (data: any) => {
      toast.success("Verification successful!");
      await clockInIfAsked();
      // Two-factor covers admins and heads of operations, so the role has to
      // come from the response rather than being assumed.
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

  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const longDate = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const busy = loginMutation.isPending || clockingIn;

  return (
    <div className="now-signin">
      <section className="now-signin-hero">
        <img src="/new-logo-v2.png" alt="Now" />
        <div>
          <div className="now-signin-date">{longDate}</div>
          <div className="now-signin-clock" aria-hidden="true">
            {hhmm}
            <span>{pad(now.getSeconds())}</span>
          </div>
          <h1>{greeting}. Your day is ready when you are.</h1>
        </div>
        <div className="now-signin-note">
          <span className="mark">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="font-bold">Everything for your day in one place</div>
            <small>Attendance, tasks, leave and payslips, the moment you sign in.</small>
          </div>
        </div>
      </section>

      <section className="now-signin-side">
        {!twoFactorRequired ? (
          <form className="now-signin-form" onSubmit={handleSubmit}>
            <div>
              <h2>Sign in</h2>
              <p className="text-muted-foreground mt-1">Use your employee ID to get in.</p>
            </div>

            <div className="now-field">
              <label htmlFor="employeeId">Employee ID</label>
              <input
                id="employeeId"
                className="now-input"
                type="text"
                autoComplete="username"
                placeholder="Enter your employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="now-field">
              <label htmlFor="password">Password</label>
              <div className="now-input-wrap">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="now-btn text"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={clockMeIn}
              className="now-clock-toggle"
              onClick={() => setClockMeIn(!clockMeIn)}
            >
              <span>
                <span className="block font-bold">Clock me in as I sign in</span>
                <span className="block text-sm text-muted-foreground">
                  {clockMeIn ? `Your day starts at ${hhmm}` : "You can clock in later from Home"}
                </span>
              </span>
              <span className={`now-switch${clockMeIn ? " on" : ""}`} />
            </button>

            <button type="submit" className="now-btn lime xl" disabled={busy}>
              {busy && <Loader2 className="h-5 w-5 animate-spin" />}
              {busy ? "Signing in..." : clockMeIn ? "Sign in and clock in" : "Sign in"}
            </button>

            <p className="text-sm text-muted-foreground text-center">
              New here or locked out? Ask HR to set up your account.
            </p>
          </form>
        ) : (
          <form className="now-signin-form" onSubmit={handleVerify}>
            <div>
              <h2>Verify it's you</h2>
              <p className="text-muted-foreground mt-1">
                {twoFactorSetup
                  ? "Scan the QR code in your authenticator app, then enter the 6-digit code."
                  : "Enter the 6-digit code from your authenticator app."}
              </p>
            </div>

            {twoFactorSetup && (
              <div className="space-y-3">
                {twoFactorQr && (
                  <div className="flex justify-center">
                    <img
                      src={twoFactorQr}
                      alt="Authenticator QR"
                      className="h-44 w-44 rounded-2xl bg-white p-2"
                    />
                  </div>
                )}
                {twoFactorSecret && (
                  <div className="rounded-xl bg-card px-4 py-3 text-xs text-muted-foreground break-all">
                    Secret: <span className="font-mono text-foreground">{twoFactorSecret}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center">
              <InputOTP maxLength={6} value={twoFactorCode} onChange={setTwoFactorCode} autoFocus>
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <InputOTPSlot key={idx} index={idx} className="h-12 w-11 text-lg bg-card" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <button
              type="submit"
              className="now-btn lime xl"
              disabled={verifyMutation.isPending || clockingIn || twoFactorCode.length < 6}
            >
              {(verifyMutation.isPending || clockingIn) && <Loader2 className="h-5 w-5 animate-spin" />}
              {verifyMutation.isPending || clockingIn ? "Verifying..." : "Verify & Continue"}
            </button>

            <button
              type="button"
              className="now-btn text"
              onClick={resetToLogin}
              disabled={verifyMutation.isPending}
            >
              Back to login
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
