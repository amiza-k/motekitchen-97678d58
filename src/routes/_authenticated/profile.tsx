import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Save, User } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import type { ProfileData } from "./route";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useQuery<ProfileData | null>({
    queryKey: ["me"],
  });

  const [name, setName] = useState("");
  useEffect(() => { if (profile?.full_name) setName(profile.full_name); }, [profile?.full_name]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() || null })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("نام با موفقیت ذخیره شد");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading || !profile) {
    return <div className="text-muted-foreground">در حال بارگذاری...</div>;
  }

  const roles: { label: string; variant?: "default" | "secondary" }[] = [];
  if (profile.is_owner) roles.push({ label: "مالک", variant: "default" });
  if (profile.is_purchaser) roles.push({ label: "مسئول خرید", variant: "secondary" });
  if (profile.departments) roles.push({ label: `عضو بخش ${profile.departments.name}`, variant: "secondary" });
  if (roles.length === 0) roles.push({ label: "بدون نقش", variant: "secondary" });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">پروفایل من</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">اطلاعات حساب</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" value={profile.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">نام نمایشی</Label>
            <div className="flex gap-2">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="نام و نام خانوادگی" />
              <Button onClick={() => save.mutate()} disabled={save.isPending || name === (profile.full_name ?? "")}>
                <Save className="h-4 w-4 ml-1" /> ذخیره
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">نقش‌ها در {profile.organizations?.name}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {roles.map((r, i) => <Badge key={i} variant={r.variant}>{r.label}</Badge>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">خروج</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOut}>
            <LogOut className="h-4 w-4 ml-1" /> خروج از حساب
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
