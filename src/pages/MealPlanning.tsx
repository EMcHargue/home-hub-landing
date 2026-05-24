import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Pencil, Archive,
  UtensilsCrossed, BookOpen, ShoppingCart, Trash2, X, Snowflake,
  Refrigerator, List, CalendarDays, Sun, Cloud, Moon, RotateCcw, ClipboardList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api, ApiRecipe, ApiPlannedMeal } from "@/lib/api";
import { isSameDay, startOfDay, format } from "date-fns";

/* ─── Types ─── */
type MealSlot = "breakfast" | "lunch" | "dinner";
type Chore = { id: string; title: string; assignee_id: string | null; completed: boolean; due_date: string | null; recurrence: string; };
type Task  = { id: string; title: string; assignee_id: string | null; completed: boolean; due_date: string | null; };

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
function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function parseDateSafe(d: string | null): Date | null {
  if (!d) return null;
  try {
    const t = d.trim().slice(0, 10);
    const [y, m, day] = t.split("-").map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(day)) return null;
    return startOfDay(new Date(y, m - 1, day));
  } catch { return null; }
}

const DAY_NAMES      = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_NAMES_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SLOTS: MealSlot[] = ["breakfast","lunch","dinner"];
const SLOT_LABELS: Record<MealSlot,string> = { breakfast:"Breakfast", lunch:"Lunch", dinner:"Dinner" };

type TimeOfDay = "morning" | "afternoon" | "evening";
const TOD_META: Record<TimeOfDay, { label: string; icon: React.ReactNode; meals: MealSlot[] }> = {
  morning:   { label: "Morning",   icon: <Sun   className="h-4 w-4 text-yellow-500" />, meals: ["breakfast"] },
  afternoon: { label: "Afternoon", icon: <Cloud className="h-4 w-4 text-blue-400"   />, meals: ["lunch"]     },
  evening:   { label: "Evening",   icon: <Moon  className="h-4 w-4 text-indigo-400" />, meals: ["dinner"]    },
};
const TIME_OF_DAY_ORDER: TimeOfDay[] = ["morning","afternoon","evening"];

