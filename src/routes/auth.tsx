import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ورود | MoteKitchen" },
      { name: "description", content: "ورود یا ثبت‌نام در سامانه MoteKitchen." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, org_name: orgName || "رستوران من" },
          },
        });
        if (error) throw error;
        toast.success("ثبت‌نام موفق بود. در حال ورود...");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("خوش آمدید!");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || "خطا در انجام عملیات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-b from-background to-accent/40">
      <Link to="/" className="mb-6 flex items-center gap-2 text-primary">
        <UtensilsCrossed className="h-7 w-7" />
        <span className="text-2xl font-bold">MoteKitchen</span>
      </Link>
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">
            {mode === "signin" ? "ورود به حساب" : "ساخت رستوران جدید"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "با ایمیل و رمز عبور خود وارد شوید"
              : "اولین کاربر ثبت‌نام کننده، مالک رستوران خواهد بود"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="fullName">نام و نام خانوادگی</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="orgName">نام رستوران / کافه</Label>
                <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="مثلاً کافه ستاره" required />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
          </div>
          <div>
            <Label htmlFor="password">رمز عبور</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "لطفاً صبر کنید..." : mode === "signin" ? "ورود" : "ثبت‌نام"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          {mode === "signin" ? (
            <button className="text-primary hover:underline" onClick={() => setMode("signup")}>
              حساب ندارید؟ ثبت‌نام کنید
            </button>
          ) : (
            <button className="text-primary hover:underline" onClick={() => setMode("signin")}>
              حساب دارید؟ وارد شوید
            </button>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          اگر توسط مدیر رستوران دعوت شده‌اید، با همان ایمیل ثبت‌نام کنید تا به‌طور خودکار به بخش شما اضافه شوید.
        </p>
      </Card>
    </div>
  );
}
