import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  UtensilsCrossed,
  X,
  ClipboardList,
  ShoppingCart,
  Eye,
  ArrowLeft,
  MessageSquareOff,
  AlarmClock,
  HelpCircle,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "MoteKitchen — مدیریت درخواست‌های خرید رستوران و کافه" },
      {
        name: "description",
        content:
          "MoteKitchen درخواست‌های خرید پرسنل رستوران و کافه را در یک سیستم شفاف و قابل پیگیری جمع می‌کند تا مدیر و مسئول خرید بدون واتساپ و کاغذبازی کار کنند.",
      },
      { property: "og:title", content: "MoteKitchen — مدیریت درخواست‌های خرید رستوران و کافه" },
      {
        property: "og:description",
        content:
          "همه درخواست‌های خرید بخش‌ها را در یک داشبورد ببینید و مدیریت کنید — بدون پیام گم‌شده.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <Problems />
      <Solution />
      <Trust />
      <FinalCTA />
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b bg-card/70 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-5 w-5" />
          <span className="font-bold">MoteKitchen</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">ورود</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">ثبت‌نام رایگان</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 80% 10%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%), radial-gradient(50% 40% at 10% 20%, color-mix(in oklab, var(--accent) 60%, transparent), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            نسخه آزمایشی (Beta)
          </span>
          <h1 className="mt-5 text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            دیگه هیچ درخواست خریدی گم نمیشه.
          </h1>
          <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed">
            MoteKitchen تمام درخواست‌های خرید پرسنل را در یک سیستم واحد جمع می‌کند تا
            مدیر و مسئول خرید بدون تماس، واتساپ و کاغذبازی سفارش‌ها را مدیریت کنند.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="text-base px-6 shadow-lg shadow-primary/20">
                ثبت‌نام رایگان
                <ArrowLeft className="h-4 w-4 mr-2" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="text-base px-6">
                ورود
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary/20 to-accent/50 blur-2xl -z-10" />
          <MockupFrame />
        </div>
      </div>
    </section>
  );
}

function MockupFrame() {
  return (
    <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center gap-1.5 border-b px-3 py-2 bg-muted/40">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
        <span className="mx-auto text-[11px] text-muted-foreground">motekitchen.app / dashboard</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">میز مسئول خرید</div>
          <span className="text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5">۱۲ درخواست باز</span>
        </div>
        {[
          { name: "گوجه فرنگی", dept: "آشپزخانه", qty: "۸ کیلو", urgent: true },
          { name: "شیر پرچرب", dept: "بار", qty: "۲۰ لیتر", urgent: false },
          { name: "دستمال کاغذی", dept: "سالن", qty: "۴ بسته", urgent: false },
        ].map((row) => (
          <div key={row.name} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-md bg-accent grid place-items-center text-accent-foreground text-xs font-bold">
                {row.name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{row.name}</div>
                <div className="text-[11px] text-muted-foreground">{row.dept} • {row.qty}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {row.urgent && (
                <span className="text-[10px] rounded bg-destructive/15 text-destructive px-1.5 py-0.5">فوری</span>
              )}
              <span className="text-[10px] rounded bg-primary/15 text-primary px-1.5 py-0.5">در انتظار</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Problems() {
  const items = [
    { icon: MessageSquareOff, text: "درخواست‌های خرید در واتساپ گم می‌شوند." },
    { icon: AlarmClock, text: "مواد اولیه وسط شیفت تمام می‌شوند." },
    { icon: HelpCircle, text: "هیچ‌کس نمی‌داند خرید انجام شده یا نه." },
    { icon: Clock, text: "مدیر باید مدام پیگیر خریدها باشد و زمان زیادی صرف هماهنگی می‌کند." },
  ];
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h2 className="text-2xl md:text-3xl font-bold text-center">این مشکلات برایتان آشناست؟</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <Card key={i} className="p-5 h-full">
              <div className="flex items-start gap-3">
                <div className="shrink-0 h-9 w-9 rounded-lg bg-destructive/10 grid place-items-center text-destructive">
                  <X className="h-5 w-5" />
                </div>
                <p className="text-sm leading-relaxed">{it.text}</p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-destructive/80 text-xs">
                <it.icon className="h-3.5 w-3.5" />
                <span>مشکل رایج</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Solution() {
  const steps = [
    {
      icon: ClipboardList,
      title: "ثبت شفاف در هر بخش",
      body: "پرسنل هر بخش، لیست خرید روزانه‌ی خود را ثبت می‌کنند — بدون تماس و پیام‌های پراکنده.",
      outcome: "کاهش اتلاف مواد و جلوگیری از تمام‌شدن ناگهانی",
    },
    {
      icon: ShoppingCart,
      title: "یک داشبورد برای مسئول خرید",
      body: "مسئول خرید تمام درخواست‌ها را یکجا می‌بیند، اولویت‌بندی می‌کند و با یک کلیک وضعیت را به‌روز می‌کند.",
      outcome: "صرفه‌جویی در زمان و تمرکز روی خرید، نه پیگیری",
    },
    {
      icon: Eye,
      title: "پیگیری کامل برای مدیر",
      body: "همه‌چیز شفاف، قابل پیگیری و بدون پیام گم‌شده است. مدیر تاریخچه‌ی کامل خریدها را در اختیار دارد.",
      outcome: "دید کامل عملیاتی و کنترل هزینه",
    },
  ];
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">MoteKitchen این فرآیند را ساده می‌کند.</h2>
          <p className="mt-3 text-muted-foreground">
            یک جریان کاری روشن از ثبت درخواست تا تحویل خرید — بدون کاغذ، بدون سردرگمی.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={i} className="p-6 relative overflow-hidden">
              <div className="absolute top-4 left-4 text-6xl font-black text-primary/10 leading-none">
                {toFa(i + 1)}
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              <div className="mt-4 pt-4 border-t text-xs text-primary font-medium">
                ← {s.outcome}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function toFa(n: number) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function Trust() {
  return (
    <section className="border-t bg-accent/30">
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <p className="text-sm md:text-base text-accent-foreground/80">
          طراحی‌شده بر اساس مصاحبه با مدیران کافه و رستوران
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-3xl px-4 py-20 md:py-28 text-center">
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
          همین امروز فرآیند خرید رستورانت را منظم کن.
        </h2>
        <p className="mt-4 text-muted-foreground">
          در کمتر از یک دقیقه ثبت‌نام کنید و اولین بخش رستوران خود را بسازید.
        </p>
        <div className="mt-8">
          <Link to="/auth">
            <Button size="lg" className="text-base px-8 shadow-lg shadow-primary/20">
              ثبت‌نام رایگان
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-4 w-4" />
          <span className="font-semibold">MoteKitchen</span>
        </div>
        <div>© {toFa(new Date().getFullYear())} — تمامی حقوق محفوظ است.</div>
      </div>
    </footer>
  );
}
