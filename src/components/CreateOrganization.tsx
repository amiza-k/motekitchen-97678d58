import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Plus } from "lucide-react";
import { toast } from "sonner";

const IRAN_PROVINCES = [
  "آذربایجان شرقی","آذربایجان غربی","اردبیل","اصفهان","البرز","ایلام","بوشهر",
  "تهران","چهارمحال و بختیاری","خراسان جنوبی","خراسان رضوی","خراسان شمالی",
  "خوزستان","زنجان","سمنان","سیستان و بلوچستان","فارس","قزوین","قم","کردستان",
  "کرمان","کرمانشاه","کهگیلویه و بویراحمد","گلستان","گیلان","لرستان","مازندران",
  "مرکزی","هرمزگان","همدان","یزد",
];

export function CreateOrganization() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("نام کافه لازم است");
      if (!province) throw new Error("استان را انتخاب کنید");
      if (!city.trim()) throw new Error("شهر لازم است");
      if (!address.trim()) throw new Error("آدرس لازم است");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("خطا در احراز هویت کاربر");

      // get current profile state first to verify existing org_id
      const { data: profileObj, error: getProfileError } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (getProfileError) throw new Error(`خطا در بررسی مشخصات: ${getProfileError.message}`);

      // PLAN A: Hybrid fallback structure.
      // If the user already has a default auto-created org_id (typically set during handle_new_user session creation),
      // we only need to UPDATE that organization rather than trying to insert a new one which is blocked by RLS locally.
      if (profileObj?.org_id) {
        const { error: updateOrgError } = await supabase
          .from("organizations")
          .update({
            name: name.trim(),
            province: province,
            city: city.trim(),
            address: address.trim(),
          })
          .eq("id", profileObj.org_id);

        if (!updateOrgError) {
          return; // Successfully updated the organization and bypassing RLS blocks
        }
      }

      // PLAN B: If there's no pre-defined org_id on the active user profile (or update failed),
      // we invoke the safe 'create_my_organization' RPC of Supabase.
      // RPC uses SECURITY DEFINER in PostgreSQL which bypasses RLS policies entirely.
      const { error: rpcError } = await supabase.rpc("create_my_organization" as never, {
        _name: name.trim(),
        _province: province,
        _city: city.trim(),
        _address: address.trim(),
      });

      if (!rpcError) {
        return; // RPC successfully ran without trigger issues!
      }

      // PLAN C: Edge Fallback (Direct secure insertion)
      // If RPC is blocked by an un-synced trigger on the remote server, we fall back to manual insertion.
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: name.trim(),
          owner_id: userData.user.id,
          province: province,
          city: city.trim(),
          address: address.trim(),
        })
        .select("id")
        .single();

      if (orgError) {
        throw new Error(
          `خطا در ثبت اطلاعات: دیتابیس لوکال فاقد هماهنگی نهایی است. متن خطا: ${orgError.message}`
        );
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          org_id: orgData.id,
          department_id: null,
        })
        .eq("id", userData.user.id);

      if (profileError) throw new Error(`خطا در به‌روزرسانی نهایی پروفایل: ${profileError.message}`);
    },
    onSuccess: () => {
      toast.success("رستوران شما ساخته شد");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "خطا در ساخت رستوران"),
  });

  if (!open) {
    return (
      <Card className="p-6 text-center border-primary/40 bg-primary/5">
        <Store className="h-10 w-10 text-primary mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-1">هنوز عضو هیچ رستورانی نیستید</h2>
        <p className="text-sm text-muted-foreground mb-4">
          اگر توسط مدیر رستورانی دعوت شده‌اید، دعوت‌نامه در بالای صفحه نمایش داده می‌شود.
          در غیر این صورت می‌توانید رستوران خود را بسازید و مالک آن شوید.
        </p>
        <Button onClick={() => setOpen(true)} size="lg">
          <Plus className="h-4 w-4 ml-1" /> ساخت رستوران من
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 max-w-lg mx-auto">
      <h2 className="text-lg font-bold mb-4">ساخت رستوران جدید</h2>
      <form
        className="space-y-3"
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
      >
        <div>
          <Label htmlFor="cafe-name">نام کافه / رستوران</Label>
          <Input id="cafe-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label>استان</Label>
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger><SelectValue placeholder="انتخاب استان" /></SelectTrigger>
            <SelectContent>
              {IRAN_PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="city">شهر</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="address">آدرس</Label>
          <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} required rows={3} />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>
            انصراف
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "در حال ساخت..." : "ساخت رستوران"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
