import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, LayoutGrid, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

interface Category {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  productCount: number;
  activeProductCount: number;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const emptyForm = { name: "", category_id: "", description: "", sort_order: "1" };

export const CategoryManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    const [{ data: cats, error }, { data: prods }] = await Promise.all([
      supabase.from("categories").select("id, category_id, name, description, sort_order").order("sort_order"),
      supabase.from("products").select("category_id, is_active"),
    ]);

    if (error) {
      toast({ title: "Virhe", description: "Kategorioiden lataus epäonnistui.", variant: "destructive" });
      setLoading(false);
      return;
    }

    setCategories(
      (cats || []).map((c) => ({
        ...c,
        productCount: (prods || []).filter((p) => p.category_id === c.category_id).length,
        activeProductCount: (prods || []).filter((p) => p.category_id === c.category_id && p.is_active).length,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    const nextOrder = categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 1;
    setEditing(null);
    setSlugEdited(false);
    setForm({ ...emptyForm, sort_order: String(nextOrder) });
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setSlugEdited(true);
    setForm({
      name: cat.name,
      category_id: cat.category_id,
      description: cat.description ?? "",
      sort_order: String(cat.sort_order),
    });
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      category_id: slugEdited ? prev.category_id : slugify(name),
    }));
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const categoryId = slugify(form.category_id || form.name);

    if (!name || !categoryId) {
      toast({ title: "Tarkista tiedot", description: "Nimi ja kategoriatunniste ovat pakollisia.", variant: "destructive" });
      return;
    }

    const payload = {
      name,
      category_id: categoryId,
      description: form.description.trim() || null,
      sort_order: parseInt(form.sort_order, 10) || 1,
    };

    setSaving(true);
    const { error } = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);

    if (error) {
      toast({
        title: "Virhe",
        description: error.message.includes("duplicate")
          ? "Kategoriatunniste on jo käytössä."
          : "Kategorian tallennus epäonnistui.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: editing ? "Kategoria päivitetty" : "Kategoria lisätty", description: name });
    setDialogOpen(false);
    fetchCategories();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = categories[index + direction];
    const current = categories[index];
    if (!target || !current) return;

    setBusyId(current.id);
    const [a, b] = [
      supabase.from("categories").update({ sort_order: target.sort_order }).eq("id", current.id),
      supabase.from("categories").update({ sort_order: current.sort_order }).eq("id", target.id),
    ];
    const results = await Promise.all([a, b]);
    setBusyId(null);

    if (results.some((r) => r.error)) {
      toast({ title: "Virhe", description: "Järjestyksen päivitys epäonnistui.", variant: "destructive" });
      return;
    }
    toast({ title: "Järjestys päivitetty" });
    fetchCategories();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id);
    setBusyId(null);
    setDeleteTarget(null);

    if (error) {
      toast({
        title: "Virhe",
        description: "Kategorian poisto epäonnistui. Siirrä tuotteet ensin toiseen kategoriaan.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Kategoria poistettu", description: deleteTarget.name });
    fetchCategories();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              Kategoriat
            </CardTitle>
            <CardDescription>Hallitse tuotekategorioita ja niiden järjestystä sovelluksessa.</CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Lisää uusi kategoria
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Ei kategorioita. Lisää ensimmäinen.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Järj.</TableHead>
                    <TableHead>Nimi</TableHead>
                    <TableHead>Tunniste</TableHead>
                    <TableHead>Tuotteet</TableHead>
                    <TableHead className="text-right">Toiminnot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat, index) => (
                    <TableRow key={cat.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-sm w-4">{cat.sort_order}</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              disabled={index === 0 || busyId === cat.id}
                              onClick={() => move(index, -1)}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              disabled={index === categories.length - 1 || busyId === cat.id}
                              onClick={() => move(index, 1)}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {cat.name}
                        {cat.description && (
                          <p className="text-xs text-muted-foreground font-normal">{cat.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{cat.category_id}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cat.activeProductCount > 0 ? "secondary" : "outline"}>
                          {cat.productCount} kpl
                        </Badge>
                        {cat.activeProductCount !== cat.productCount && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {cat.activeProductCount} aktiivista
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === cat.id}
                            onClick={() => setDeleteTarget(cat)}
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
            <DialogTitle>{editing ? "Muokkaa kategoriaa" : "Lisää uusi kategoria"}</DialogTitle>
            <DialogDescription>Nimi, tunniste ja järjestysnumero etusivulla.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nimi</Label>
              <Input
                value={form.name}
                placeholder="esim. Matot & Tekstiilit"
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kategoriatunniste (slug)</Label>
              <Input
                value={form.category_id}
                placeholder="matot-tekstiilit"
                onChange={(e) => {
                  setSlugEdited(true);
                  setForm({ ...form, category_id: e.target.value });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Tunniste yhdistää tuotteet kategoriaan – muuta vain jos tarpeen.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Kuvaus (valinnainen)</Label>
              <Textarea
                value={form.description}
                rows={2}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Järjestysnumero</Label>
              <Input
                type="number"
                min={1}
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista kategoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.productCount > 0
                ? `Kategoriassa "${deleteTarget.name}" on ${deleteTarget.productCount} tuotetta (${deleteTarget.activeProductCount} aktiivista). Siirrä tuotteet ensin toiseen kategoriaan – muuten poisto estyy.`
                : `Kategoria "${deleteTarget?.name}" poistetaan pysyvästi.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Poista</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
