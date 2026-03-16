import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Home,
  ChevronLeft,
  ChevronRight,
  Plus,
  UtensilsCrossed,
  BookOpen,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─── */
interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  instructions: string;
  servings: number;
  tags: string[];
}

type MealSlot = "breakfast" | "lunch" | "dinner";

interface PlannedMeal {
  id: string;
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  recipeId?: string;
  customName?: string;
}

/* ─── Helpers ─── */
const STORAGE_RECIPES = "homebase_recipes";
const STORAGE_MEALS = "homebase_meals";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getWeekDates(offset: number): Date[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() + offset * 7); // Sunday
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
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Recipes
  const [recipes, setRecipes] = useState<Recipe[]>(() => loadJson(STORAGE_RECIPES, []));
  const saveRecipes = (r: Recipe[]) => {
    setRecipes(r);
    localStorage.setItem(STORAGE_RECIPES, JSON.stringify(r));
  };

  // Meals
  const [meals, setMeals] = useState<PlannedMeal[]>(() => loadJson(STORAGE_MEALS, []));
  const saveMeals = (m: PlannedMeal[]) => {
    setMeals(m);
    localStorage.setItem(STORAGE_MEALS, JSON.stringify(m));
  };

  // Add recipe dialog
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [rName, setRName] = useState("");
  const [rIngredients, setRIngredients] = useState("");
  const [rInstructions, setRInstructions] = useState("");
  const [rServings, setRServings] = useState("4");
  const [rTags, setRTags] = useState("");

  const addRecipe = () => {
    const name = rName.trim();
    if (!name) return;
    const recipe: Recipe = {
      id: crypto.randomUUID(),
      name,
      ingredients: rIngredients
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      instructions: rInstructions.trim(),
      servings: parseInt(rServings) || 4,
      tags: rTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    saveRecipes([...recipes, recipe]);
    toast({ title: `"${name}" added to recipes` });
    setRName("");
    setRIngredients("");
    setRInstructions("");
    setRServings("4");
    setRTags("");
    setRecipeOpen(false);
  };

  const deleteRecipe = (id: string) => {
    saveRecipes(recipes.filter((r) => r.id !== id));
    saveMeals(meals.filter((m) => m.recipeId !== id));
  };

  // Assign meal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDate, setAssignDate] = useState("");
  const [assignSlot, setAssignSlot] = useState<MealSlot>("dinner");
  const [assignRecipeId, setAssignRecipeId] = useState("");
  const [assignCustom, setAssignCustom] = useState("");

  const openAssign = (date: string, slot: MealSlot) => {
    setAssignDate(date);
    setAssignSlot(slot);
    setAssignRecipeId("");
    setAssignCustom("");
    setAssignOpen(true);
  };

  const confirmAssign = () => {
    if (!assignRecipeId && !assignCustom.trim()) return;
    const meal: PlannedMeal = {
      id: crypto.randomUUID(),
      date: assignDate,
      slot: assignSlot,
      recipeId: assignRecipeId || undefined,
      customName: assignCustom.trim() || undefined,
    };
    saveMeals([...meals.filter((m) => !(m.date === assignDate && m.slot === assignSlot)), meal]);
    setAssignOpen(false);
  };

  const removeMeal = (date: string, slot: MealSlot) => {
    saveMeals(meals.filter((m) => !(m.date === date && m.slot === slot)));
  };

  const getMeal = (date: string, slot: MealSlot) => meals.find((m) => m.date === date && m.slot === slot);

  const getMealLabel = (meal: PlannedMeal) => {
    if (meal.customName) return meal.customName;
    const r = recipes.find((r) => r.id === meal.recipeId);
    return r?.name ?? "Unknown";
  };

  // Shopping list from current week
  const shoppingList = useMemo(() => {
    const weekDateStrs = weekDates.map(fmt);
    const weekMeals = meals.filter((m) => weekDateStrs.includes(m.date));
    const ingredientMap = new Map<string, number>();
    for (const meal of weekMeals) {
      const recipe = recipes.find((r) => r.id === meal.recipeId);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        ingredientMap.set(ing.toLowerCase(), (ingredientMap.get(ing.toLowerCase()) || 0) + 1);
      }
    }
    return Array.from(ingredientMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [meals, recipes, weekDates]);

  const weekLabel = useMemo(() => {
    const s = weekDates[0];
    const e = weekDates[6];
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
  }, [weekDates]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-primary">
            <Home className="h-5 w-5" />
            <span className="font-serif text-xl font-bold tracking-tight">HomeBase</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/dashboard">
              <ChevronLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-2">
            <UtensilsCrossed className="h-7 w-7 text-primary" /> Meal Planning
          </h1>
          <p className="mt-1 text-muted-foreground">
            Plan your weekly meals, save recipes, and auto-generate a shopping list.
          </p>
        </div>

        <Tabs defaultValue="calendar" className="space-y-6">
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
                        const meal = getMeal(dateStr, slot);
                        return (
                          <div key={slot}>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {SLOT_LABELS[slot]}
                            </p>
                            {meal ? (
                              <div className="flex items-center gap-1 group">
                                <span className="text-xs text-foreground truncate flex-1">
                                  {getMealLabel(meal)}
                                </span>
                                <button
                                  onClick={() => removeMeal(dateStr, slot)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => openAssign(dateStr, slot)}
                                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                + add
                              </button>
                            )}
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
                    <Button onClick={addRecipe} className="w-full">
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
                  <Card key={r.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        {r.name}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteRecipe(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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

      {/* Assign Meal Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {SLOT_LABELS[assignSlot]} — {assignDate}
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
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Input
              placeholder="Custom meal name"
              value={assignCustom}
              onChange={(e) => { setAssignCustom(e.target.value); setAssignRecipeId(""); }}
            />
            <Button onClick={confirmAssign} className="w-full">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MealPlanning;
