import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchaser")({
  component: PurchaserPage,
});

type Dept = { id: string; name: string };
type Task = {
  id: string; department_id: string; item_name: string; unit: string;
  requested_quantity: number; is_custom: boolean; urgency: string; note: string | null;
  order_date: string; status: string;
};

function PurchaserPage() {
  const qc = useQueryClient();
  const { data: depts = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async (): Promise<Dept[]> => {
      const { data, error } = await supabase.from("departments").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Dept[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["pending-tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from("tasks")
        .select("*").eq("status", "pending").order("order_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const [activeDept, setActiveDept] = useState<string>("");
  const currentDept = activeDept || depts[0]?.id || "";

  const grouped = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of tasks) (m[t.department_id] ||= []).push(t);
    return m;
  }, [tasks]);

  const [purchaseTask, setPurchaseTask] = useState<Task | null>(null);
  const [purchaseQty, setPurchaseQty] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [rejectTask, setRejectTask] = useState<Task | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const markPurchased = useMutation({
    mutationFn: async () => {
      if (!purchaseTask) return;
      const q = parseFloat(purchaseQty);
      if (!q || q <= 0) throw new Error("مقدار نامعتبر");
      const { error } = await supabase.from("tasks").update({
        status: "purchased", purchased_quantity: q, purchased_date: new Date().toISOString(), rejection_note: purchaseNote || null,
      }).eq("id", purchaseTask.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-tasks"] });
      qc.invalidateQueries({ queryKey: ["history-tasks"] });
      setPurchaseTask(null); setPurchaseQty(""); setPurchaseNote("");
      toast.success("ثبت شد");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markRejected = useMutation({
    mutationFn: async () => {
      if (!rejectTask) return;
      const { error } = await supabase.from("tasks").update({
        status: "rejected", rejection_note: rejectNote || null,
        purchased_date: new Date().toISOString(),
      }).eq("id", rejectTask.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-tasks"] });
      qc.invalidateQueries({ queryKey: ["history-tasks"] });
      setRejectTask(null); setRejectNote("");
      toast.success("رد شد");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">میز مسئول خرید</h1>
        <p className="text-sm text-muted-foreground mt-1">درخواست‌های در انتظار خرید هر بخش</p>
      </div>

      {depts.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">هنوز بخشی تعریف نشده است</Card>
      ) : (
        <Tabs value={currentDept} onValueChange={setActiveDept}>
          <TabsList className="flex flex-wrap h-auto">
            {depts.map(d => {
              const list = grouped[d.id] || [];
              const urgent = list.filter(t => t.urgency === "urgent").length;
              return (
                <TabsTrigger key={d.id} value={d.id} className="gap-2">
                  {d.name}
                  <span className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">{list.length}</span>
                  {urgent > 0 && (
                    <span className="bg-warning/20 text-warning-foreground text-xs rounded-full px-2 py-0.5">
                      {urgent} فوری
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {depts.map(d => {
            const list = grouped[d.id] || [];
            
            // 1. Calculate how many times each item name appears as "pending" under this department
            const itemCounts = {};
            for (const t of list) {
              const nameKey = t.item_name.trim().toLowerCase();
              itemCounts[nameKey] = (itemCounts[nameKey] || 0) + 1;
            }

            // 2. Group pending requests by exact order_date
            const batchesMap = {};
            for (const t of list) {
              batchesMap[t.order_date] = batchesMap[t.order_date] || [];
              batchesMap[t.order_date].push(t);
            }

            // 3. Sort batches descending by order_date (NEWEST on TOP)
            const sortedDates = Object.keys(batchesMap).sort(
              (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );

            return (
              <TabsContent key={d.id} value={d.id} className="mt-4">
                {list.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground text-sm">درخواست فعالی نیست</Card>
                ) : (
                  <div className="space-y-6">
                    {sortedDates.map(dateStr => {
                      const batchTasks = batchesMap[dateStr];
                      return (
                        <Card key={dateStr} className="p-0 overflow-hidden border border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow duration-150">
                          {/* Batch Title Header */}
                          <div className="bg-muted/40 px-4 py-3 border-b flex justify-between items-center flex-wrap gap-2 text-right" dir="rtl">
                            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-row-reverse justify-end">
                              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                              ارسال‌شده در {fmtDate(dateStr)}
                            </div>
                            <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                              {batchTasks.length} کالا
                            </span>
                          </div>
                          
                          {/* Tasks list */}
                          <ul className="divide-y text-right" dir="rtl">
                            {batchTasks.map(t => {
                              const repeats = itemCounts[t.item_name.trim().toLowerCase()] || 0;
                              return (
                                <li key={t.id} className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center hover:bg-muted/5">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <span className="font-semibold text-foreground text-base">{t.item_name}</span>
                                      
                                      {/* Highlighted quantities with high contrast */}
                                      <span className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 rounded border border-indigo-200/50 select-all shadow-sm">
                                        {t.requested_quantity} {t.unit}
                                      </span>

                                      {/* Repeated indicators inside departmental views */}
                                      {repeats > 1 && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                                          تکرار {repeats} بار
                                        </span>
                                      )}

                                      {t.urgency === "urgent" && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-warning/20 text-warning-foreground px-2 py-0.5 rounded font-medium">
                                          <AlertTriangle className="h-3 w-3" /> فوری
                                        </span>
                                      )}
                                      {t.is_custom && <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">دلخواه</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 flex-wrap">
                                      {t.note && <span>یادداشت سفارش‌دهنده: {t.note}</span>}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => { setPurchaseTask(t); setPurchaseQty(String(t.requested_quantity)); }}>
                                      <Check className="h-4 w-4 ml-1" /> خریداری شد
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setRejectTask(t)}>
                                      <X className="h-4 w-4 ml-1" /> رد کن
                                    </Button>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <Dialog open={!!purchaseTask} onOpenChange={(o) => !o && setPurchaseTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت خرید — {purchaseTask?.item_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              درخواست: {purchaseTask?.requested_quantity} {purchaseTask?.unit}
            </p>
            <div className="space-y-2">
              <Label>مقدار واقعی خریداری‌شده</Label>
              <Input type="number" min="0" step="0.1" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>توضیحات خرید (اختیاری)</Label>
              <Textarea rows={2} value={purchaseNote} onChange={e => setPurchaseNote(e.target.value)} placeholder="مثلاً: علت مغایرت مقدار یا نام فروشگاه..." className="text-right" dir="rtl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseTask(null)}>لغو</Button>
            <Button onClick={() => markPurchased.mutate()} disabled={markPurchased.isPending}>ثبت</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTask} onOpenChange={(o) => !o && setRejectTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رد درخواست — {rejectTask?.item_name}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>توضیح (اختیاری)</Label>
            <Textarea rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTask(null)}>لغو</Button>
            <Button variant="destructive" onClick={() => markRejected.mutate()} disabled={markRejected.isPending}>رد کن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
