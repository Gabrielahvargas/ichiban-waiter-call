import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/modules/shared/rpc";
import type { Shift, Waiter, WaiterAssignment } from "@/modules/shared/types";

/** Local service date in YYYY-MM-DD, used as the default for the daily board. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultShift(): Shift {
  return new Date().getHours() < 16 ? "lunch" : "dinner";
}

export function useWaiters() {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("waiters").select("*").order("full_name");
    setWaiters((data ?? []) as unknown as Waiter[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { waiters, loading, reload };
}

export async function createWaiter(fullName: string, code: string | null) {
  const { error } = await supabase.from("waiters").insert({ full_name: fullName, code } as never);
  if (error) throw new Error(error.message);
}

export async function setWaiterActive(id: string, active: boolean) {
  const { error } = await supabase.from("waiters").update({ active } as never).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function renameWaiter(id: string, fullName: string) {
  const { error } = await supabase.from("waiters").update({ full_name: fullName } as never).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteWaiter(id: string) {
  const { error } = await supabase.from("waiters").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Active assignments (effective_to is null) for one service date and shift. */
export function useAssignments(serviceDate: string, shift: Shift) {
  const [assignments, setAssignments] = useState<WaiterAssignment[]>([]);
  const [history, setHistory] = useState<WaiterAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("waiter_assignments")
      .select("*")
      .eq("service_date", serviceDate)
      .eq("shift", shift)
      .order("effective_from", { ascending: false });
    const rows = (data ?? []) as unknown as WaiterAssignment[];
    setAssignments(rows.filter((r) => r.effective_to === null));
    setHistory(rows);
    setLoading(false);
  }, [serviceDate, shift]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    const channel = supabase
      .channel(`assignments-${serviceDate}-${shift}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_assignments" }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload, serviceDate, shift]);

  return { assignments, history, loading, reload };
}

/**
 * Assigns (or clears, with waiterId = null) one table for a date and shift.
 * The database closes any conflicting assignment and keeps the old row as
 * history, so calls stay credited to the waiter on duty when they happened.
 */
export async function assignTable(params: {
  tableNumber: number;
  serviceDate: string;
  shift: Shift;
  waiterId: string | null;
}) {
  await callRpc("admin_set_table_assignment", {
    p_table_number: params.tableNumber,
    p_service_date: params.serviceDate,
    p_shift: params.shift,
    p_waiter_id: params.waiterId,
  });
}
