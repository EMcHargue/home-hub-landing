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
  List,
  CalendarDays,
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
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/* ─── Mobile Day View ─── */
function MobileDayView({
  weekDates,
  plannedMeals,
  recipes,
  openAssign,
  openLeftoverDialog,
  deleteMeal,
  setFocusedRecipeId,
  setActiveTab,
  setViewRecipe,
}: {
  weekDates: Date[];
  plannedMeals: ApiPlannedMeal[];
  recipes: ApiRecipe[];
  openAssign: (date: string, slot: MealSlot, existing?: ApiPlannedMeal) => void;
  openLeftoverDialog: (meal: ApiPlannedMeal) => void;
  deleteMeal: { mutate: (id: number) => void };
  setFocusedRecipeId: (id: number | null) => void;
  setActiveTab: (tab: string) => void;
  setViewRecipe: (r: ApiRecipe | null) => void;
}) {
  const todayStr = fmt(new Date());
  const todayIndex = weekDates.findIndex((d) => fmt(d) === todayStr);
  const [dayIndex, setDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);

  const date = weekDates[dayIndex];
  const dateStr = fmt(date);
  const isToday = dateStr === todayStr;

  const getSlotMeals = (slot: MealSlot): ApiPlannedMeal[] =>
    plannedMeals.filter((m) => m.plan_date.slice(0, 10) === dateStr && m.slot === slot);

  const getMealLabel = (meal: ApiPlannedMeal) => {
    if (meal.custom_name) return meal.custom_name;
    return recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Unknown";
  };

  return (
    <div className="space-y-4">
      {/* Day navigator */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
          disabled={dayIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="text-center">
          <p className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
            {DAY_NAMES_FULL[date.getDay()]}
            {isToday && <span className="ml-2 text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">Today</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setDayIndex((i) => Math.min(6, i + 1))}
          disabled={dayIndex === 6}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day dots */}
      <div className="flex justify-center gap-2">
        {weekDates.map((d, i) => {
          const dStr = fmt(d);
          const isT = dStr === todayStr;
          return (
            <button
              key={dStr}
              onClick={() => setDayIndex(i)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors ${i === dayIndex ? "bg-primary/10" : "hover:bg-muted/60"}`}
            >
              <span className="text-[10px] text-muted-foreground">{DAY_NAMES[d.getDay()]}</span>
              <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isT ? "bg-primary text-primary-foreground" : i === dayIndex ? "text-primary" : "text-foreground"}`}>
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Meal slots */}
      <div className="space-y-3">
        {SLOTS.map((slot) => {
          const meals = getSlotMeals(slot);
          return (
            <Card key={slot}>
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {SLOT_LABELS[slot]}
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {meals.map((meal) => (
                  <div key={meal.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    {meal.link ? (
                      <a
                        href={meal.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline truncate flex-1"
                      >
                        {getMealLabel(meal)}
                      </a>
                    ) : (
                      <button
                        onClick={() => openAssign(dateStr, slot, meal)}
                        className="text-sm text-foreground truncate flex-1 text-left"
                      >
                        {getMealLabel(meal)}
                      </button>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openAssign(dateStr, slot, meal)}
                        className="text-muted-foreground hover:text-primary transition-colors p-1"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {meal.recipe_id != null && (
                        <button
                          onClick={() => {
                            const r = recipes.find((x) => x.id === meal.recipe_id);
                            setFocusedRecipeId(meal.recipe_id!);
                            setActiveTab("recipes");
                            if (r) setViewRecipe(r);
                          }}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                          title="View recipe"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {meal.ingredients?.length ? (
                        <button
                          onClick={() => setViewRecipe({ id: meal.id, name: getMealLabel(meal), ingredients: meal.ingredients!, instructions: null, servings: 0, tags: [] })}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                          title="View ingredients"
                        >
                          <List className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => openLeftoverDialog(meal)}
                        className="text-muted-foreground hover:text-green-600 transition-colors p-1"
                        title="Save as leftover"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMeal.mutate(meal.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => openAssign(dateStr, slot)}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 py-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add meal
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Desktop Week View ─── */
function DesktopWeekView({
  weekDates,
  plannedMeals,
  recipes,
  openAssign,
  openLeftoverDialog,
  deleteMeal,
  setFocusedRecipeId,
  setActiveTab,
  setViewRecipe,
}: {
  weekDates: Date[];
  plannedMeals: ApiPlannedMeal[];
  recipes: ApiRecipe[];
  openAssign: (date: string, slot: MealSlot, existing?: ApiPlannedMeal) => void;
  openLeftoverDialog: (meal: ApiPlannedMeal) => void;
  deleteMeal: { mutate: (id: number) => void };
  setFocusedRecipeId: (id: number | null) => void;
  setActiveTab: (tab: string) => void;
  setViewRecipe: (r: ApiRecipe | null) => void;
}) {
  const todayStr = fmt(new Date());

  const getSlotMeals = (date: string, slot: MealSlot): ApiPlannedMeal[] =>
    plannedMeals.filter((m) => m.plan_date.slice(0, 10) === date && m.slot === slot);

  const getMealLabel = (meal: ApiPlannedMeal) => {
    if (meal.custom_name) return meal.custom_name;
    return recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Unknown";
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDates.map((date) => {
        const dateStr = fmt(date);
        const isToday = todayStr === dateStr;
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
                        {meal.ingredients?.length ? (
                          <button
                            onClick={() => setViewRecipe({ id: meal.id, name: getMealLabel(meal), ingredients: meal.ingredients!, instructions: null, servings: 0, tags: [] })}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity shrink-0"
                            title="View ingredients"
                          >
                            <List className="h-3 w-3" />
                          </button>
                        ) : null}
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
  );
}

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

  // Auto-create "Leftovers" category if it doesn't exist
  useEffect(() => {
    if (categories.length > 0 && leftoversCategoryId === null) {
      api.createCategory("Leftovers").then(() => {
        qc.invalidateQueries({ queryKey: ["categories"] });
      }).catch(() => {});
    }
  }, [categories, leftoversCategoryId]);

  const { data: pantryItems = [] } = useQuery({
    queryKey: ["pantry"],
    queryFn: () => api.getPantry(),
  });

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
    mutationFn: ({ plan_date, slot, recipe_id, custom_name, link, ingredients }: { plan_date: string; slot: string; recipe_id: number | null; custom_name: string | null; link: string | null; ingredients: string[] | null }) =>
      api.createPlannedMeal(plan_date, slot, recipe_id, custom_name, link, ingredients),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planned-meals"] }),
    onError: (err) => toast({ title: "Failed to save meal", description: String(err), variant: "destructive" }),
  });

  const updateMeal = useMutation({
    mutationFn: ({ id, recipe_id, custom_name, link, ingredients }: { id: number; recipe_id: number | null; custom_name: string | null; link: string | null; ingredients: string[] | null }) =>
      api.updatePlannedMeal(id, recipe_id, custom_name, link, ingredients),
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

  // ── Ingredient pantry lookup (DB-backed) ─────────────────────────────────
  const { data: shoppingListLinks = [] } = useQuery({
    queryKey: ["shopping-list-links", weekStart],
    queryFn: () => api.getShoppingListLinks(weekStart),
  });
  const linkedIngredients = useMemo(
    () => new Map<string, number>(shoppingListLinks.map((l) => [l.ingredient_name, l.pantry_item_id])),
    [shoppingListLinks]
  );
  const linkIdByIngredient = useMemo(
    () => new Map<string, number>(shoppingListLinks.map((l) => [l.ingredient_name, l.id])),
    [shoppingListLinks]
  );

  const upsertLink = useMutation({
    mutationFn: ({ ingredient, pantryItemId, mealNames }: { ingredient: string; pantryItemId: number; mealNames: string[] }) =>
      api.upsertShoppingListLink(weekStart, ingredient, pantryItemId, mealNames),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list-links", weekStart] }),
  });

  const deleteLink = useMutation({
    mutationFn: (id: number) => api.deleteShoppingListLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list-links", weekStart] }),
  });

  // ── Export to pantry shopping list ───────────────────────────────────────
  const { data: pantryShoppingList = [] } = useQuery({
    queryKey: ["shopping"],
    queryFn: () => api.getShopping(),
  });

  const exportToPantryList = useMutation({
    mutationFn: async (items: string[]) => {
      const existingNames = new Set(pantryShoppingList.map((i) => i.item_name.toLowerCase()));
      const newItems = items.filter((name) => !existingNames.has(name.toLowerCase()));
      await Promise.all(newItems.map((name) => api.addShoppingItem(userId!, name)));
      return newItems.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      if (count === 0) {
        toast({ title: "All items already on shopping list" });
      } else {
        toast({ title: `${count} item${count === 1 ? "" : "s"} added to shopping list` });
      }
    },
    onError: (err) => toast({ title: "Failed to export", description: String(err), variant: "destructive" }),
  });

  type PantryNav =
    | { level: "categories" }
    | { level: "groups"; categoryId: number | null; categoryName: string }
    | { level: "items"; categoryId: number | null; categoryName: string; groupId: number | null; groupName: string };
  const [ingredientDialog, setIngredientDialog] = useState<{ ingredient: string; nav: PantryNav } | null>(null);

  // ── Assign meal dialog ────────────────────────────────────────────────────
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDate, setAssignDate] = useState("");
  const [assignSlot, setAssignSlot] = useState<MealSlot>("dinner");
  const [assignRecipeId, setAssignRecipeId] = useState("");
  const [assignCustom, setAssignCustom] = useState("");
  const [assignExistingId, setAssignExistingId] = useState<number | null>(null);
  const [assignLink, setAssignLink] = useState("");
  const [assignIngredients, setAssignIngredients] = useState("");

  const openAssign = (date: string, slot: MealSlot, existing?: ApiPlannedMeal) => {
    setAssignDate(date);
    setAssignSlot(slot);
    setAssignRecipeId(existing?.recipe_id != null ? String(existing.recipe_id) : "");
    setAssignCustom(existing?.custom_name ?? "");
    setAssignLink(existing?.link ?? "");
    setAssignIngredients(existing?.ingredients?.join("\n") ?? "");
    setAssignExistingId(existing?.id ?? null);
    setAssignOpen(true);
  };

  const confirmAssign = () => {
    if (!assignRecipeId && !assignCustom.trim()) return;
    const recipe_id = assignRecipeId ? parseInt(assignRecipeId) : null;
    const custom_name = assignCustom.trim() || null;
    const link = assignLink.trim() || null;
    const ingredients = !recipe_id
      ? assignIngredients.split("\n").map((l) => l.trim()).filter(Boolean)
      : null;
    if (assignExistingId !== null) {
      updateMeal.mutate({ id: assignExistingId, recipe_id, custom_name, link, ingredients }, { onSuccess: () => setAssignOpen(false) });
    } else {
      createMeal.mutate({ plan_date: assignDate, slot: assignSlot, recipe_id, custom_name, link, ingredients }, { onSuccess: () => setAssignOpen(false) });
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const getMealLabel = (meal: ApiPlannedMeal) => {
    if (meal.custom_name) return meal.custom_name;
    return recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Unknown";
  };

  const shoppingList = useMemo(() => {
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

  const weekLabel = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekDates[0].toLocaleDateString(undefined, opts)} – ${weekDates[6].toLocaleDateString(undefined, opts)}`;
  }, [weekDates]);

  const sharedCalendarProps = {
    weekDates,
    plannedMeals,
    recipes,
    openAssign,
    openLeftoverDialog,
    deleteMeal,
    setFocusedRecipeId,
    setActiveTab,
    setViewRecipe,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 sm:px-6 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Meal Planning</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Plan your weekly meals, save recipes, and auto-generate a shopping list.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "recipes") setFocusedRecipeId(null); }} className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="calendar" className="gap-1.5 flex-1 sm:flex-none">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Weekly Plan</span>
              <span className="sm:hidden">Plan</span>
            </TabsTrigger>
            <TabsTrigger value="recipes" className="gap-1.5 flex-1 sm:flex-none">
              <BookOpen className="h-4 w-4" />
              Recipes
            </TabsTrigger>
            <TabsTrigger value="shopping" className="gap-1.5 flex-1 sm:flex-none">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Shopping List</span>
              <span className="sm:hidden">Shopping</span>
            </TabsTrigger>
          </TabsList>

          {/* ─── WEEKLY CALENDAR ─── */}
          <TabsContent value="calendar" className="space-y-4">
            {/* Week navigator */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm sm:text-base">{weekLabel}</span>
                {weekOffset !== 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> Today
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile: single day view */}
            <div className="sm:hidden">
              <MobileDayView {...sharedCalendarProps} />
            </div>

            {/* Desktop: full week grid */}
            <div className="hidden sm:block">
              <DesktopWeekView {...sharedCalendarProps} />
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Shopping List for {weekLabel}</CardTitle>
                    <CardDescription>
                      Auto-generated from your planned meals and recipes for the week.
                    </CardDescription>
                  </div>
                  {shoppingList.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      disabled={exportToPantryList.isPending || !userId}
                      onClick={() => {
                        const unlinked = shoppingList
                          .filter(({ name }) => !linkedIngredients.has(name))
                          .map(({ name }) => name);
                        if (unlinked.length > 0) exportToPantryList.mutate(unlinked);
                        else toast({ title: "All items are already claimed from pantry" });
                      }}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Export to Shopping List</span>
                      <span className="sm:hidden">Export</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {shoppingList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No ingredients needed — plan some meals first.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {shoppingList.map(({ name, meals }) => {
                      const checked = linkedIngredients.has(name);
                      return (
                        <li
                          key={name}
                          className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm cursor-pointer transition-colors ${checked ? "border-border/40 bg-muted/30 hover:bg-muted/50" : "border-border hover:bg-muted/50"}`}
                          onClick={() => {
                            if (checked) {
                              const id = linkIdByIngredient.get(name);
                              if (id != null) deleteLink.mutate(id);
                            } else {
                              setIngredientDialog({ ingredient: name, nav: { level: "categories" } });
                            }
                          }}
                        >
                          <span className={`capitalize ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>{name}</span>
                          <span className="text-xs text-muted-foreground ml-3 text-right">{meals.join(", ")}</span>
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
            {!assignRecipeId && (
              <Textarea
                placeholder="Ingredients (one per line, optional)"
                rows={4}
                value={assignIngredients}
                onChange={(e) => setAssignIngredients(e.target.value)}
              />
            )}
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

      {/* Ingredient Pantry Lookup Dialog */}
      <Dialog open={!!ingredientDialog} onOpenChange={(open) => { if (!open) setIngredientDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{ingredientDialog?.ingredient}</DialogTitle>
          </DialogHeader>
          {ingredientDialog && (() => {
            const nav = ingredientDialog.nav;

            const breadcrumb = nav.level === "groups"
              ? nav.categoryName
              : nav.level === "items"
              ? `${nav.categoryName}${nav.groupName ? ` / ${nav.groupName}` : ""}`
              : null;

            const catsWithItems = categories.filter((c) =>
              pantryItems.some((p) => p.category_id === c.id)
            );
            const hasUncategorized = pantryItems.some((p) => p.category_id == null);

            const renderCategories = () => (
              <ul className="space-y-1">
                {catsWithItems.map((c) => (
                  <li key={c.id}>
                    <button
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-sm font-medium"
                      onClick={() => setIngredientDialog((p) => p && ({ ...p, nav: { level: "groups", categoryId: c.id, categoryName: c.name } }))}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
                {hasUncategorized && (
                  <li>
                    <button
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-sm font-medium"
                      onClick={() => setIngredientDialog((p) => p && ({ ...p, nav: { level: "groups", categoryId: null, categoryName: "Uncategorized" } }))}
                    >
                      Uncategorized
                    </button>
                  </li>
                )}
              </ul>
            );

            const renderGroups = () => {
              if (nav.level !== "groups") return null;
              const catItems = pantryItems.filter((p) => p.category_id === nav.categoryId);
              const groupsInCat = groups.filter((g) =>
                g.category_id === nav.categoryId && catItems.some((p) => p.group_id === g.id)
              );
              const hasUngrouped = catItems.some((p) => p.group_id == null);
              return (
                <ul className="space-y-1">
                  {groupsInCat.map((g) => (
                    <li key={g.id}>
                      <button
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-sm font-medium"
                        onClick={() => setIngredientDialog((p) => p && ({ ...p, nav: { level: "items", categoryId: nav.categoryId, categoryName: nav.categoryName, groupId: g.id, groupName: g.name } }))}
                      >
                        {g.name}
                      </button>
                    </li>
                  ))}
                  {hasUngrouped && (
                    <li>
                      <button
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-sm font-medium text-muted-foreground"
                        onClick={() => setIngredientDialog((p) => p && ({ ...p, nav: { level: "items", categoryId: nav.categoryId, categoryName: nav.categoryName, groupId: null, groupName: "Ungrouped" } }))}
                      >
                        Ungrouped
                      </button>
                    </li>
                  )}
                  {groupsInCat.length === 0 && !hasUngrouped && (
                    <p className="text-sm text-muted-foreground text-center py-4">No items in this category.</p>
                  )}
                </ul>
              );
            };

            const renderItems = () => {
              if (nav.level !== "items") return null;
              const items = pantryItems.filter(
                (p) => p.category_id === nav.categoryId && p.group_id === nav.groupId
              );
              if (items.length === 0)
                return <p className="text-sm text-muted-foreground text-center py-4">No items here.</p>;
              const claimedElsewhere = new Set(
                Array.from(linkedIngredients.entries())
                  .filter(([ing]) => ing !== ingredientDialog.ingredient)
                  .map(([, id]) => id)
              );
              const currentlyLinkedId = linkedIngredients.get(ingredientDialog.ingredient);
              return (
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {items.map((item) => {
                    const isLinkedHere = item.id === currentlyLinkedId;
                    const isClaimed = claimedElsewhere.has(item.id);
                    return (
                      <li
                        key={item.id}
                        className={`rounded-lg border px-3 py-2 text-sm space-y-0.5 transition-colors ${isClaimed ? "border-border/40 opacity-40 cursor-not-allowed" : isLinkedHere ? "border-primary/60 bg-primary/5 cursor-pointer hover:bg-primary/10" : "border-border cursor-pointer hover:bg-muted/60"}`}
                        onClick={() => {
                          if (isClaimed) return;
                          if (isLinkedHere) {
                            const id = linkIdByIngredient.get(ingredientDialog.ingredient);
                            if (id != null) deleteLink.mutate(id);
                            setIngredientDialog(null);
                          } else {
                            const mealNames = shoppingList.find((s) => s.name === ingredientDialog.ingredient)?.meals ?? [];
                            upsertLink.mutate({ ingredient: ingredientDialog.ingredient, pantryItemId: item.id, mealNames });
                            setIngredientDialog(null);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            {item.name}
                            {item.frozen && <span title="Frozen"><Snowflake className="h-3 w-3 text-blue-400" /></span>}
                            {item.refrigerated && <span title="Refrigerated"><Refrigerator className="h-3 w-3 text-cyan-500" /></span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isClaimed && <span className="text-xs text-muted-foreground">claimed</span>}
                            {isLinkedHere && <span className="text-xs text-primary">linked ✓</span>}
                            <span className="text-muted-foreground">{item.quantity} {item.unit}</span>
                          </div>
                        </div>
                        {(item.brand || item.expiration_date) && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {item.brand && <span>{item.brand}</span>}
                            {item.expiration_date && <span>Exp: {item.expiration_date.slice(0, 10)}</span>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              );
            };

            return (
              <div className="space-y-3">
                {breadcrumb && (
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      if (nav.level === "groups") {
                        setIngredientDialog((p) => p && ({ ...p, nav: { level: "categories" } }));
                      } else if (nav.level === "items") {
                        setIngredientDialog((p) => p && ({ ...p, nav: { level: "groups", categoryId: nav.categoryId, categoryName: nav.categoryName } }));
                      }
                    }}
                  >
                    <ChevronLeft className="h-3 w-3" /> {breadcrumb}
                  </button>
                )}
                <div className="max-h-72 overflow-y-auto">
                  {nav.level === "categories" && renderCategories()}
                  {nav.level === "groups" && renderGroups()}
                  {nav.level === "items" && renderItems()}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MealPlanning;
