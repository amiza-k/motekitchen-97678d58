import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";
import { classifyIdentifier, phoneToEmail } from "@/lib/phone-auth";
import { PasswordInput } from "@/components/ui/password-input";

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

  const [fullName, setFullName] = useState("");
  const [signupContact, setSignupContact] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");

  const [identifier, setIdentifier] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const contact = classifyIdentifier(signupContact);

    if (!fullName.trim()) return toast.error("نام و نام خانوادگی را وارد کنید");
    if (contact.kind === "other")
      return toast.error("یک ایمیل معتبر یا شماره همراهی که با 09 شروع شود و ۱۱ رقم باشد وارد کنید");
    if (signupPassword.length < 6) return toast.error("رمز عبور باید حداقل ۶ کاراکتر باشد");
    if (signupPassword !== signupPasswordConfirm)
      return toast.error("رمز عبور و تکرار آن یکسان نیستند");

    const phone = contact.kind === "phone" ? contact.value : null;
    const realEmail = contact.kind === "email" ? contact.value : null;
    // فقط برای ساخت حساب در auth.users لازم است؛ در profiles ذخیره نمی‌شود
    // و کاربر هرگز آن را نمی‌بیند.
    const authEmail = phone ? phoneToEmail(phone) : (realEmail as string);

    setLoading(true);
    try {
      if (phone) {
        const { data: taken, error: availError } = await supabase.rpc(
          "check_phone_availability" as never,
          { _phone: phone } as never,
        );
        if (availError) throw availError;
        if (taken) throw new Error("این شماره همراه قبلاً ثبت‌نام شده است");
      }

      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: signupPassword,
        options: {
          data: { full_name: fullName.trim(), phone, real_email: realEmail },
        },
      });
      if (error) throw error;
      toast.success("ثبت‌نام موفق بود. در حال ورود...");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message || "خطا در ثبت‌نام");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = classifyIdentifier(identifier);
    if (parsed.kind === "other") return toast.error("یک ایمیل یا شماره همراه معتبر وارد کنید");

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_login_email" as never, {
        _identifier: parsed.value,
      } as never);
      if (error) throw error;
      if (!data) throw new Error("حسابی با این ایمیل یا شماره پیدا نشد");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data as unknown as string,
        password: signinPassword,
      });
      if (signInError) throw new Error("مشخصات یا رمز عبور اشتباه است");
      toast.success("خوش آمدید!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message || "خطا در ورود");
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
          <h1 className="text-xl font-bold">{mode === "signin" ? "ورود به حساب" : "ثبت‌نام"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "با ایمیل یا شماره همراه و رمز عبور خود وارد شوید"
              : "پس از ثبت‌نام می‌توانید رستوران خود را بسازید یا دعوت‌نامه‌ای را بپذیرید"}
          </p>
        </div>

        {mode === "signup" ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <Label htmlFor="fullName">نام و نام خانوادگی</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="signupContact">ایمیل یا شماره همراه</Label>
              <Input
                id="signupContact"
                value={signupContact}
                onChange={(e) => setSignupContact(e.target.value)}
                required
                dir="ltr"
                placeholder="ایمیل یا شماره همراه خود را وارد کنید"
              />
            </div>
            <div>
              <Label htmlFor="signupPassword">رمز عبور</Label>
              <PasswordInput id="signupPassword" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="signupPasswordConfirm">تکرار رمز عبور</Label>
              <PasswordInput id="signupPasswordConfirm" value={signupPasswordConfirm} onChange={(e) => setSignupPasswordConfirm(e.target.value)} required minLength={6} dir="ltr" />            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "لطفاً صبر کنید..." : "ثبت‌نام"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="identifier">ایمیل یا شماره همراه</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                dir="ltr"
                placeholder="ایمیل یا شماره همراه خود را وارد کنید"
              />
            </div>
            <div>
              <Label htmlFor="signinPassword">رمز عبور</Label>
              <PasswordInput id="signinPassword" value={signinPassword} onChange={(e) => setSigninPassword(e.target.value)} required minLength={6} dir="ltr" />            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "لطفاً صبر کنید..." : "ورود"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              رمز عبور را فراموش کرده‌اید؟
            </p>
          </form>
        )}

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
          اگر توسط مدیر رستوران دعوت شده‌اید، با همان ایمیلی که برایتان ثبت شده ثبت‌نام کنید تا به‌طور خودکار به بخش شما اضافه شوید.
        </p>
      </Card>
    </div>
  );
} 