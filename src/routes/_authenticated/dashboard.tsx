import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Edit2, Plus, Send, AlertTriangle, Building2, MapPin, Users, ClipboardList, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Profile = {
  id: string;
  org_id: string | null;
  department_id: string | null;
  is_owner: boolean;
  is_purchaser: boolean;
  departments: { id: string; name: string } | null;
};
type Entry = {
  id: string; item_name: string; unit: string; quantity: number; urgency: string;
  note: string | null; is_custom: boolean; created_at: string; added_by: string;
  catalog_item_id: string | null;
};
type CatalogItem = { id: string; name: string; unit: string };

function DashboardPage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["me-dept"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles")
        .select("id, org_id, department_id, is_owner, is_purchaser, departments(id,name)")
        .eq("id", u.user.id).maybeSingle();
      return data as Profile | null;
    },
  });

  if (isLoading || !profile) return null;
  if (profile.is_owner) return <OwnerDashboard orgId={profile.org_id!} />;
  if (profile.department_id) return <DepartmentBoard profile={profile} />;
  return (
    <Card className="p-6 text-center">
      <h2 className="text-lg font-semibold mb-2">هنوز به بخشی اختصاص داده نشده‌اید</h2>
      <p className="text-sm text-muted-foreground">
        از مدیر رستوران بخواهید شما را به یک بخش اضافه کند.
      </p>
    </Card>
  );
}

/* ------------------------------- Owner view ------------------------------- */

type Org = { id: string; name: string; province: string | null; city: string | null; address: string | null };
type DeptSummary = {
  id: string;
  name: string;
  members: { id: string; full_name: string | null; email: string }[];
  pending: number;
};

