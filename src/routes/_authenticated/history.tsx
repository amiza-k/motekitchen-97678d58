import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

type Dept = { id: string; name: string };
type Task = {
  id: string; department_id: string; item_name: string; unit: string;
  requested_quantity: number; purchased_quantity: number | null;
  status: string; order_date: string; purchased_date: string | null;
  rejection_note: string | null; is_custom: boolean;
};

function HistoryPage() {
  const { data: depts = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async (): Promise<Dept[]> => {
      const { data } = await supabase.from("departments").select("id,name").order("name");
      return (data ?? []) as Dept[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["history-tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from("tasks")
        .select("*").in("status", ["purchased", "rejected"])
        .order("purchased_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const [activeDept, setActiveDept] = useState<string>("");
  const currentDept = activeDept || depts[0]?.id || "";
  const [statusFilter, setStatusFilter] = useState<"all" | "purchased" | "rejected">("all");
  const [sortBy, setSortBy] = useState<"purchased_date" | "order_date">("purchased_date");

  const filtered = useMemo(() => {
    const list = tasks.filter(t => t.department_id === currentDept);
    const filt = statusFilter === "all" ? list : list.filter(t => t.status === statusFilter);
    return [...filt].sort((a, b) => {
      const av = a[sortBy] || ""; const bv = b[sortBy] || "";
      return String(bv).localeCompare(String(av));
    });
  }, [tasks, currentDept, statusFilter, sortBy]);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تاریخچه</h1>
        <p className="text-sm text-muted-foreground mt-1">درخواست‌های خریداری‌شده یا ردشده</p>
      </div>

      {depts.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">بخشی وجود ندارد</Card>
      ) : (
        <Tabs value={currentDept} onValueChange={setActiveDept}>
          <TabsList className="flex flex-wrap h-auto">
            {depts.map(d => <TabsTrigger key={d.id} value={d.id}>{d.name}</TabsTrigger>)}
          </TabsList>
          {depts.map(d => (
            <TabsContent key={d.id} value={d.id} className="mt-4 space-y-4">
              <div className="flex gap-3 flex-wrap">
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه</SelectItem>
                    <SelectItem value="purchased">خریداری‌شده</SelectItem>
                    <SelectItem value="rejected">ردشده</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchased_date">مرتب بر اساس تاریخ خرید</SelectItem>
                    <SelectItem value="order_date">مرتب بر اساس تاریخ ثبت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Card className="p-0 overflow-x-auto">
                {filtered.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">موردی نیست</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-right">
                      <tr>
                        <th className="p-3">کالا</th>
                        <th className="p-3">درخواست</th>
                        <th className="p-3">خریداری‌شده</th>
                        <th className="p-3">وضعیت</th>
                        <th className="p-3">تاریخ ثبت</th>
                        <th className="p-3">تاریخ اقدام</th>
                        <th className="p-3">توضیح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(t => {
                        const diff = t.purchased_quantity != null && t.purchased_quantity !== t.requested_quantity;
                        return (
                          <tr key={t.id} className="border-t">
                            <td className="p-3">
                              {t.item_name}
                              {t.is_custom && <span className="mr-2 text-xs bg-muted px-1.5 py-0.5 rounded">دلخواه</span>}
                            </td>
                            <td className="p-3" dir="ltr">{t.requested_quantity} {t.unit}</td>
                            <td className="p-3" dir="ltr">
                              {t.purchased_quantity != null ? (
                                <span className={diff ? "text-warning-foreground font-medium" : ""}>
                                  {t.purchased_quantity} {t.unit}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="p-3">
                              {t.status === "purchased" ? (
                                <span className="text-primary">خریداری‌شده</span>
                              ) : (
                                <span className="text-destructive">ردشده</span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">{fmt(t.order_date)}</td>
                            <td className="p-3 whitespace-nowrap">{fmt(t.purchased_date)}</td>
                            <td className="p-3 text-muted-foreground">{t.rejection_note || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
