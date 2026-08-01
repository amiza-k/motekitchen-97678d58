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
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Check, X, ChevronUp, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Profile = { id: string; org_id: string; is_owner: boolean };
type Dept = { id: string; name: string };
type Staff = { id: string; full_name: string | null; email: string; department_id: string | null; is_owner: boolean; is_purchaser: boolean };
type Invite = {
  id: string; email: string; department_id: string | null; is_purchaser: boolean;
  identifier_type: "email" | "phone" | "username";
};
type Item = { id: string; name: string; unit: string; department_id: string; sort_order: number };

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
    queryKey: ["invites", profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async (): Promise<Invite[]> => {
      const { data } = await supabase.from("invitations")
        .select("id,email,department_id,is_purchaser,identifier_type")
        .eq("org_id", profile!.org_id)
        .order("created_at", { ascending: false });
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
  const [identifierType, setIdentifierType] = useState<"email" | "phone" | "username">("email");
  const [identifierValue, setIdentifierValue] = useState("");
  const [deptId, setDeptId] = useState("");
  const [isPurchaser, setIsPurchaser] = useState(false);

  const me = staff.find(s => s.id === meId);

  const identifierMeta = {
    email: { label: "ایمیل", placeholder: "user@example.com", type: "email" as const },
    phone: { label: "شماره تماس", placeholder: "09xxxxxxxxx", type: "text" as const },
    username: { label: "یوزرنیم", placeholder: "مثلاً amir_reza", type: "text" as const },
  }[identifierType];

  const invite = useMutation({
    mutationFn: async () => {
      const raw = identifierValue.trim();
      if (!raw || !deptId) throw new Error("مشخصات کاربر و بخش را وارد کنید");

      let normalized = raw;
      if (identifierType === "email") {
        normalized = raw.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("ایمیل معتبر نیست");
      } else if (identifierType === "phone") {
        normalized = raw.replace(/[۰-۹٠-٩]/g, (d) => {
          const p = "۰۱۲۳۴۵۶۷۸۹".indexOf(d);
          if (p > -1) return String(p);
          const a = "٠١٢٣٤٥٦٧٨٩".indexOf(d);
          return a > -1 ? String(a) : d;
        });
        if (!/^09\d{9}$/.test(normalized)) throw new Error("شماره همراه باید با 09 شروع شود و ۱۱ رقم باشد");
      } else {
        normalized = raw;
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalized)) throw new Error("یوزرنیم باید ۳ تا ۲۰ کاراکتر و فقط شامل حروف انگلیسی، عدد و _ باشد");
      }

      const { error } = await supabase.from("invitations").insert({
        org_id: orgId, email: normalized, identifier_type: identifierType,
        department_id: deptId, is_purchaser: isPurchaser,
        invited_by: meId,
        invited_by_name: me?.full_name || me?.email || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      setIdentifierValue(""); setDeptId(""); setIsPurchaser(false);
      toast.success("دعوت‌نامه ثبت شد.");
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

  const identifierTypeLabel = (t: Invite["identifier_type"]) =>
    t === "email" ? "ایمیل" : t === "phone" ? "شماره" : "یوزرنیم";

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">دعوت کاربر جدید</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <Label>نوع شناسه</Label>
            <Select value={identifierType} onValueChange={(v: any) => { setIdentifierType(v); setIdentifierValue(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">ایمیل</SelectItem>
                <SelectItem value="phone">شماره تماس</SelectItem>
                <SelectItem value="username">یوزرنیم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>{identifierMeta.label}</Label>
            <Input
              dir="ltr"
              type={identifierMeta.type}
              value={identifierValue}
              onChange={e => setIdentifierValue(e.target.value)}
              placeholder={identifierMeta.placeholder}
              maxLength={identifierType === "phone" ? 11 : undefined}
            />
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
          {identifierType === "username"
            ? "کاربری که این یوزرنیم را در پروفایل خود ثبت کرده باشد، دعوت را در بخش «دعوت‌های من» می‌بیند و می‌تواند دستی بپذیرد."
            : "اگر کاربر هنوز حساب نساخته، با همین مشخصات ثبت‌نام کند تا خودکار به بخش و رستوران شما اضافه شود؛ اگر از قبل حساب دارد، دعوت را در «دعوت‌های من» می‌بیند."}
        </p>
      </Card>

      {invites.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">دعوت‌های در انتظار</h3>
          <ul className="divide-y">
            {invites.map(i => (
              <li key={i.id} className="py-2 flex items-center gap-3">
                <span className="text-xs bg-muted px-2 py-0.5 rounded shrink-0">{identifierTypeLabel(i.identifier_type)}</span>
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
      const { data } = await supabase.from("catalog_items").select("*").eq("department_id", current).order("sort_order", { ascending: true });
      return (data ?? []) as Item[];
    },
  });

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !unit.trim() || !current) throw new Error("اطلاعات ناقص");
      const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1;
      const { error } = await supabase.from("catalog_items").insert({
        org_id: orgId, department_id: current, name: name.trim(), unit: unit.trim(),
        sort_order: nextOrder,
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      if (!editName.trim() || !editUnit.trim()) throw new Error("اطلاعات ناقص");
      const { error } = await supabase.from("catalog_items")
        .update({ name: editName.trim(), unit: editUnit.trim() })
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-all", current] });
      setEditingId(null);
      toast.success("ذخیره شد");
    },
    onError: (e: any) => toast.error(e.message),
  });

    const move = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const idx = items.findIndex((i) => i.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) return;
      const a = items[idx];
      const b = items[swapIdx];
      const { error: e1 } = await supabase.from("catalog_items").update({ sort_order: b.sort_order }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("catalog_items").update({ sort_order: a.sort_order }).eq("id", b.id);
      if (e2) throw e2;
    },
    onMutate: async ({ id, direction }) => {
      await qc.cancelQueries({ queryKey: ["catalog-all", current] });
      const previous = qc.getQueryData<Item[]>(["catalog-all", current]);
      if (previous) {
        const idx = previous.findIndex((i) => i.id === id);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (idx >= 0 && swapIdx >= 0 && swapIdx < previous.length) {
          const next = [...previous];
          [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
          qc.setQueryData(["catalog-all", current], next);
        }
      }
      return { previous };
    },
    onError: (e: any, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["catalog-all", current], ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["catalog-all", current] }),
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
          {items.map((i, idx) => (
            <li key={i.id} className="py-2 flex items-center gap-3">
              {editingId === i.id ? (
                <>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1" placeholder="نام کالا" />
                  <Input value={editUnit} onChange={e => setEditUnit(e.target.value)} className="w-32" placeholder="واحد" />
                  <Button size="icon" onClick={() => update.mutate()} disabled={update.isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex flex-col -my-1 shrink-0">
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      disabled={idx === 0 || move.isPending}
                      onClick={() => move.mutate({ id: i.id, direction: "up" })}
                      aria-label="جابجایی به بالا"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      disabled={idx === items.length - 1 || move.isPending}
                      onClick={() => move.mutate({ id: i.id, direction: "down" })}
                      aria-label="جابجایی به پایین"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="flex-1">{i.name}</span>
                  <span className="text-sm text-muted-foreground">{i.unit}</span>
                  <Button size="icon" variant="ghost" onClick={() => {
                    setEditingId(i.id); setEditName(i.name); setEditUnit(i.unit);
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}>
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

