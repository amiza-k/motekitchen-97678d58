import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Profile = { id: string; org_id: string; department_id: string | null; departments: { id: string; name: string } | null };
type Entry = {
  id: string; item_name: string; unit: string; quantity: number; urgency: string;
  note: string | null; is_custom: boolean; created_at: string; added_by: string;
  catalog_item_id: string | null;
};
type CatalogItem = { id: string; name: string; unit: string };

function DashboardPage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles")
        .select("id, org_id, department_id, departments(id,name)")
        .eq("id", u.user.id).maybeSingle();
      return data as Profile | null;
    },
  });

  const deptId = profile?.department_id;

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", deptId],
    enabled: !!deptId,
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase.from("shopping_list_entries")
        .select("*").eq("department_id", deptId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog", deptId],
    enabled: !!deptId,
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase.from("catalog_items")
        .select("id,name,unit").eq("department_id", deptId!).order("name");
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
      if (!profile || !deptId) throw new Error("بخش تعیین نشده");
      const q = parseFloat(quantity);
      if (!q || q <= 0) throw new Error("مقدار نامعتبر");
      const { data: u } = await supabase.auth.getUser();
      if (mode === "catalog") {
        const item = catalog.find(c => c.id === catalogId);
        if (!item) throw new Error("کالای کاتالوگ را انتخاب کنید");
        const { error } = await supabase.from("shopping_list_entries").insert({
          org_id: profile.org_id, department_id: deptId, catalog_item_id: item.id,
          item_name: item.name, unit: item.unit, quantity: q, urgency,
          note: note || null, is_custom: false, added_by: u.user!.id,
        });
        if (error) throw error;
      } else {
        if (!customName.trim() || !unit.trim()) throw new Error("نام و واحد را وارد کنید");
        const { error } = await supabase.from("shopping_list_entries").insert({
          org_id: profile.org_id, department_id: deptId, catalog_item_id: null,
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
  const sendBatch = useMutation({
    mutationFn: async () => {
      if (!profile || !deptId || entries.length === 0) return;
      const { data: u } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const rows = entries.map(e => ({
        org_id: profile.org_id,
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

  if (!profile) return null;
  if (!deptId) {
    return (
      <Card className="p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">هنوز به بخشی اختصاص داده نشده‌اید</h2>
        <p className="text-sm text-muted-foreground">
          از مدیر رستوران بخواهید شما را به یک بخش اضافه کند.
        </p>
      </Card>
    );
  }

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
          <Button
            onClick={() => setConfirmSend(true)}
            disabled={entries.length === 0}
          >
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
                <Button size="icon" variant="ghost" onClick={() => removeEntry.mutate(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

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