function OwnerDashboard({ orgId }: { orgId: string }) {
  const { data: org } = useQuery({
    queryKey: ["org", orgId],
    queryFn: async (): Promise<Org | null> => {
      const { data } = await supabase.from("organizations")
        .select("id,name,province,city,address").eq("id", orgId).maybeSingle();
      return data as Org | null;
    },
  });

  const { data: depts = [] } = useQuery({
    queryKey: ["owner-depts", orgId],
    queryFn: async (): Promise<DeptSummary[]> => {
      const [{ data: dRows }, { data: pRows }, { data: eRows }] = await Promise.all([
        supabase.from("departments").select("id,name").eq("org_id", orgId).order("name"),
        supabase.from("profiles").select("id,full_name,email,department_id").eq("org_id", orgId),
        supabase.from("shopping_list_entries").select("department_id").eq("org_id", orgId),
      ]);
      const members = pRows ?? [];
      const entries = eRows ?? [];
      return (dRows ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        members: members.filter((m: any) => m.department_id === d.id)
          .map((m: any) => ({ id: m.id, full_name: m.full_name, email: m.email })),
        pending: entries.filter((e: any) => e.department_id === d.id).length,
      }));
    },
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{org?.name ?? "رستوران من"}</h1>
            {(org?.province || org?.city) && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[org?.province, org?.city].filter(Boolean).join("، ")}
              </p>
            )}
            {org?.address && <p className="text-sm text-muted-foreground mt-0.5">{org.address}</p>}
          </div>
          <Link to="/settings" className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0">
            <SettingsIcon className="h-4 w-4" /> مدیریت
          </Link>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">بخش‌ها</h2>
          <span className="text-sm text-muted-foreground">{depts.length} بخش</span>
        </div>

        {depts.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="h-14 w-14 rounded-full bg-muted mx-auto grid place-items-center mb-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">هنوز بخشی نساخته‌اید</h3>
            <p className="text-sm text-muted-foreground mb-4">
              برای شروع، اولین بخش رستوران را بسازید (مثلاً آشپزخانه یا بار).
            </p>
            <Button asChild>
              <Link to="/settings">ساخت بخش جدید</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {depts.map(d => (
              <Link
                key={d.id}
                to="/settings"
                className="group"
              >
                <Card className="p-4 h-full hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                      {d.name}
                    </h3>
                    {d.pending > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-warning/20 text-warning-foreground px-2 py-0.5 rounded-full shrink-0">
                        <ClipboardList className="h-3 w-3" />
                        {d.pending} در لیست
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <Users className="h-3.5 w-3.5" />
                    {d.members.length} نفر
                  </div>

                  {d.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">هنوز پرسنلی اختصاص نیافته</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {d.members.slice(0, 4).map(m => (
                        <div
                          key={m.id}
                          className="flex items-center gap-1.5 bg-muted rounded-full pr-1 pl-2 py-0.5"
                          title={m.full_name || m.email}
                        >
                          <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold grid place-items-center">
                            {initials(m.full_name || m.email)}
                          </span>
                          <span className="text-xs truncate max-w-[7rem]">{m.full_name || m.email}</span>
                        </div>
                      ))}
                      {d.members.length > 4 && (
                        <span className="text-xs text-muted-foreground self-center">
                          +{d.members.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function initials(s: string) {
  const t = s.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* --------------------------- Department member view --------------------------- */

function DepartmentBoard({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const deptId = profile.department_id!;

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", deptId],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase.from("shopping_list_entries")
        .select("*").eq("department_id", deptId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog", deptId],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase.from("catalog_items")
        .select("id,name,unit").eq("department_id", deptId).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });

  const [mode, setMode] = useState<"catalog" | "custom">("catalog");
  const [catalogId, setCatalogId] = useState("");
  const [customName, setCustomName] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal");
  const [note, setNote] = useState("");

  const addEntry = useMutation({
    mutationFn: async () => {
      const q = parseFloat(quantity);
      if (!q || q <= 0) {
        throw new Error("مقدار نامعتبر");
      }

      // Check duplicates
      const targetName = mode === "catalog"
        ? catalog.find(c => c.id === catalogId)?.name
        : customName.trim();
      if (targetName) {
        const isDuplicate = entries.some(
          e => e.item_name.trim().toLowerCase() === targetName.trim().toLowerCase()
        );
        if (isDuplicate) {
          throw new Error("این مورد پیش از این در لیست شما وجود دارد. لطفاً مقدار آن را در همان‌جا ویرایش کنید.");
        }
      }
      const { data: u } = await supabase.auth.getUser();
      if (mode === "catalog") {
        const item = catalog.find(c => c.id === catalogId);
        if (!item) throw new Error("کالای کاتالوگ را انتخاب کنید");
        const { error } = await supabase.from("shopping_list_entries").insert({
          org_id: profile.org_id!, department_id: deptId, catalog_item_id: item.id,
          item_name: item.name, unit: item.unit, quantity: q, urgency,
          note: note || null, is_custom: false, added_by: u.user!.id,
        });
        if (error) throw error;
      } else {
        if (!customName.trim() || !unit.trim()) throw new Error("نام و واحد را وارد کنید");
        const { error } = await supabase.from("shopping_list_entries").insert({
          org_id: profile.org_id!, department_id: deptId, catalog_item_id: null,
          item_name: customName.trim(), unit: unit.trim(), quantity: q, urgency,
          note: note || null, is_custom: true, added_by: u.user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", deptId] });
      setCatalogId(""); setCustomName(""); setUnit(""); setQuantity(""); setNote(""); setUrgency("normal");
      toast.success("افزوده شد");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_list_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", deptId] }),
  });

const [confirmSend, setConfirmSend] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editUrgency, setEditUrgency] = useState<"normal" | "urgent">("normal");

  const openEditDialog = (entry: any) => {
    setEditingEntry(entry);
    setEditQuantity(entry.quantity.toString());
    setEditNote(entry.note || "");
    setEditUrgency(entry.urgency);
  };

  const updateEntry = useMutation({
    mutationFn: async ({ id, quantity, note, urgency }: { id: string; quantity: number; note: string | null; urgency: "normal" | "urgent" }) => {
      const { error } = await supabase
        .from("shopping_list_entries")
        .update({ quantity, note, urgency })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", deptId] });
      toast.success("تغییرات ثبت شد");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const sendBatch = useMutation({
    mutationFn: async () => {
      if (entries.length === 0) return;
      const { data: u } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const rows = entries.map(e => ({
        org_id: profile.org_id!,
        department_id: deptId,
        item_name: e.item_name,
        unit: e.unit,
        is_custom: e.is_custom,
        requested_quantity: e.quantity,
        urgency: e.urgency,
        note: e.note,
        status: "pending",
        added_by: u.user!.id,
        order_date: now,
      }));
      const { error: e1 } = await supabase.from("tasks").insert(rows);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("shopping_list_entries").delete().eq("department_id", deptId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", deptId] });
      toast.success("لیست به مسئول خرید ارسال شد");
      setConfirmSend(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لیست خرید — {profile.departments?.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          تمام همکاران این بخش می‌توانند این لیست را ببینند و ویرایش کنند.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant={mode === "catalog" ? "default" : "outline"} onClick={() => setMode("catalog")}>
            از کاتالوگ
          </Button>
          <Button size="sm" variant={mode === "custom" ? "default" : "outline"} onClick={() => setMode("custom")}>
            کالای دلخواه
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          {mode === "catalog" ? (
            <div className="md:col-span-3">
              <Label>کالا</Label>
              <Select value={catalogId} onValueChange={setCatalogId}>
                <SelectTrigger><SelectValue placeholder={catalog.length ? "انتخاب کنید" : "کاتالوگ خالی است"} /></SelectTrigger>
                <SelectContent>
                  {catalog.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.unit})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="md:col-span-2">
                <Label>نام کالا</Label>
                <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="مثلاً زعفران" />
              </div>
              <div>
                <Label>واحد</Label>
                <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="گرم، عدد، لیتر..." />
              </div>
            </>
          )}
          <div>
            <Label>مقدار</Label>
            <Input type="number" inputMode="decimal" min="0" step="0.1" value={quantity} onChange={e => setQuantity(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label>فوریت</Label>
            <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">عادی</SelectItem>
                <SelectItem value="urgent">فوری</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6">
            <Label>یادداشت (اختیاری)</Label>
            <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => addEntry.mutate()} disabled={addEntry.isPending}>
            <Plus className="h-4 w-4 ml-1" /> افزودن به لیست
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">اقلام لیست ({entries.length})</h2>
          <Button onClick={() => setConfirmSend(true)} disabled={entries.length === 0}>
            <Send className="h-4 w-4 ml-1" /> ارسال برای مسئول خرید
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">هیچ کالایی اضافه نشده</p>
        ) : (
          <ul className="divide-y">
            {entries.map(e => (
              <li key={e.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{e.item_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {e.quantity} {e.unit}
                    </span>
                    {e.urgency === "urgent" && (
                      <span className="inline-flex items-center gap-1 text-xs bg-warning/20 text-warning-foreground px-2 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" /> فوری
                      </span>
                    )}
                    {e.is_custom && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">دلخواه</span>
                    )}
                  </div>
                  {e.note && <p className="text-sm text-muted-foreground mt-1">{e.note}</p>}
                </div>
                <div className="flex gap-1 items-center">
                  <Button size="icon" variant="ghost" onClick={() => openEditDialog(e)}>
                    <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeEntry.mutate(e.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-right">ویرایش اقلام سفارش</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-right" dir="rtl">
            <div className="space-y-2">
              <Label>مقدار ({editingEntry?.unit})</Label>
              <Input
                type="number"
                step="any"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>یادداشت تدارکات</Label>
              <Textarea
                rows={2}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="یادداشتی ثبت کنید..."
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="edit-urgent"
                checked={editUrgency === "urgent"}
                onChange={(e) => setEditUrgency(e.target.checked ? "urgent" : "normal")}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <Label htmlFor="edit-urgent" className="cursor-pointer text-sm font-medium">
                این مورد بسیار فوری است
              </Label>
            </div>
          </div>
          <DialogFooter className="flex justify-between gap-2" dir="rtl">
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              انصراف
            </Button>
            <Button
              onClick={() => {
                const q = parseFloat(editQuantity);
                if (!q || q <= 0) {
                  return;
                }
                updateEntry.mutate({
                  id: editingEntry.id,
                  quantity: q,
                  note: editNote || null,
                  urgency: editUrgency,
                });
                setEditingEntry(null);
              }}
              disabled={updateEntry.isPending}
            >
              ثبت تغییرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSend} onOpenChange={setConfirmSend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ارسال لیست به مسئول خرید</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {entries.length} کالا ارسال می‌شود و لیست فعلی این بخش پاک خواهد شد.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSend(false)}>لغو</Button>
            <Button onClick={() => sendBatch.mutate()} disabled={sendBatch.isPending}>تأیید و ارسال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
