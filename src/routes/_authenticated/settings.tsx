import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Profile = { id: string; org_id: string; is_owner: boolean };
type Dept = { id: string; name: string };
type Staff = { id: string; full_name: string | null; email: string; department_id: string | null; is_owner: boolean; is_purchaser: boolean };
type Invite = { id: string; email: string; department_id: string | null; is_purchaser: boolean };
type Item = { id: string; name: string; unit: string; department_id: string };

function SettingsPage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["me-owner"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("id,org_id,is_owner").eq("id", u.user!.id).maybeSingle();
      return data as Profile | null;
    },
  });

  const { data: depts = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async (): Promise<Dept[]> => {
      const { data } = await supabase.from("departments").select("id,name").order("name");
      return (data ?? []) as Dept[];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async (): Promise<Staff[]> => {
      const { data } = await supabase.from("profiles")
        .select("id,full_name,email,department_id,is_owner,is_purchaser").order("full_name");
      return (data ?? []) as Staff[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["invites"],
    queryFn: async (): Promise<Invite[]> => {
      const { data } = await supabase.from("invitations")
        .select("id,email,department_id,is_purchaser").order("created_at", { ascending: false });
      return (data ?? []) as Invite[];
    },
  });

  if (!profile?.is_owner) {
    return <Card className="p-6 text-center text-muted-foreground">فقط مالک رستوران دسترسی دارد</Card>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">مدیریت رستوران</h1>
      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">بخش‌ها</TabsTrigger>
          <TabsTrigger value="staff">پرسنل و دعوت‌ها</TabsTrigger>
          <TabsTrigger value="catalog">کاتالوگ کالاها</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-4">
          <DepartmentsPanel depts={depts} orgId={profile.org_id} />
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <StaffPanel depts={depts} staff={staff} invites={invites} orgId={profile.org_id} meId={profile.id} qc={qc} />
        </TabsContent>
        <TabsContent value="catalog" className="mt-4">
          <CatalogPanel depts={depts} orgId={profile.org_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DepartmentsPanel({ depts, orgId }: { depts: Dept[]; orgId: string }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("نام لازم است");
      const { error } = await supabase.from("departments").insert({ org_id: orgId, name: newName.trim() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); setNewName(""); toast.success("افزوده شد"); },
    onError: (e: any) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase.from("departments").update({ name: editName.trim() }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); setEditingId(null); toast.success("ذخیره شد"); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); toast.success("حذف شد"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex gap-2">
        <Input placeholder="نام بخش جدید (مثلاً بار و کافه)" value={newName} onChange={e => setNewName(e.target.value)} />
        <Button onClick={() => add.mutate()}><Plus className="h-4 w-4 ml-1" /> افزودن</Button>
      </div>
      {depts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">هنوز بخشی ندارید</p>
      ) : (
        <ul className="divide-y">
          {depts.map(d => (
            <li key={d.id} className="py-2 flex items-center gap-2">
              {editingId === d.id ? (
                <>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1" />
                  <Button size="icon" onClick={() => rename.mutate()}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1">{d.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(d.id); setEditName(d.name); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => {
                    if (confirm(`بخش «${d.name}» حذف شود؟ کاتالوگ و درخواست‌های آن نیز حذف خواهند شد.`)) del.mutate(d.id);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StaffPanel({ depts, staff, invites, orgId, meId, qc }: {
  depts: Dept[]; staff: Staff[]; invites: Invite[]; orgId: string; meId: string; qc: ReturnType<typeof useQueryClient>;
}) {
  const [email, setEmail] = useState("");
  const [deptId, setDeptId] = useState("");
  const [isPurchaser, setIsPurchaser] = useState(false);

  const me = staff.find(s => s.id === meId);

  const invite = useMutation({
    mutationFn: async () => {
      if (!email.trim() || !deptId) throw new Error("ایمیل و بخش را وارد کنید");
      const { error } = await supabase.from("invitations").insert({
        org_id: orgId, email: email.trim().toLowerCase(),
        department_id: deptId, is_purchaser: isPurchaser,
        invited_by: meId,
        invited_by_name: me?.full_name || me?.email || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      setEmail(""); setDeptId(""); setIsPurchaser(false);
      toast.success("دعوت‌نامه ثبت شد. کاربر با همین ایمیل ثبت‌نام کند.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("invitations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });

  const updateStaff = useMutation({
    mutationFn: async (p: { id: string; department_id?: string | null; is_purchaser?: boolean }) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("profiles").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); toast.success("به‌روزرسانی شد"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">دعوت کاربر جدید</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>ایمیل</Label>
            <Input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <Label>بخش</Label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger><SelectValue placeholder="انتخاب" /></SelectTrigger>
              <SelectContent>
                {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isPurchaser} onCheckedChange={(v) => setIsPurchaser(!!v)} />
              مسئول خرید
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => invite.mutate()} disabled={invite.isPending}>ارسال دعوت</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          کاربر باید با همین ایمیل در صفحه ثبت‌نام حساب بسازد؛ به‌طور خودکار به بخش و رستوران شما اضافه می‌شود.
        </p>
      </Card>

      {invites.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">دعوت‌های در انتظار</h3>
          <ul className="divide-y">
            {invites.map(i => (
              <li key={i.id} className="py-2 flex items-center gap-3">
                <span className="flex-1" dir="ltr">{i.email}</span>
                <span className="text-sm text-muted-foreground">
                  {depts.find(d => d.id === i.department_id)?.name || "—"}
                  {i.is_purchaser && " · مسئول خرید"}
                </span>
                <Button size="icon" variant="ghost" onClick={() => cancelInvite.mutate(i.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-semibold mb-3">پرسنل</h3>
        <ul className="divide-y">
          {staff.map(s => (
            <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.full_name || s.email}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{s.email}</div>
              </div>
              <Select
                value={s.department_id || ""}
                onValueChange={(v) => updateStaff.mutate({ id: s.id, department_id: v || null })}
                disabled={s.id === meId && s.is_owner}
              >
                <SelectTrigger className="w-48"><SelectValue placeholder="بدون بخش" /></SelectTrigger>
                <SelectContent>
                  {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={s.is_purchaser}
                  disabled={s.id === meId && s.is_owner}
                  onCheckedChange={(v) => updateStaff.mutate({ id: s.id, is_purchaser: !!v })}
                />
                مسئول خرید
              </label>
              {s.is_owner && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">مالک</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CatalogPanel({ depts, orgId }: { depts: Dept[]; orgId: string }) {
  const qc = useQueryClient();
  const [deptId, setDeptId] = useState<string>(depts[0]?.id || "");
  const current = deptId || depts[0]?.id || "";

  const { data: items = [] } = useQuery({
    queryKey: ["catalog-all", current],
    enabled: !!current,
    queryFn: async (): Promise<Item[]> => {
      const { data } = await supabase.from("catalog_items").select("*").eq("department_id", current).order("name");
      return (data ?? []) as Item[];
    },
  });

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !unit.trim() || !current) throw new Error("اطلاعات ناقص");
      const { error } = await supabase.from("catalog_items").insert({
        org_id: orgId, department_id: current, name: name.trim(), unit: unit.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["catalog-all", current] }); setName(""); setUnit(""); toast.success("افزوده شد"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("catalog_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog-all", current] }),
  });

  if (depts.length === 0) {
    return <Card className="p-6 text-center text-muted-foreground">ابتدا یک بخش بسازید</Card>;
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <Label>بخش</Label>
          <Select value={current} onValueChange={setDeptId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-5 items-end">
        <div className="md:col-span-3">
          <Label>نام کالا</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثلاً گوشت چرخ‌کرده" />
        </div>
        <div>
          <Label>واحد</Label>
          <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="کیلوگرم، لیتر، عدد..." />
        </div>
        <Button onClick={() => add.mutate()}><Plus className="h-4 w-4 ml-1" /> افزودن</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">کاتالوگ این بخش خالی است</p>
      ) : (
        <ul className="divide-y">
          {items.map(i => (
            <li key={i.id} className="py-2 flex items-center gap-3">
              <span className="flex-1">{i.name}</span>
              <span className="text-sm text-muted-foreground">{i.unit}</span>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
