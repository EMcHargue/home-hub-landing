import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  ShoppingCart,
  PackagePlus,
  Trash2,
  UtensilsCrossed,
  ChevronLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getWeekDates(offset: number): Date[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

const Shopping = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const [userId, setUserId] = useState<string | null>(() => {
    const s = localStorage.getItem("home_hub_user_id");
    return s && UUID_RE.test(s) ? s : null;
  });

  const [newShoppingName, setNewShoppingName] = useState("");
  const [newShoppingCategoryId, setNewShoppingCategoryId] = useState<number | null>(null);
  const [editingShoppingId, setEditingShoppingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = fmt(weekDates[0]);
  const weekEnd = fmt(weekDates[6]);
  const weekLabel = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekDates[0].toLocaleDateString(undefined, opts)} – ${weekDates[6].toLocaleDateString(undefined, opts)}`;
  }, [weekDates]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: apiShopping = [] } = useQuery({
    queryKey: ["shopping"],
    queryFn: () => api.getShopping(),
  });

  const { data: apiCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(),
  });

  const { data: apiItems = [] } = useQuery({
    queryKey: ["pantry"],
    queryFn: () => api.getPantry(),
  });

  const { data: plannedMeals = [] } = useQuery({
    queryKey: ["planned-meals", weekStart, weekEnd],
    queryFn: () => api.getPlannedMeals(weekStart, weekEnd),
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.getRecipes(),
  });

  const { data: shoppingListLinks = [] } = useQuery({
    queryKey: ["shopping-list-links", weekStart],
    queryFn: () => api.getShoppingListLinks(weekStart),
  });

  // ── Derived ──────────────────────────────────────────────────────────────────

  const shoppingList = useMemo(
    () => apiShopping.map((s) => ({
      id: s.id,
      name: s.item_name,
      pantryItemId: s.pantry_item_id,
      categoryId: s.category_id,
      groupId: s.group_id,
      requestedQuantity: s.requested_quantity,
      unit: s.unit,
    })),
    [apiShopping]
  );

  const linkedIngredients = useMemo(
    () => new Map<string, number>(shoppingListLinks.map((l) => [l.ingredient_name, l.pantry_item_id])),
    [shoppingListLinks]
  );

  const linkIdByIngredient = useMemo(
    () => new Map<string, number>(shoppingListLinks.map((l) => [l.ingredient_name, l.id])),
    [shoppingListLinks]
  );

  const getMealLabel = (meal: { custom_name: string | null; recipe_id: number | null }) => {
    if (meal.custom_name) return meal.custom_name;
    return recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Unknown";
  };

  const mealShoppingList = useMemo(() => {
    const ingredientMap = new Map<string, Set<string>>();
    for (const meal of plannedMeals) {
      const mealName = getMealLabel(meal);
      const recipe = recipes.find((r) => r.id === meal.recipe_id);
      const ings: string[] = [];
      if (recipe) ings.push(...recipe.ingredients);
      if (meal.ingredients?.length) ings.push(...meal.ingredients);
      for (const ing of ings) {
        const key = ing.toLowerCase();
        if (!ingredientMap.has(key)) ingredientMap.set(key, new Set());
        ingredientMap.get(key)!.add(mealName);
      }
    }
    return Array.from(ingredientMap.entries())
      .map(([name, meals]) => ({ name, meals: Array.from(meals) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plannedMeals, recipes]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const addShopping = useMutation({
    mutationFn: ({ name, pantryItemId, requestedQuantity, unit, categoryId, groupId }: {
      name: string; pantryItemId?: number; requestedQuantity?: number;
      unit?: string; categoryId?: number | null; groupId?: number | null;
    }) => api.addShoppingItem(userId!, name, pantryItemId, requestedQuantity, unit, categoryId, groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
    onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
  });

  const deleteShopping = useMutation({
    mutationFn: (id: number) => api.deleteShoppingItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
    onError: () => toast({ title: "Failed to remove item", variant: "destructive" }),
  });

  const updateShopping = useMutation({
    mutationFn: ({ id, requestedQuantity, unit }: { id: number; requestedQuantity: number | null; unit: string | null }) =>
      api.updateShoppingItem(id, requestedQuantity, unit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });

  const processToInventory = useMutation({
    mutationFn: async (s: { id: number; name: string; pantryItemId: number | null; categoryId: number | null; groupId: number | null; requestedQuantity: number | null; unit: string | null }) => {
      const qty = s.requestedQuantity ?? 1;
      const unit = s.unit ?? "units";
      const byId = s.pantryItemId != null ? apiItems.find((i) => i.id === s.pantryItemId) : null;
      const byName = apiItems.find((i) => i.name.toLowerCase() === s.name.toLowerCase());
      const existing = byId ?? byName;
      if (existing) {
        await api.updatePantryItem(existing.id, { quantity: existing.quantity + qty });
      } else {
        await api.createPantryItem(userId!, {
          name: s.name, brand: null, category_id: s.categoryId, group_id: s.groupId,
          quantity: qty, unit, min_quantity: 1, expiration_date: null, frozen: false, refrigerated: false,
        });
      }
      await api.deleteShoppingItem(s.id);
      return { name: s.name, wasExisting: !!existing };
    },
    onSuccess: ({ name, wasExisting }) => {
      qc.invalidateQueries({ queryKey: ["pantry"] });
      qc.invalidateQueries({ queryKey: ["shopping"] });
      toast({ title: wasExisting ? `${name} quantity updated in pantry` : `${name} added to pantry` });
    },
    onError: () => toast({ title: "Failed to process item", variant: "destructive" }),
  });

  const upsertLink = useMutation({
    mutationFn: ({ ingredient, pantryItemId, mealNames }: { ingredient: string; pantryItemId: number; mealNames: string[] }) =>
      api.upsertShoppingListLink(weekStart, ingredient, pantryItemId, mealNames),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list-links", weekStart] }),
  });

  const deleteLink = useMutation({
    mutationFn: (id: number) => api.deleteShoppingListLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list-links", weekStart] }),
  });

  const exportToPantryList = useMutation({
    mutationFn: async (items: string[]) => {
      const existingNames = new Set(shoppingList.map((i) => i.name.toLowerCase()));
      const newItems = items.filter((name) => !existingNames.has(name.toLowerCase()));
      await Promise.all(newItems.map((name) => api.addShoppingItem(userId!, name)));
      return newItems.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      toast({ title: count === 0 ? "All items already on shopping list" : `${count} item${count === 1 ? "" : "s"} added to shopping list` });
    },
    onError: () => toast({ title: "Failed to export", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleAddItem = () => {
    if (!newShoppingName.trim() || !userId) return;
    addShopping.mutate({ name: newShoppingName.trim(), categoryId: newShoppingCategoryId });
    setNewShoppingName("");
    setNewShoppingCategoryId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 sm:px-6 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Shopping List</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Your shopping list and meal ingredient planner.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <Tabs defaultValue="mylist" className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="mylist" className="gap-1.5 flex-1 sm:flex-none">
              <ShoppingCart className="h-4 w-4" /> My List
              {shoppingList.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{shoppingList.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="meals" className="gap-1.5 flex-1 sm:flex-none">
              <UtensilsCrossed className="h-4 w-4" /> From Meals
              {mealShoppingList.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{mealShoppingList.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ── My List Tab ── */}
          <TabsContent value="mylist" className="space-y-4">
            {/* Add item */}
            <div className="flex gap-2">
              <Input
                placeholder="Add item to shopping list…"
                value={newShoppingName}
                onChange={(e) => setNewShoppingName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
              />
              <Select
                value={newShoppingCategoryId != null ? String(newShoppingCategoryId) : "__none__"}
                onValueChange={(v) => setNewShoppingCategoryId(v === "__none__" ? null : parseInt(v))}
              >
                <SelectTrigger className="w-44 shrink-0"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No category</SelectItem>
                  {apiCategories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleAddItem} disabled={!newShoppingName.trim() || addShopping.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <CardDescription>{shoppingList.length} item{shoppingList.length !== 1 ? "s" : ""} on your shopping list</CardDescription>
              {shoppingList.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => shoppingList.forEach((s) => deleteShopping.mutate(s.id))}>
                  Clear All
                </Button>
              )}
            </div>

            {shoppingList.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center flex flex-col items-center gap-2 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 text-primary" />
                  <p className="font-medium text-foreground">Shopping list is empty</p>
                  <p>Add items above or export from the From Meals tab.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {shoppingList.map((s) => {
                  const pantryItem = apiItems.find((i) => i.name === s.name);
                  const isEditing = editingShoppingId === s.id;
                  return (
                    <Card key={s.id}>
                      <CardContent className="py-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground">{s.name}</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number" min={0} step="any"
                                className="h-7 w-20 text-sm"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    updateShopping.mutate({ id: s.id, requestedQuantity: editQty === "" ? null : Number(editQty), unit: s.unit });
                                    setEditingShoppingId(null);
                                  } else if (e.key === "Escape") {
                                    setEditingShoppingId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <span className="text-sm text-muted-foreground">{s.unit ?? ""}</span>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                                onClick={() => { updateShopping.mutate({ id: s.id, requestedQuantity: editQty === "" ? null : Number(editQty), unit: s.unit }); setEditingShoppingId(null); }}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingShoppingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="text-sm font-medium text-foreground hover:underline cursor-pointer"
                              onClick={() => { setEditQty(s.requestedQuantity != null ? String(s.requestedQuantity) : ""); setEditingShoppingId(s.id); }}
                            >
                              {s.requestedQuantity != null
                                ? `× ${s.requestedQuantity} ${s.unit ?? ""}`
                                : <span className="text-muted-foreground text-xs">+ qty</span>}
                            </button>
                          )}
                          {pantryItem && <span className="text-sm text-muted-foreground">({pantryItem.quantity} {pantryItem.unit} left)</span>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                          title="Move to pantry" onClick={() => processToInventory.mutate(s)} disabled={processToInventory.isPending}>
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => deleteShopping.mutate(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── From Meals Tab ── */}
          <TabsContent value="meals" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">Ingredients for {weekLabel}</CardTitle>
                    <CardDescription>Auto-generated from your planned meals. Tap an ingredient to link it to a pantry item.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
                      <ChevronLeft className="h-4 w-4 rotate-180" />
                    </Button>
                  </div>
                </div>
                {mealShoppingList.length > 0 && (
                  <Button
                    size="sm" variant="outline" className="gap-1.5 w-fit"
                    disabled={exportToPantryList.isPending || !userId}
                    onClick={() => {
                      const unlinked = mealShoppingList.filter(({ name }) => !linkedIngredients.has(name)).map(({ name }) => name);
                      if (unlinked.length > 0) exportToPantryList.mutate(unlinked);
                      else toast({ title: "All items are already on shopping list or claimed from pantry" });
                    }}
                  >
                    <ShoppingCart className="h-4 w-4" /> Export Unlinked to My List
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {mealShoppingList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No ingredients for this week — plan some meals first.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {mealShoppingList.map(({ name, meals }) => {
                      const checked = linkedIngredients.has(name);
                      return (
                        <li
                          key={name}
                          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition-colors ${checked ? "border-border/40 bg-muted/30 hover:bg-muted/50" : "border-border hover:bg-muted/50"}`}
                          onClick={() => {
                            if (checked) {
                              const id = linkIdByIngredient.get(name);
                              if (id != null) deleteLink.mutate(id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {checked && <span className="text-primary text-xs shrink-0">✓</span>}
                            <span className={`capitalize ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>{name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground ml-3 text-right shrink-0">{meals.join(", ")}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Shopping;
