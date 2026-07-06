import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutList, ShoppingCart, History, Settings, LogOut, UtensilsCrossed, Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MyInvitations } from "@/components/MyInvitations";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { userId: data.user.id };
  },
  component: AuthLayout,
});

export type ProfileData = {
  id: string;
  org_id: string;
  full_name: string | null;
  email: string;
  department_id: string | null;
  is_owner: boolean;
  is_purchaser: boolean;
  organizations: { id: string; name: string } | null;
  departments: { id: string; name: string } | null;
};

function AuthLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<ProfileData | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, organizations(id,name), departments(id,name)")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileData | null;
    },
  });

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">در حال بارگذاری...</div>;
  }
  if (!profile) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">پروفایل یافت نشد</div>;
  }

  const nav = [
    { to: "/dashboard", label: "لیست خرید بخش", icon: LayoutList, show: !!profile.department_id },
    { to: "/purchaser", label: "میز مسئول خرید", icon: ShoppingCart, show: profile.is_purchaser || profile.is_owner },
    { to: "/history", label: "تاریخچه", icon: History, show: true },
    { to: "/settings", label: "مدیریت رستوران", icon: Settings, show: profile.is_owner },
  ].filter(n => n.show);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button className="md:hidden -mr-2 p-2" onClick={() => setMobileOpen(v => !v)} aria-label="menu">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <UtensilsCrossed className="h-5 w-5 text-primary shrink-0" />
            <span className="font-bold text-primary">MoteKitchen</span>
            <span className="text-muted-foreground text-sm truncate hidden sm:inline">
              — {profile.organizations?.name}
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-accent",
                  pathname.startsWith(item.to) && "bg-accent text-accent-foreground font-medium"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent text-sm",
                pathname.startsWith("/profile") && "bg-accent"
              )}
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">{profile.full_name || profile.email}</span>
              <RoleBadge profile={profile} />
            </Link>
            <Button size="sm" variant="ghost" onClick={signOut} className="hidden sm:inline-flex">
              <LogOut className="h-4 w-4 ml-1" /> خروج
            </Button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="md:hidden border-t bg-card px-2 py-2 flex flex-col gap-1">
            {nav.map(item => (
              <Link key={item.to} to={item.to} className={cn(
                "px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-accent",
                pathname.startsWith(item.to) && "bg-accent text-accent-foreground font-medium"
              )}>
                <item.icon className="h-4 w-4" />{item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
        <MyInvitations />
        <Outlet />
      </main>
    </div>
  );
}
