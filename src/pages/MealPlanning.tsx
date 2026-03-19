import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Archive,
  UtensilsCrossed,
  BookOpen,
  ShoppingCart,
  Trash2,
  X,
  Snowflake,
  Refrigerator,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, ApiRecipe, ApiPlannedMeal } from "@/lib/api";

/* ─── Types ─── */
type MealSlot = "breakfast" | "lunch" | "dinner";

/* ─── Helpers ─── */
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

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/* ─── Page ─── */
const MealPlanning = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState("calendar");
  const [focusedRecipeId, setFocusedRecipeId] = useState<number | null>(null);
  const [viewRecipe, setViewRecipe] = useState<ApiRecipe | null>(null);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const [userId, setUserId] = useState<string | null>(() => {
    const s = localStorage.getItem("home_hub_user_id");
    return s && UUID_RE.test(s) ? s : null;
  });
  useEffect(() => {
    if (!userId) api.getOrCreateUserId().then(setUserId).catch(() => {});
  }, [userId]);
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = fmt(weekDates[0]);
  const weekEnd = fmt(weekDates[6]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.getRecipes(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["pantry-groups"],
    queryFn: () => api.getGroups(),
  });
  const leftoversCategoryId = useMemo(
    () => categories.find((c) => c.name.toLowerCase() === "leftovers")?.id ?? null,
    [categories]
  );

  const { data: plannedMeals = [] } = useQuery({
    queryKey: ["planned-meals", weekStart, weekEnd],
    queryFn: () => api.getPlannedMeals(weekStart, weekEnd),
  });

  // ── Recipe mutations ──────────────────────────────────────────────────────
  const createRecipe = useMutation({
    mutationFn: (recipe: Omit<ApiRecipe, "id">) => api.createRecipe(recipe),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
    onError: (err) => toast({ title: "Failed to save recipe", description: String(err), variant: "destructive" }),
  });

  const deleteRecipe = useMutation({
    mutationFn: (id: number) => api.deleteRecipe(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["planned-meals"] });
    },
    onError: (err) => toast({ title: "Failed to delete recipe", description: String(err), variant: "destructive" }),
  });

  // ── Planned meal mutations ────────────────────────────────────────────────
  const createMeal = useMutation({
    mutationFn: ({ plan_date, slot, recipe_id, custom_name, link }: { plan_date: string; slot: string; recipe_id: number | null; custom_name: string | null; link: string | null }) =>
      api.createPlannedMeal(plan_date, slot, recipe_id, custom_name, link),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planned-meals"] }),
    onError: (err) => toast({ title: "Failed to save meal", description: String(err), variant: "destructive" }),
  });

  const updateMeal = useMutation({
    mutationFn: ({ id, recipe_id, custom_name, link }: { id: number; recipe_id: number | null; custom_name: string | null; link: string | null }) =>
      api.updatePlannedMeal(id, recipe_id, custom_name, link),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planned-meals"] }),
    onError: (err) => toast({ title: "Failed to update meal", description: String(err), variant: "destructive" }),
  });

  const deleteMeal = useMutation({
    mutationFn: (id: number) => api.deletePlannedMeal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planned-meals"] }),
    onError: (err) => toast({ title: "Failed to remove meal", description: String(err), variant: "destructive" }),
  });

  // ── Save as leftover ──────────────────────────────────────────────────────
  const [leftoverDialog, setLeftoverDialog] = useState<{ name: string; servings: string; groupId: number | null; newGroupName: string; frozen: boolean; refrigerated: boolean; expirationDate: string } | null>(null);

  const createLeftover = useMutation({
    mutationFn: async ({ name, servings, groupId, newGroupName, frozen, refrigerated, expirationDate }: { name: string; servings: number; groupId: number | null; newGroupName: string; frozen: boolean; refrigerated: boolean; expirationDate: string }) => {
      let resolvedGroupId = groupId;
      if (groupId === -1) {
        const trimmed = newGroupName.trim();
        if (trimmed) {
          const created = await api.createGroup(userId!, { name: trimmed, category_id: leftoversCategoryId });
          qc.invalidateQueries({ queryKey: ["pantry-groups"] });
          resolvedGroupId = created.id;
        } else {
          resolvedGroupId = null;
        }
      }
      return api.createPantryItem(userId!, {
        name,
        brand: null,
        category_id: leftoversCategoryId,
        group_id: resolvedGroupId,
        quantity: servings,
        unit: "servings",
        min_quantity: 1,
        expiration_date: expirationDate || null,
        frozen,
        refrigerated,
      });
    },
    onSuccess: (_, { name }) => {
      qc.invalidateQueries({ queryKey: ["pantry"] });
      toast({ title: `${name} added to pantry as leftovers` });
      setLeftoverDialog(null);
    },
    onError: (err) => toast({ title: "Failed to save leftover", description: String(err), variant: "destructive" }),
  });

  const openLeftoverDialog = (meal: ApiPlannedMeal) => {
    const label = meal.custom_name ?? recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Leftovers";
    const recipe = recipes.find((r) => r.id === meal.recipe_id);
    setLeftoverDialog({ name: label, servings: String(recipe?.servings ?? 2), groupId: null, newGroupName: "", frozen: false, refrigerated: false, expirationDate: "" });
  };

  // ── Add recipe dialog ─────────────────────────────────────────────────────
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [rName, setRName] = useState("");
  const [rIngredients, setRIngredients] = useState("");
  const [rInstructions, setRInstructions] = useState("");
  const [rServings, setRServings] = useState("4");
  const [rTags, setRTags] = useState("");

  const addRecipe = () => {
    const name = rName.trim();
    if (!name) return;
    createRecipe.mutate({
      name,
      ingredients: rIngredients.split("\n").map((l) => l.trim()).filter(Boolean),
      instructions: rInstructions.trim() || null,
      servings: parseInt(rServings) || 4,
      tags: rTags.split(",").map((t) => t.trim()).filter(Boolean),
    }, {
      onSuccess: () => {
        toast({ title: `"${name}" added to recipes` });
        setRName(""); setRIngredients(""); setRInstructions(""); setRServings("4"); setRTags("");
        setRecipeOpen(false);
      },
    });
  };

  // ── Assign meal dialog ────────────────────────────────────────────────────
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDate, setAssignDate] = useState("");
  const [assignSlot, setAssignSlot] = useState<MealSlot>("dinner");
  const [assignRecipeId, setAssignRecipeId] = useState("");
  const [assignCustom, setAssignCustom] = useState("");
  const [assignExistingId, setAssignExistingId] = useState<number | null>(null);
  const [assignLink, setAssignLink] = useState("");

  const openAssign = (date: string, slot: MealSlot, existing?: ApiPlannedMeal) => {
    setAssignDate(date);
    setAssignSlot(slot);
    setAssignRecipeId(existing?.recipe_id != null ? String(existing.recipe_id) : "");
    setAssignCustom(existing?.custom_name ?? "");
    setAssignLink(existing?.link ?? "");
    setAssignExistingId(existing?.id ?? null);
    setAssignOpen(true);
  };

  const confirmAssign = () => {
    if (!assignRecipeId && !assignCustom.trim()) return;
    const recipe_id = assignRecipeId ? parseInt(assignRecipeId) : null;
    const custom_name = assignCustom.trim() || null;
    const link = assignLink.trim() || null;
    if (assignExistingId !== null) {
      updateMeal.mutate({ id: assignExistingId, recipe_id, custom_name, link }, { onSuccess: () => setAssignOpen(false) });
    } else {
      createMeal.mutate({ plan_date: assignDate, slot: assignSlot, recipe_id, custom_name, link }, { onSuccess: () => setAssignOpen(false) });
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const getSlotMeals = (date: string, slot: MealSlot): ApiPlannedMeal[] =>
    plannedMeals.filter((m) => m.plan_date.slice(0, 10) === date && m.slot === slot);

  const getMealLabel = (meal: ApiPlannedMeal) => {
    if (meal.custom_name) return meal.custom_name;
    return recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Unknown";
  };

  const shoppingList = useMemo(() => {
    const ingredientMap = new Map<string, number>();
    for (const meal of plannedMeals) {
      const recipe = recipes.find((r) => r.id === meal.recipe_id);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        const key = ing.toLowerCase();
        ingredientMap.set(key, (ingredientMap.get(key) || 0) + 1);
      }
    }
    return Array.from(ingredientMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [plannedMeals, recipes]);

  const weekLabel = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekDates[0].toLocaleDateString(undefined, opts)} – ${weekDates[6].toLocaleDateString(undefined, opts)}`;
  }, [weekDates]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Meal Planning</h1>
            <p className="text-sm text-muted-foreground">Plan your weekly meals, save recipes, and auto-generate a shopping list.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-8">

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "recipes") setFocusedRecipeId(null); }} className="space-y-6">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-1.5">
              <UtensilsCrossed className="h-4 w-4" /> Weekly Plan
            </TabsTrigger>
            <TabsTrigger value="recipes" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> Recipes
            </TabsTrigger>
            <TabsTrigger value="shopping" className="gap-1.5">
              <ShoppingCart className="h-4 w-4" /> Shopping List
            </TabsTrigger>
          </TabsList>

          {/* ─── WEEKLY CALENDAR ─── */}
          <TabsContent value="calendar" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium text-foreground">{weekLabel}</span>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date) => {
                const dateStr = fmt(date);
                const isToday = fmt(new Date()) === dateStr;
                return (
                  <Card
                    key={dateStr}
                    className={`min-h-[180px] transition-shadow ${isToday ? "ring-2 ring-primary/40" : ""}`}
                  >
                    <CardHeader className="p-3 pb-1">
                      <p className="text-xs font-semibold text-muted-foreground">{DAY_NAMES[date.getDay()]}</p>
                      <p className={`text-sm font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                        {date.getDate()}
                      </p>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-1.5">
                      {SLOTS.map((slot) => {
                        const meals = getSlotMeals(dateStr, slot);
                        return (
                          <div key={slot}>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {SLOT_LABELS[slot]}
                            </p>
                            {meals.map((meal) => (
                              <div key={meal.id} className="flex items-center gap-1 group">
                                {meal.link ? (
                                  <a
                                    href={meal.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary underline truncate flex-1 hover:text-primary/80 transition-colors"
                                  >
                                    {getMealLabel(meal)}
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => openAssign(dateStr, slot, meal)}
                                    className="text-xs text-foreground truncate flex-1 text-left hover:text-primary transition-colors"
                                  >
                                    {getMealLabel(meal)}
                                  </button>
                                )}
                                <button
                                  onClick={() => openAssign(dateStr, slot, meal)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity shrink-0"
                                  title="Edit"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                {meal.recipe_id != null && (
                                  <button
                                    onClick={() => { const r = recipes.find((x) => x.id === meal.recipe_id); setFocusedRecipeId(meal.recipe_id!); setActiveTab("recipes"); if (r) setViewRecipe(r); }}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity shrink-0"
                                    title="View recipe"
                                  >
                                    <BookOpen className="h-3 w-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => openLeftoverDialog(meal)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-green-600 transition-opacity shrink-0"
                                  title="Save as leftover"
                                >
                                  <Archive className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => deleteMeal.mutate(meal.id)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => openAssign(dateStr, slot)}
                              className="text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                              + add
                            </button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ─── RECIPES ─── */}
          <TabsContent value="recipes" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Add Recipe
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Recipe</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Recipe name" value={rName} onChange={(e) => setRName(e.target.value)} />
                    <Textarea
                      placeholder="Ingredients (one per line)"
                      rows={4}
                      value={rIngredients}
                      onChange={(e) => setRIngredients(e.target.value)}
                    />
                    <Textarea
                      placeholder="Instructions"
                      rows={3}
                      value={rInstructions}
                      onChange={(e) => setRInstructions(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Servings"
                        value={rServings}
                        onChange={(e) => setRServings(e.target.value)}
                        className="w-24"
                      />
                      <Input
                        placeholder="Tags (comma-separated)"
                        value={rTags}
                        onChange={(e) => setRTags(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <Button onClick={addRecipe} className="w-full" disabled={createRecipe.isPending}>
                      Save Recipe
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {recipes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recipes yet — add one to get started.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recipes.map((r) => (
                  <Card key={r.id} className={focusedRecipeId === r.id ? "ring-2 ring-primary/60" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <button
                          className="text-left hover:text-primary transition-colors"
                          onClick={() => setViewRecipe(r)}
                        >
                          {r.name}
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="View recipe"
                            onClick={() => setViewRecipe(r)}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteRecipe.mutate(r.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardTitle>
                      <CardDescription>
                        {r.servings} servings
                        {r.tags.length > 0 && ` · ${r.tags.join(", ")}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Ingredients:</p>
                      <ul className="list-disc list-inside">
                        {r.ingredients.slice(0, 5).map((ing, i) => (
                          <li key={i}>{ing}</li>
                        ))}
                        {r.ingredients.length > 5 && (
                          <li className="text-muted-foreground">+{r.ingredients.length - 5} more</li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── SHOPPING LIST ─── */}
          <TabsContent value="shopping" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Shopping List for {weekLabel}</CardTitle>
                <CardDescription>
                  Auto-generated from your planned meals that have recipes assigned.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {shoppingList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No ingredients needed — plan some meals with recipes first.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {shoppingList.map(([name, count]) => (
                      <li
                        key={name}
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm"
                      >
                        <span className="text-foreground capitalize">{name}</span>
                        {count > 1 && (
                          <span className="text-xs text-muted-foreground">×{count}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Save as Leftover Dialog */}
      <Dialog open={!!leftoverDialog} onOpenChange={(open) => { if (!open) setLeftoverDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Leftover</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={leftoverDialog?.name ?? ""}
                onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, name: e.target.value }))}
                placeholder="Leftover name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Servings remaining</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  className="w-24"
                  value={leftoverDialog?.servings ?? ""}
                  onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, servings: e.target.value }))}
                />
                <span className="text-sm text-muted-foreground">servings</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expiration date (optional)</Label>
              <Input
                type="date"
                value={leftoverDialog?.expirationDate ?? ""}
                onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, expirationDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Group (optional)</Label>
              <Select
                value={leftoverDialog?.groupId != null ? String(leftoverDialog.groupId) : "none"}
                onValueChange={(v) =>
                  setLeftoverDialog((p) =>
                    p && ({ ...p, groupId: v === "none" ? null : parseInt(v), newGroupName: "" })
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups
                    .filter((g) => g.category_id === leftoversCategoryId || leftoversCategoryId == null)
                    .map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  <SelectItem value="-1">+ New group…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {leftoverDialog?.groupId === -1 && (
              <div className="space-y-1.5">
                <Label>New group name</Label>
                <Input
                  placeholder="Group name"
                  value={leftoverDialog?.newGroupName ?? ""}
                  onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, newGroupName: e.target.value }))}
                />
              </div>
            )}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={leftoverDialog?.frozen ?? false}
                  onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, frozen: e.target.checked }))}
                />
                <span title="Frozen"><Snowflake className="h-4 w-4 text-blue-400" /></span>
                Frozen
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={leftoverDialog?.refrigerated ?? false}
                  onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, refrigerated: e.target.checked }))}
                />
                <span title="Refrigerated"><Refrigerator className="h-4 w-4 text-cyan-500" /></span>
                Refrigerated
              </label>
            </div>
            <Button
              className="w-full"
              disabled={!leftoverDialog?.name.trim() || !userId || createLeftover.isPending}
              onClick={() => {
                if (!leftoverDialog?.name.trim()) return;
                createLeftover.mutate({
                  name: leftoverDialog.name.trim(),
                  servings: parseInt(leftoverDialog.servings) || 1,
                  groupId: leftoverDialog.groupId,
                  newGroupName: leftoverDialog.newGroupName,
                  frozen: leftoverDialog.frozen,
                  refrigerated: leftoverDialog.refrigerated,
                  expirationDate: leftoverDialog.expirationDate,
                });
              }}
            >
              <Archive className="h-4 w-4 mr-2" /> Add to Pantry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Meal Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignExistingId !== null ? "Edit" : "Add"} {SLOT_LABELS[assignSlot]} — {assignDate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {recipes.length > 0 && (
              <Select value={assignRecipeId} onValueChange={(v) => { setAssignRecipeId(v); setAssignCustom(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a recipe" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              placeholder="Custom meal name"
              value={assignCustom}
              onChange={(e) => { setAssignCustom(e.target.value); setAssignRecipeId(""); }}
            />
            <Input
              placeholder="Link (optional)"
              value={assignLink}
              onChange={(e) => setAssignLink(e.target.value)}
            />
            <Button onClick={confirmAssign} className="w-full" disabled={createMeal.isPending || updateMeal.isPending}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipe Detail Dialog */}
      <Dialog open={!!viewRecipe} onOpenChange={(open) => { if (!open) setViewRecipe(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewRecipe?.name}</DialogTitle>
          </DialogHeader>
          {viewRecipe && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{viewRecipe.servings} servings</span>
                {viewRecipe.tags.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{viewRecipe.tags.join(", ")}</span>
                  </>
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1.5">Ingredients</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {viewRecipe.ingredients.map((ing, i) => (
                    <li key={i}>{ing}</li>
                  ))}
                </ul>
              </div>
              {viewRecipe.instructions && (
                <div>
                  <p className="font-semibold text-foreground mb-1.5">Instructions</p>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {viewRecipe.instructions}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MealPlanning;
