import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

type SlotType = "both" | "pickup" | "delivery";

interface TimeSlot {
  id: string;
  label: string;
  start_hour: number;
  end_hour: number;
  slot_type: SlotType;
  is_active: boolean;
  sort_order: number;
  max_orders: number | null;
}

const TYPE_LABELS: Record<SlotType, string> = {
  both: "Nouto & palautus",
  pickup: "Vain nouto",
  delivery: "Vain palautus",
};

const emptyForm = {
  label: "",
  start_hour: "8",
  end_hour: "10",
  slot_type: "both" as SlotType,
  sort_order: "1",
  max_orders: "",
};

export const TimeSlotManagement = () => {
  const { toast } = useToast();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchSlots = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("time_slots")
      .select("id, label, start_hour, end_hour, slot_type, is_active, sort_order, max_orders")
      .order("sort_order", { ascending: true });

    if (error) {
      toast({ title: "Virhe", description: "Aikaikkunoiden lataus epäonnistui.", variant: "destructive" });
    } else {
      setSlots((data || []) as TimeSlot[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const openCreate = () => {
    const nextOrder = slots.length ? Math.max(...slots.map((s) => s.sort_order)) + 1 : 1;
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: String(nextOrder) });
    setDialogOpen(true);
  };

  const openEdit = (slot: TimeSlot) => {
    setEditingId(slot.id);
    setForm({
      label: slot.label,
      start_hour: String(slot.start_hour),
      end_hour: String(slot.end_hour),
      slot_type: slot.slot_type,
      sort_order: String(slot.sort_order),
      max_orders: slot.max_orders != null ? String(slot.max_orders) : "",
    });
    setDialogOpen(true);
  };

  const pad = (n: number) => `${n}`.padStart(2, "0");

  const handleSave = async () => {
    const startHour = parseInt(form.start_hour, 10);
    const endHour = parseInt(form.end_hour, 10);

    if (Number.isNaN(startHour) || Number.isNaN(endHour) || startHour < 0 || endHour > 24 || endHour <= startHour) {
      toast({ title: "Tarkista tunnit", description: "Lopputunnin on oltava alkutuntia suurempi (0–24).", variant: "destructive" });
      return;
    }

    const payload = {
      label: form.label.trim() || `${pad(startHour)}:00 - ${pad(endHour)}:00`,
      start_hour: startHour,
      end_hour: endHour,
      slot_type: form.slot_type,
      sort_order: parseInt(form.sort_order, 10) || 1,
      max_orders: form.max_orders.trim() === "" ? null : parseInt(form.max_orders, 10),
    };

    setSaving(true);
    const { error } = editingId
      ? await supabase.from("time_slots").update(payload).eq("id", editingId)
      : await supabase.from("time_slots").insert(payload);
    setSaving(false);

    if (error) {
      toast({ title: "Virhe", description: "Aikaikkunan tallennus epäonnistui.", variant: "destructive" });
      return;
    }

    toast({ title: editingId ? "Aikaikkuna päivitetty" : "Aikaikkuna lisätty" });
    setDialogOpen(false);
    fetchSlots();
  };

  const toggleActive = async (slot: TimeSlot) => {
    setBusyId(slot.id);
    const { error } = await supabase.from("time_slots").update({ is_active: !slot.is_active }).eq("id", slot.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Virhe", description: "Tilan päivitys epäonnistui.", variant: "destructive" });
      return;
    }
    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, is_active: !s.is_active } : s)));
  };

  const handleDelete = async (slot: TimeSlot) => {
    setBusyId(slot.id);
    const { error } = await supabase.from("time_slots").delete().eq("id", slot.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Virhe", description: "Aikaikkunan poisto epäonnistui.", variant: "destructive" });
      return;
    }
    toast({ title: "Aikaikkuna poistettu" });
    setSlots((prev) => prev.filter((s) => s.id !== slot.id));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Toimitus- ja noutoajat
            </CardTitle>
            <CardDescription>Hallitse asiakkaille näkyviä nouto- ja palautusaikaikkunoita.</CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Lisää uusi aikaikkuna
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Ei aikaikkunoita. Lisää ensimmäinen.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Järj.</TableHead>
                    <TableHead>Aikaväli</TableHead>
                    <TableHead>Tyyppi</TableHead>
                    <TableHead>Maks. tilaukset</TableHead>
                    <TableHead>Tila</TableHead>
                    <TableHead className="text-right">Toiminnot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="text-muted-foreground">{slot.sort_order}</TableCell>
                      <TableCell className="font-medium">{slot.label}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{TYPE_LABELS[slot.slot_type] ?? slot.slot_type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{slot.max_orders ?? "Ei rajaa"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={slot.is_active}
                            disabled={busyId === slot.id}
                            onCheckedChange={() => toggleActive(slot)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {slot.is_active ? "Käytössä" : "Suljettu"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(slot)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === slot.id}
                            onClick={() => handleDelete(slot)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Muokkaa aikaikkunaa" : "Lisää uusi aikaikkuna"}</DialogTitle>
            <DialogDescription>Määritä aikaväli, tyyppi ja järjestys.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Aikaväli (näkyvä nimi)</Label>
              <Input
                value={form.label}
                placeholder="esim. 08:00 - 10:00"
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Alkutunti</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={form.start_hour}
                  onChange={(e) => setForm({ ...form, start_hour: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Lopputunti</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={form.end_hour}
                  onChange={(e) => setForm({ ...form, end_hour: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tyyppi</Label>
              <Select
                value={form.slot_type}
                onValueChange={(v) => setForm({ ...form, slot_type: v as SlotType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Nouto & palautus</SelectItem>
                  <SelectItem value="pickup">Vain nouto</SelectItem>
                  <SelectItem value="delivery">Vain palautus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Järjestys</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Maks. tilaukset (valinnainen)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ei rajaa"
                  value={form.max_orders}
                  onChange={(e) => setForm({ ...form, max_orders: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Peruuta
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Tallennetaan..." : "Tallenna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
