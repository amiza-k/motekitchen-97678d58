import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Check, X } from "lucide-react";
import { toast } from "sonner";

type InviteForMe = {
  id: string;
  is_purchaser: boolean;
  invited_by_name: string | null;
  organizations: { name: string } | null;
  departments: { name: string } | null;
};

export function MyInvitations() {
  const qc = useQueryClient();

  const { data: invites = [] } = useQuery({
    queryKey: ["my-invitations"],
    queryFn: async (): Promise<InviteForMe[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.email) return [];
      const { data, error } = await supabase
        .from("invitations")
        .select("id, is_purchaser, invited_by_name, organizations(name), departments(name)")
        .ilike("email", u.user.email);
      if (error) return [];
      return (data ?? []) as unknown as InviteForMe[];
    },
  });

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("accept_invitation" as never, { _invitation_id: id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("دعوت پذیرفته شد");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "خطا در پذیرش"),
  });

  const decline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("دعوت رد شد");
      qc.invalidateQueries({ queryKey: ["my-invitations"] });
    },
    onError: (e: any) => toast.error(e.message ?? "خطا در رد دعوت"),
  });

  if (invites.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {invites.map((inv) => (
        <Card key={inv.id} className="p-4 border-primary/40 bg-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0 text-sm">
              <div>
                <span className="font-semibold">{inv.invited_by_name ?? "مالک رستوران"}</span>
                {" شما را به "}
                <span className="font-semibold">{inv.organizations?.name ?? "رستوران"}</span>
                {inv.departments?.name && (
                  <> در بخش <span className="font-semibold">{inv.departments.name}</span></>
                )}
                {inv.is_purchaser && " به عنوان مسئول خرید"}
                {" دعوت کرده است."}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                با پذیرش، به این رستوران منتقل می‌شوید. اگر رستوران فعلی شما بدون عضو دیگری باشد، حذف خواهد شد.
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => accept.mutate(inv.id)} disabled={accept.isPending || decline.isPending}>
                <Check className="h-4 w-4 ml-1" /> پذیرش دعوت
              </Button>
              <Button size="sm" variant="outline" onClick={() => decline.mutate(inv.id)} disabled={accept.isPending || decline.isPending}>
                <X className="h-4 w-4 ml-1" /> رد کردن دعوت
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