/* ─── Day Detail Panel ─── */
function DayDetailPanel({
  date, plannedMeals, recipes, chores, tasks,
  openAssign, openLeftoverDialog, deleteMeal,
  setFocusedRecipeId, setActiveTab, setViewRecipe,
  onToggleChore, onToggleTask,
}: {
  date: Date;
  plannedMeals: ApiPlannedMeal[];
  recipes: ApiRecipe[];
  chores: Chore[];
  tasks: Task[];
  openAssign: (date: string, slot: MealSlot, existing?: ApiPlannedMeal) => void;
  openLeftoverDialog: (meal: ApiPlannedMeal) => void;
  deleteMeal: { mutate: (id: number) => void };
  setFocusedRecipeId: (id: number | null) => void;
  setActiveTab: (tab: string) => void;
  setViewRecipe: (r: ApiRecipe | null) => void;
  onToggleChore: (id: string) => void;
  onToggleTask:  (id: string) => void;
}) {
  const dateStr = fmt(date);

  const getMealLabel = (meal: ApiPlannedMeal) =>
    meal.custom_name ?? recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Unknown";

  const getSlotMeals = (slot: MealSlot) =>
    plannedMeals.filter((m) => m.plan_date.slice(0, 10) === dateStr && m.slot === slot);

  const dayChores = chores.filter(c => !c.completed && (() => { const d = parseDateSafe(c.due_date); return d && isSameDay(d, date); })());
  const dayTasks  = tasks.filter(t  => !t.completed  && (() => { const d = parseDateSafe(t.due_date); return d && isSameDay(d, date); })());

  return (
    <div className="space-y-3">
      {TIME_OF_DAY_ORDER.map((tod) => {
        const { label, icon, meals } = TOD_META[tod];
        const isAfternoon = tod === "afternoon";
        return (
          <Card key={tod}>
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {icon}{label}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Meals for this time of day */}
              {meals.map((slot) => {
                const slotMeals = getSlotMeals(slot);
                return (
                  <div key={slot}>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">{SLOT_LABELS[slot]}</p>
                    <div className="space-y-1.5">
                      {slotMeals.map((meal) => (
                        <div key={meal.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                          {meal.link ? (
                            <a href={meal.link} target="_blank" rel="noopener noreferrer"
                              className="text-sm text-primary underline truncate flex-1">
                              {getMealLabel(meal)}
                            </a>
                          ) : (
                            <button onClick={() => openAssign(dateStr, slot, meal)}
                              className="text-sm text-foreground truncate flex-1 text-left">
                              {getMealLabel(meal)}
                            </button>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openAssign(dateStr, slot, meal)} className="text-muted-foreground hover:text-primary p-1"><Pencil className="h-3.5 w-3.5" /></button>
                            {meal.recipe_id != null && (
                              <button onClick={() => { const r = recipes.find((x) => x.id === meal.recipe_id); setFocusedRecipeId(meal.recipe_id!); setActiveTab("recipes"); if (r) setViewRecipe(r); }} className="text-muted-foreground hover:text-primary p-1"><BookOpen className="h-3.5 w-3.5" /></button>
                            )}
                            {meal.ingredients?.length ? (
                              <button onClick={() => setViewRecipe({ id: meal.id, name: getMealLabel(meal), ingredients: meal.ingredients!, instructions: null, servings: 0, tags: [] })} className="text-muted-foreground hover:text-primary p-1"><List className="h-3.5 w-3.5" /></button>
                            ) : null}
                            <button onClick={() => openLeftoverDialog(meal)} className="text-muted-foreground hover:text-green-600 p-1"><Archive className="h-3.5 w-3.5" /></button>
                            <button onClick={() => deleteMeal.mutate(meal.id)} className="text-muted-foreground hover:text-destructive p-1"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => openAssign(dateStr, slot)}
                        className="w-full text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5 py-1">
                        <Plus className="h-3.5 w-3.5" /> Add meal
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Chores & Tasks in Afternoon */}
              {isAfternoon && (dayChores.length > 0 || dayTasks.length > 0) && (
                <div className="border-t pt-3 space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Chores & Tasks</p>
                  {dayChores.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                      <Checkbox checked={false} onCheckedChange={() => onToggleChore(c.id)} className="h-4 w-4" />
                      <span className="text-sm flex-1 truncate">{c.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        <RotateCcw className="mr-1 h-2.5 w-2.5" />Chore
                      </Badge>
                    </div>
                  ))}
                  {dayTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                      <Checkbox checked={false} onCheckedChange={() => onToggleTask(t.id)} className="h-4 w-4" />
                      <span className="text-sm flex-1 truncate">{t.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        <ClipboardList className="mr-1 h-2.5 w-2.5" />Task
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Mobile Day View ─── */
function MobileDayView(props: {
  weekDates: Date[];
  plannedMeals: ApiPlannedMeal[];
  recipes: ApiRecipe[];
  chores: Chore[];
  tasks: Task[];
  openAssign: (date: string, slot: MealSlot, existing?: ApiPlannedMeal) => void;
  openLeftoverDialog: (meal: ApiPlannedMeal) => void;
  deleteMeal: { mutate: (id: number) => void };
  setFocusedRecipeId: (id: number | null) => void;
  setActiveTab: (tab: string) => void;
  setViewRecipe: (r: ApiRecipe | null) => void;
  onToggleChore: (id: string) => void;
  onToggleTask:  (id: string) => void;
}) {
  const { weekDates } = props;
  const todayStr = fmt(new Date());
  const todayIndex = weekDates.findIndex((d) => fmt(d) === todayStr);
  const [dayIndex, setDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const date = weekDates[dayIndex];
  const isToday = fmt(date) === todayStr;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setDayIndex((i) => Math.max(0, i - 1))} disabled={dayIndex === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
            {DAY_NAMES_FULL[date.getDay()]}
            {isToday && <span className="ml-2 text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">Today</span>}
          </p>
          <p className="text-sm text-muted-foreground">{date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => setDayIndex((i) => Math.min(6, i + 1))} disabled={dayIndex === 6}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex justify-center gap-2">
        {weekDates.map((d, i) => {
          const dStr = fmt(d);
          const isT = dStr === todayStr;
          return (
            <button key={dStr} onClick={() => setDayIndex(i)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors ${i === dayIndex ? "bg-primary/10" : "hover:bg-muted/60"}`}>
              <span className="text-[10px] text-muted-foreground">{DAY_NAMES[d.getDay()]}</span>
              <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isT ? "bg-primary text-primary-foreground" : i === dayIndex ? "text-primary" : "text-foreground"}`}>
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <DayDetailPanel date={date} {...props} />
    </div>
  );
}

/* ─── Desktop Week View ─── */
function DesktopWeekView(props: {
  weekDates: Date[];
  plannedMeals: ApiPlannedMeal[];
  recipes: ApiRecipe[];
  chores: Chore[];
  tasks: Task[];
  openAssign: (date: string, slot: MealSlot, existing?: ApiPlannedMeal) => void;
  openLeftoverDialog: (meal: ApiPlannedMeal) => void;
  deleteMeal: { mutate: (id: number) => void };
  setFocusedRecipeId: (id: number | null) => void;
  setActiveTab: (tab: string) => void;
  setViewRecipe: (r: ApiRecipe | null) => void;
  onToggleChore: (id: string) => void;
  onToggleTask:  (id: string) => void;
}) {
  const { weekDates } = props;
  const todayStr = fmt(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const t = weekDates.find((d) => fmt(d) === todayStr);
    return t ?? weekDates[0];
  });

  return (
    <div className="space-y-4">
      {/* Day selector row */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date) => {
          const dateStr = fmt(date);
          const isToday = todayStr === dateStr;
          const isSelected = fmt(selectedDate) === dateStr;

          const dayMeals = props.plannedMeals.filter((m) => m.plan_date.slice(0, 10) === dateStr);
          const dayChores = props.chores.filter(c => !c.completed && (() => { const d = parseDateSafe(c.due_date); return d && isSameDay(d, date); })());
          const dayTasks  = props.tasks.filter(t  => !t.completed  && (() => { const d = parseDateSafe(t.due_date); return d && isSameDay(d, date); })());
          const totalItems = dayMeals.length + dayChores.length + dayTasks.length;

          return (
            <button key={dateStr} onClick={() => setSelectedDate(date)}
              className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary border-primary/40 bg-primary/5" : isToday ? "ring-1 ring-primary/30 border-primary/20" : "border-border hover:bg-muted/40"}`}>
              <p className="text-xs font-semibold text-muted-foreground">{DAY_NAMES[date.getDay()]}</p>
              <p className={`text-lg font-bold mt-0.5 ${isToday ? "text-primary" : "text-foreground"}`}>{date.getDate()}</p>
              {totalItems > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">{totalItems} item{totalItems !== 1 ? "s" : ""}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail panel for selected day */}
      <div className="mt-2">
        <p className="text-sm font-semibold text-muted-foreground mb-3">
          {format(selectedDate, "EEEE, MMMM d")}
          {fmt(selectedDate) === todayStr && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Today</span>}
        </p>
        <DayDetailPanel date={selectedDate} {...props} />
      </div>
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
  useEffect(() => { if (!userId) api.getOrCreateUserId().then(setUserId).catch(() => {}); }, [userId]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = fmt(weekDates[0]);
  const weekEnd   = fmt(weekDates[6]);

  // ── Queries ──
  const { data: recipes      = [] } = useQuery({ queryKey: ["recipes"],      queryFn: () => api.getRecipes() });
  const { data: categories   = [] } = useQuery({ queryKey: ["categories"],   queryFn: () => api.getCategories() });
  const { data: groups       = [] } = useQuery({ queryKey: ["pantry-groups"],queryFn: () => api.getGroups() });
  const { data: pantryItems  = [] } = useQuery({ queryKey: ["pantry"],       queryFn: () => api.getPantry() });
  const { data: plannedMeals = [] } = useQuery({ queryKey: ["planned-meals", weekStart, weekEnd], queryFn: () => api.getPlannedMeals(weekStart, weekEnd) });
  const { data: chores       = [] } = useQuery<Chore[]>({ queryKey: ["chores"], queryFn: () => fetch("/api/chores").then((r) => r.json()) });
  const { data: tasks        = [] } = useQuery<Task[]>({  queryKey: ["tasks"],  queryFn: () => fetch("/api/tasks").then((r) => r.json()) });

  const leftoversCategoryId = useMemo(() => categories.find((c) => c.name.toLowerCase() === "leftovers")?.id ?? null, [categories]);
  useEffect(() => {
    if (categories.length > 0 && leftoversCategoryId === null) {
      api.createCategory("Leftovers").then(() => qc.invalidateQueries({ queryKey: ["categories"] })).catch(() => {});
    }
  }, [categories, leftoversCategoryId]);

  // ── Chore/Task toggle mutations ──
  const toggleChore = useMutation({
    mutationFn: (id: string) => fetch(`/api/chores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chores"] }),
  });
  const toggleTask = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  // ── Recipe mutations ──
  const createRecipe = useMutation({
    mutationFn: (recipe: Omit<ApiRecipe, "id">) => api.createRecipe(recipe),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
    onError: (err) => toast({ title: "Failed to save recipe", description: String(err), variant: "destructive" }),
  });
  const deleteRecipe = useMutation({
    mutationFn: (id: number) => api.deleteRecipe(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipes"] }); qc.invalidateQueries({ queryKey: ["planned-meals"] }); },
    onError: (err) => toast({ title: "Failed to delete recipe", description: String(err), variant: "destructive" }),
  });

  // ── Planned meal mutations ──
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

  // ── Leftover dialog ──
  const [leftoverDialog, setLeftoverDialog] = useState<{ name: string; servings: string; groupId: number | null; newGroupName: string; frozen: boolean; refrigerated: boolean; expirationDate: string } | null>(null);
  const createLeftover = useMutation({
    mutationFn: async ({ name, servings, groupId, newGroupName, frozen, refrigerated, expirationDate }: { name: string; servings: number; groupId: number | null; newGroupName: string; frozen: boolean; refrigerated: boolean; expirationDate: string }) => {
      let resolvedGroupId = groupId;
      if (groupId === -1) {
        const trimmed = newGroupName.trim();
        if (trimmed) { const created = await api.createGroup(userId!, { name: trimmed, category_id: leftoversCategoryId }); qc.invalidateQueries({ queryKey: ["pantry-groups"] }); resolvedGroupId = created.id; }
        else resolvedGroupId = null;
      }
      return api.createPantryItem(userId!, { name, brand: null, category_id: leftoversCategoryId, group_id: resolvedGroupId, quantity: servings, unit: "servings", min_quantity: 1, expiration_date: expirationDate || null, frozen, refrigerated });
    },
    onSuccess: (_, { name }) => { qc.invalidateQueries({ queryKey: ["pantry"] }); toast({ title: `${name} added to pantry as leftovers` }); setLeftoverDialog(null); },
    onError: (err) => toast({ title: "Failed to save leftover", description: String(err), variant: "destructive" }),
  });
  const openLeftoverDialog = (meal: ApiPlannedMeal) => {
    const label = meal.custom_name ?? recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Leftovers";
    const recipe = recipes.find((r) => r.id === meal.recipe_id);
    setLeftoverDialog({ name: label, servings: String(recipe?.servings ?? 2), groupId: null, newGroupName: "", frozen: false, refrigerated: false, expirationDate: "" });
  };

  // ── Add recipe dialog ──
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [rName, setRName] = useState(""); const [rIngredients, setRIngredients] = useState("");
  const [rInstructions, setRInstructions] = useState(""); const [rServings, setRServings] = useState("4"); const [rTags, setRTags] = useState("");
  const addRecipe = () => {
    const name = rName.trim(); if (!name) return;
    createRecipe.mutate({ name, ingredients: rIngredients.split("\n").map((l) => l.trim()).filter(Boolean), instructions: rInstructions.trim() || null, servings: parseInt(rServings) || 4, tags: rTags.split(",").map((t) => t.trim()).filter(Boolean) }, {
      onSuccess: () => { toast({ title: `"${name}" added to recipes` }); setRName(""); setRIngredients(""); setRInstructions(""); setRServings("4"); setRTags(""); setRecipeOpen(false); },
    });
  };

  // ── Shopping list ──
  const { data: shoppingListLinks = [] } = useQuery({ queryKey: ["shopping-list-links", weekStart], queryFn: () => api.getShoppingListLinks(weekStart) });
  const linkedIngredients = useMemo(() => new Map<string, number>(shoppingListLinks.map((l) => [l.ingredient_name, l.pantry_item_id])), [shoppingListLinks]);
  const { data: pantryShoppingList = [] } = useQuery({ queryKey: ["shopping"], queryFn: () => api.getShopping() });
  const getMealLabel = (meal: ApiPlannedMeal) => meal.custom_name ?? recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Unknown";
  const shoppingList = useMemo(() => {
    const ingredientMap = new Map<string, Set<string>>();
    for (const meal of plannedMeals) {
      const mealName = getMealLabel(meal);
      const recipe = recipes.find((r) => r.id === meal.recipe_id);
      const ings: string[] = [];
      if (recipe) ings.push(...recipe.ingredients);
      if (meal.ingredients?.length) ings.push(...meal.ingredients);
      for (const ing of ings) { const key = ing.toLowerCase(); if (!ingredientMap.has(key)) ingredientMap.set(key, new Set()); ingredientMap.get(key)!.add(mealName); }
    }
    return Array.from(ingredientMap.entries()).map(([name, meals]) => ({ name, meals: Array.from(meals) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [plannedMeals, recipes]);
  const exportToPantryList = useMutation({
    mutationFn: async (items: string[]) => {
      const existingNames = new Set(pantryShoppingList.map((i) => i.item_name.toLowerCase()));
      const newItems = items.filter((name) => !existingNames.has(name.toLowerCase()));
      await Promise.all(newItems.map((name) => api.addShoppingItem(userId!, name)));
      return newItems.length;
    },
    onSuccess: (count) => { qc.invalidateQueries({ queryKey: ["shopping"] }); toast({ title: count === 0 ? "All items already on shopping list" : `${count} item${count === 1 ? "" : "s"} added to shopping list` }); },
    onError: (err) => toast({ title: "Failed to export", description: String(err), variant: "destructive" }),
  });

  // ── Assign meal dialog ──
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDate, setAssignDate] = useState(""); const [assignSlot, setAssignSlot] = useState<MealSlot>("dinner");
  const [assignRecipeId, setAssignRecipeId] = useState(""); const [assignCustom, setAssignCustom] = useState("");
  const [assignExistingId, setAssignExistingId] = useState<number | null>(null);
  const [assignLink, setAssignLink] = useState(""); const [assignIngredients, setAssignIngredients] = useState("");
  const openAssign = (date: string, slot: MealSlot, existing?: ApiPlannedMeal) => {
    setAssignDate(date); setAssignSlot(slot);
    setAssignRecipeId(existing?.recipe_id != null ? String(existing.recipe_id) : "");
    setAssignCustom(existing?.custom_name ?? ""); setAssignLink(existing?.link ?? "");
    setAssignIngredients(existing?.ingredients?.join("\n") ?? ""); setAssignExistingId(existing?.id ?? null);
    setAssignOpen(true);
  };
  const confirmAssign = () => {
    if (!assignRecipeId && !assignCustom.trim()) return;
    const recipe_id = assignRecipeId ? parseInt(assignRecipeId) : null;
    const custom_name = assignCustom.trim() || null;
    const link = assignLink.trim() || null;
    const ingredients = !recipe_id ? assignIngredients.split("\n").map((l) => l.trim()).filter(Boolean) : null;
    if (assignExistingId !== null) {
      updateMeal.mutate({ id: assignExistingId, recipe_id, custom_name, link, ingredients }, { onSuccess: () => setAssignOpen(false) });
    } else {
      createMeal.mutate({ plan_date: assignDate, slot: assignSlot, recipe_id, custom_name, link, ingredients }, { onSuccess: () => setAssignOpen(false) });
    }
  };

  const weekLabel = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekDates[0].toLocaleDateString(undefined, opts)} – ${weekDates[6].toLocaleDateString(undefined, opts)}`;
  }, [weekDates]);

  const sharedProps = {
    weekDates, plannedMeals, recipes, chores, tasks,
    openAssign, openLeftoverDialog, deleteMeal,
    setFocusedRecipeId, setActiveTab, setViewRecipe,
    onToggleChore: (id: string) => toggleChore.mutate(id),
    onToggleTask:  (id: string) => toggleTask.mutate(id),
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 sm:px-6 py-4">
          <Button variant="ghost" size="icon" asChild><Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Meal Planning</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Plan your weekly meals, save recipes, and auto-generate a shopping list.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "recipes") setFocusedRecipeId(null); }} className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="calendar" className="gap-1.5 flex-1 sm:flex-none"><UtensilsCrossed className="h-4 w-4" /><span className="hidden sm:inline">Weekly Plan</span><span className="sm:hidden">Plan</span></TabsTrigger>
            <TabsTrigger value="recipes"  className="gap-1.5 flex-1 sm:flex-none"><BookOpen className="h-4 w-4" />Recipes</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm sm:text-base">{weekLabel}</span>
                {weekOffset !== 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> Today
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            <div className="sm:hidden"><MobileDayView {...sharedProps} /></div>
            <div className="hidden sm:block"><DesktopWeekView {...sharedProps} /></div>

            {shoppingList.length > 0 && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="gap-1.5" disabled={exportToPantryList.isPending || !userId}
                  onClick={() => { const unlinked = shoppingList.filter(({ name }) => !linkedIngredients.has(name)).map(({ name }) => name); if (unlinked.length > 0) exportToPantryList.mutate(unlinked); else toast({ title: "All items are already on shopping list" }); }}>
                  <ShoppingCart className="h-4 w-4" />
                  <span className="hidden sm:inline">Export to Shopping List</span>
                  <span className="sm:hidden">Export</span>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recipes" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add Recipe</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Recipe</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Recipe name" value={rName} onChange={(e) => setRName(e.target.value)} />
                    <Textarea placeholder="Ingredients (one per line)" rows={4} value={rIngredients} onChange={(e) => setRIngredients(e.target.value)} />
                    <Textarea placeholder="Instructions" rows={3} value={rInstructions} onChange={(e) => setRInstructions(e.target.value)} />
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Servings" value={rServings} onChange={(e) => setRServings(e.target.value)} className="w-24" />
                      <Input placeholder="Tags (comma-separated)" value={rTags} onChange={(e) => setRTags(e.target.value)} className="flex-1" />
                    </div>
                    <Button onClick={addRecipe} className="w-full" disabled={createRecipe.isPending}>Save Recipe</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {recipes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recipes yet — add one to get started.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recipes.map((r) => (
                  <Card key={r.id} className={focusedRecipeId === r.id ? "ring-2 ring-primary/60" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <button className="text-left hover:text-primary transition-colors" onClick={() => setViewRecipe(r)}>{r.name}</button>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setViewRecipe(r)}><BookOpen className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteRecipe.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </CardTitle>
                      <CardDescription>{r.servings} servings{r.tags.length > 0 && ` · ${r.tags.join(", ")}`}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Ingredients:</p>
                      <ul className="list-disc list-inside">
                        {r.ingredients.slice(0, 5).map((ing, i) => <li key={i}>{ing}</li>)}
                        {r.ingredients.length > 5 && <li className="text-muted-foreground">+{r.ingredients.length - 5} more</li>}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Save as Leftover Dialog */}
      <Dialog open={!!leftoverDialog} onOpenChange={(open) => { if (!open) setLeftoverDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save as Leftover</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input value={leftoverDialog?.name ?? ""} onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Servings remaining</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} step={1} className="w-24" value={leftoverDialog?.servings ?? ""} onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, servings: e.target.value }))} />
                <span className="text-sm text-muted-foreground">servings</span>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Expiration date (optional)</Label><Input type="date" value={leftoverDialog?.expirationDate ?? ""} onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, expirationDate: e.target.value }))} /></div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={leftoverDialog?.frozen ?? false} onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, frozen: e.target.checked }))} />
                <Snowflake className="h-4 w-4 text-blue-400" /> Frozen
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={leftoverDialog?.refrigerated ?? false} onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, refrigerated: e.target.checked }))} />
                <Refrigerator className="h-4 w-4 text-cyan-500" /> Refrigerated
              </label>
            </div>
            <Button className="w-full" disabled={!leftoverDialog?.name.trim() || !userId || createLeftover.isPending}
              onClick={() => { if (!leftoverDialog?.name.trim()) return; createLeftover.mutate({ name: leftoverDialog.name.trim(), servings: parseInt(leftoverDialog.servings) || 1, groupId: leftoverDialog.groupId, newGroupName: leftoverDialog.newGroupName, frozen: leftoverDialog.frozen, refrigerated: leftoverDialog.refrigerated, expirationDate: leftoverDialog.expirationDate }); }}>
              <Archive className="h-4 w-4 mr-2" /> Add to Pantry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Meal Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{assignExistingId !== null ? "Edit" : "Add"} {SLOT_LABELS[assignSlot]} — {assignDate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {recipes.length > 0 && (
              <Select value={assignRecipeId} onValueChange={(v) => { setAssignRecipeId(v); setAssignCustom(""); }}>
                <SelectTrigger><SelectValue placeholder="Pick a recipe" /></SelectTrigger>
                <SelectContent>{recipes.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Input placeholder="Custom meal name" value={assignCustom} onChange={(e) => { setAssignCustom(e.target.value); setAssignRecipeId(""); }} />
            {!assignRecipeId && <Textarea placeholder="Ingredients (one per line, optional)" rows={4} value={assignIngredients} onChange={(e) => setAssignIngredients(e.target.value)} />}
            <Input placeholder="Link (optional)" value={assignLink} onChange={(e) => setAssignLink(e.target.value)} />
            <Button onClick={confirmAssign} className="w-full" disabled={createMeal.isPending || updateMeal.isPending}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipe Detail Dialog */}
      <Dialog open={!!viewRecipe} onOpenChange={(open) => { if (!open) setViewRecipe(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewRecipe?.name}</DialogTitle></DialogHeader>
          {viewRecipe && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{viewRecipe.servings} servings</span>
                {viewRecipe.tags.length > 0 && <><span>·</span><span>{viewRecipe.tags.join(", ")}</span></>}
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1.5">Ingredients</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">{viewRecipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}</ul>
              </div>
              {viewRecipe.instructions && (
                <div>
                  <p className="font-semibold text-foreground mb-1.5">Instructions</p>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{viewRecipe.instructions}</p>
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
