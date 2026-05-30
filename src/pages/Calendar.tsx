import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ListChecks, UtensilsCrossed, ClipboardList, CalendarDays,
  Sun, Cloud, Moon, Pencil, Archive, Snowflake, Refrigerator, Plus, Trash2, Clock,
} from "lucide-react";
import { api, ApiMember, ApiPlannedMeal, ApiRecipe, ApiCalendarEntry } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, startOfMonth, endOfMonth, isSameDay, isBefore } from "date-fns";

type Chore = { id: string; title: string; assignee_id: string | null; completed: boolean; due_date: string | null; recurrence?: string; time_of_day?: string | null; };
type Task  = { id: string; title: string; description?: string | null; assignee_id: string | null; completed: boolean; due_date: string | null; time_of_day?: string | null; scheduled_time?: string | null; };

function parseDateSafe(d: string | null): Date | null {
  if (!d) return null;
  try {
    const t = d.trim().slice(0, 10);
    const [y, m, day] = t.split("-").map(Number);
    if (!y || !m || !day) return null;
    return startOfDay(new Date(y, m - 1, day));
  } catch { return null; }
}

const SLOT_TO_TOD: Record<string, "morning" | "afternoon" | "evening"> = {
  breakfast: "morning", lunch: "afternoon", dinner: "evening",
};
const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
};
const TOD_MEAL_LABEL: Record<string, string> = {
  morning: "Breakfast", afternoon: "Lunch", evening: "Dinner",
};

const ENTRY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  rose:   { bg: "bg-rose-50",   border: "border-rose-200",   text: "text-rose-800",   dot: "bg-rose-400"   },
  blue:   { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800",   dot: "bg-blue-400"   },
  green:  { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800",  dot: "bg-green-400"  },
  amber:  { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  dot: "bg-amber-400"  },
  purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", dot: "bg-purple-400" },
};
const entryColorClasses = (color: string | null) =>
  ENTRY_COLORS[color ?? ""] ?? { bg: "bg-card", border: "border-border", text: "text-foreground", dot: "bg-primary" };
const ENTRY_COLOR_OPTIONS = ["", "rose", "blue", "green", "amber", "purple"] as const;

// ── Local-only hour-of-day overrides (no backend column) ──
const HOUR_STORE_KEY = "calendar_item_hours_v1";
type HourMap = Record<string, string>; // key: `task:${id}` | `chore:${id}` -> "HH:mm"
const loadHours = (): HourMap => {
  try { return JSON.parse(localStorage.getItem(HOUR_STORE_KEY) ?? "{}"); } catch { return {}; }
};
const saveHours = (m: HourMap) => localStorage.setItem(HOUR_STORE_KEY, JSON.stringify(m));

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM – 10 PM
const TOD_RANGES: { key: "morning" | "afternoon" | "evening"; label: string; hours: number[]; tint: string; headerTint: string }[] = [
  { key: "morning",   label: "Morning",   hours: [6, 7, 8, 9, 10, 11],         tint: "bg-primary/5",  headerTint: "bg-primary/10" },
  { key: "afternoon", label: "Afternoon", hours: [12, 13, 14, 15, 16, 17],     tint: "bg-primary/10", headerTint: "bg-primary/20" },
  { key: "evening",   label: "Evening",   hours: [18, 19, 20, 21, 22],         tint: "bg-primary/15", headerTint: "bg-primary/25" },
];
const fmtHour = (h: number) => {
  const d = new Date(); d.setHours(h, 0, 0, 0);
  return format(d, "h a");
};
const hourFromTime = (t?: string | null): number | null => {
  if (!t) return null;
  const [h] = t.split(":").map(Number);
  return Number.isFinite(h) ? h : null;
};

type TODSection = {
  key: "morning" | "afternoon" | "evening";
  label: string; icon: React.ReactNode;
  meals: ApiPlannedMeal[]; chores: Chore[]; tasks: Task[]; entries: ApiCalendarEntry[];
};

const CalendarPage = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));
  const [hourMap, setHourMap] = useState<HourMap>(() => loadHours());
  const setHour = (key: string, time: string | null) => {
    setHourMap((prev) => {
      const next = { ...prev };
      if (!time) delete next[key]; else next[key] = time;
      saveHours(next);
      return next;
    });
  };

  const monthStart = format(startOfMonth(viewMonth), "yyyy-MM-dd");
  const monthEnd   = format(endOfMonth(viewMonth),   "yyyy-MM-dd");

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const [userId, setUserId] = useState<string | null>(() => {
    const s = localStorage.getItem("home_hub_user_id");
    return s && UUID_RE.test(s) ? s : null;
  });
  useEffect(() => { if (!userId) api.getOrCreateUserId().then(setUserId).catch(() => {}); }, [userId]);

  // ── Queries ──
  const { data: members  = [] } = useQuery<ApiMember[]>({ queryKey: ["members"],  queryFn: () => api.getMembers() });
  const { data: chores   = [] } = useQuery<Chore[]>({    queryKey: ["chores"],    queryFn: () => fetch("/api/chores").then((r) => r.json()) });
  const { data: tasks    = [] } = useQuery<Task[]>({     queryKey: ["tasks"],     queryFn: () => fetch("/api/tasks").then((r) => r.json()) });
  const { data: meals    = [] } = useQuery<ApiPlannedMeal[]>({ queryKey: ["planned-meals", monthStart, monthEnd], queryFn: () => api.getPlannedMeals(monthStart, monthEnd) });
  const { data: recipes  = [] } = useQuery<ApiRecipe[]>({ queryKey: ["recipes"],  queryFn: () => api.getRecipes() });
  const { data: calEntries = [] } = useQuery<ApiCalendarEntry[]>({ queryKey: ["calendar-entries", monthStart, monthEnd], queryFn: () => api.getCalendarEntries(monthStart, monthEnd) });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => api.getCategories() });

  const leftoversCategoryId = useMemo(() => categories.find((c) => c.name.toLowerCase() === "leftovers")?.id ?? null, [categories]);
  useEffect(() => {
    if (categories.length > 0 && leftoversCategoryId === null) {
      api.createCategory("Leftovers").then(() => qc.invalidateQueries({ queryKey: ["categories"] })).catch(() => {});
    }
  }, [categories, leftoversCategoryId]);

  // ── Mutations ──
  const completeChore = useMutation({
    mutationFn: (id: string) => fetch(`/api/chores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chores"] }),
  });
  const completeTask = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const saveTask = useMutation({
    mutationFn: async (payload: { id?: string; title: string; description: string | null; assignee_id: string | null; due_date: string | null; time_of_day: string; scheduled_time: string | null; }) => {
      const { id, ...body } = payload;
      const url = id ? `/api/tasks/${id}` : `/api/tasks`;
      const method = id ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (err) => toast({ title: "Failed to save task", description: String(err), variant: "destructive" }),
  });
  const deleteTask = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const saveEntry = useMutation({
    mutationFn: async (payload: { id?: string; entry_date: string; title: string; description: string | null; all_day: boolean; start_time: string | null; end_time: string | null; time_of_day: string; color: string | null; }) => {
      const { id, ...body } = payload;
      const url = id ? `/api/calendar-entries/${id}` : `/api/calendar-entries`;
      const method = id ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-entries"] }),
    onError: (err) => toast({ title: "Failed to save entry", description: String(err), variant: "destructive" }),
  });
  const deleteEntry = useMutation({
    mutationFn: (id: string) => fetch(`/api/calendar-entries/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-entries"] }),
  });

  // ── Entry dialog (add/edit) ──
  type EntryDraft = {
    id?: string; title: string; description: string;
    all_day: boolean; start_time: string; end_time: string;
    time_of_day: "morning" | "afternoon" | "evening" | "all_day"; color: string;
  };
  const emptyEntryDraft = (): EntryDraft => ({ title: "", description: "", all_day: true, start_time: "", end_time: "", time_of_day: "all_day", color: "" });
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(emptyEntryDraft());

  const openNewEntry = (preset?: { tod?: "morning" | "afternoon" | "evening" }) => {
    const d = emptyEntryDraft();
    if (preset?.tod) { d.all_day = false; d.time_of_day = preset.tod; }
    setEntryDraft(d);
    setEntryDialogOpen(true);
  };
  const openEditEntry = (e: ApiCalendarEntry) => {
    setEntryDraft({ id: e.id, title: e.title, description: e.description ?? "", all_day: e.all_day, start_time: e.start_time ?? "", end_time: e.end_time ?? "", time_of_day: e.time_of_day, color: e.color ?? "" });
    setEntryDialogOpen(true);
  };
  const confirmEntry = () => {
    if (!entryDraft.title.trim()) return;
    let time_of_day: string = entryDraft.time_of_day;
    if (entryDraft.all_day) { time_of_day = "all_day"; }
    else if (entryDraft.start_time) {
      const h = parseInt(entryDraft.start_time.split(":")[0], 10);
      time_of_day = h >= 18 ? "evening" : h >= 12 ? "afternoon" : "morning";
    } else if (time_of_day === "all_day") { time_of_day = "morning"; }
    saveEntry.mutate({
      id: entryDraft.id, entry_date: format(selectedDate, "yyyy-MM-dd"),
      title: entryDraft.title.trim(), description: entryDraft.description.trim() || null,
      all_day: entryDraft.all_day, start_time: entryDraft.start_time || null, end_time: entryDraft.end_time || null,
      time_of_day, color: entryDraft.color || null,
    }, { onSuccess: () => setEntryDialogOpen(false) });
  };
  const updateMeal = useMutation({
    mutationFn: ({ id, recipe_id, custom_name, link, ingredients }: { id: number; recipe_id: number | null; custom_name: string | null; link: string | null; ingredients: string[] | null }) =>
      api.updatePlannedMeal(id, recipe_id, custom_name, link, ingredients),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planned-meals"] }),
    onError: (err) => toast({ title: "Failed to update meal", description: String(err), variant: "destructive" }),
  });
  const createLeftover = useMutation({
    mutationFn: async ({ name, servings, frozen, refrigerated, expirationDate }: { name: string; servings: number; frozen: boolean; refrigerated: boolean; expirationDate: string }) => {
      return api.createPantryItem(userId!, { name, brand: null, category_id: leftoversCategoryId, group_id: null, quantity: servings, unit: "servings", min_quantity: 1, expiration_date: expirationDate || null, frozen, refrigerated });
    },
    onSuccess: (_, { name }) => { qc.invalidateQueries({ queryKey: ["pantry"] }); toast({ title: `${name} added to pantry as leftovers` }); setLeftoverDialog(null); },
    onError: (err) => toast({ title: "Failed to save leftover", description: String(err), variant: "destructive" }),
  });

  // ── Edit meal dialog ──
  const [editOpen, setEditOpen] = useState(false);
  const [editMeal, setEditMeal] = useState<ApiPlannedMeal | null>(null);
  const [editRecipeId, setEditRecipeId] = useState("");
  const [editCustom, setEditCustom] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editIngredients, setEditIngredients] = useState("");

  const openEditMeal = (meal: ApiPlannedMeal) => {
    setEditMeal(meal);
    setEditRecipeId(meal.recipe_id != null ? String(meal.recipe_id) : "");
    setEditCustom(meal.custom_name ?? "");
    setEditLink(meal.link ?? "");
    setEditIngredients(meal.ingredients?.join("\n") ?? "");
    setEditOpen(true);
  };
  const confirmEdit = () => {
    if (!editMeal) return;
    const recipe_id = editRecipeId ? parseInt(editRecipeId) : null;
    const custom_name = editCustom.trim() || null;
    const link = editLink.trim() || null;
    const ingredients = !recipe_id ? editIngredients.split("\n").map((l) => l.trim()).filter(Boolean) : null;
    updateMeal.mutate({ id: editMeal.id, recipe_id, custom_name, link, ingredients }, { onSuccess: () => setEditOpen(false) });
  };

  // ── Task dialog (add/edit) ──
  type TaskDraft = {
    id?: string; title: string; description: string;
    assignee_id: string; time_of_day: "morning" | "afternoon" | "evening";
    time: string; // "" or "HH:mm"
  };
  const emptyDraft = (): TaskDraft => ({ id: undefined, title: "", description: "", assignee_id: "unassigned", time_of_day: "afternoon", time: "" });
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyDraft());

  const openNewTask = (preset?: { hour?: number; tod?: "morning" | "afternoon" | "evening" }) => {
    const d = emptyDraft();
    if (preset?.hour !== undefined) d.time = `${String(preset.hour).padStart(2, "0")}:00`;
    if (preset?.tod) d.time_of_day = preset.tod;
    setTaskDraft(d);
    setTaskDialogOpen(true);
  };
  const openEditTask = (t: Task) => {
    setTaskDraft({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      assignee_id: t.assignee_id ?? "unassigned",
      time_of_day: (t.time_of_day as "morning" | "afternoon" | "evening") ?? "afternoon",
      time: t.scheduled_time ?? "",
    });
    setTaskDialogOpen(true);
  };
  const confirmTask = () => {
    if (!taskDraft.title.trim()) return;
    const due_date = format(selectedDate, "yyyy-MM-dd");
    saveTask.mutate({
      id: taskDraft.id,
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || null,
      assignee_id: taskDraft.assignee_id === "unassigned" ? null : taskDraft.assignee_id,
      due_date,
      time_of_day: taskDraft.time_of_day,
      scheduled_time: taskDraft.time || null,
    }, {
      onSuccess: () => setTaskDialogOpen(false),
    });
  };

  // ── Leftover dialog ──
  const [leftoverDialog, setLeftoverDialog] = useState<{ name: string; servings: string; frozen: boolean; refrigerated: boolean; expirationDate: string } | null>(null);
  const openLeftover = (meal: ApiPlannedMeal) => {
    const label = meal.custom_name ?? recipes.find((r) => r.id === meal.recipe_id)?.name ?? "Leftovers";
    const recipe = recipes.find((r) => r.id === meal.recipe_id);
    setLeftoverDialog({ name: label, servings: String(recipe?.servings ?? 2), frozen: false, refrigerated: false, expirationDate: "" });
  };

  // ── Helpers ──
  const memberName = (id: string | null) => !id ? "Unassigned" : members.find((m) => m.id === id)?.name ?? "Unknown";
  const recipeName = (id: number | null) => !id ? null : recipes.find((r) => r.id === id)?.name ?? null;
  const mealLabel  = (m: ApiPlannedMeal) => recipeName(m.recipe_id) ?? m.custom_name ?? "Untitled meal";

  const today = startOfDay(new Date());
  const selectedKey = format(selectedDate, "yyyy-MM-dd");

  // ── Aggregation ──
  const itemsByDay = useMemo(() => {
    const map = new Map<string, { chores: Chore[]; tasks: Task[]; meals: ApiPlannedMeal[]; entries: ApiCalendarEntry[] }>();
    const ensure = (key: string) => { if (!map.has(key)) map.set(key, { chores: [], tasks: [], meals: [], entries: [] }); return map.get(key)!; };
    chores.forEach((c) => { const d = parseDateSafe(c.due_date); if (d) ensure(format(d, "yyyy-MM-dd")).chores.push(c); });
    tasks.forEach((t)  => { const d = parseDateSafe(t.due_date);  if (d) ensure(format(d, "yyyy-MM-dd")).tasks.push(t); });
    meals.forEach((m)  => { ensure(m.plan_date.slice(0, 10)).meals.push(m); });
    calEntries.forEach((e) => { ensure(e.entry_date.slice(0, 10)).entries.push(e); });
    return map;
  }, [chores, tasks, meals, calEntries]);

  const dayItems = itemsByDay.get(selectedKey) ?? { chores: [], tasks: [], meals: [], entries: [] };

  // Split day items into "hourly" (has hour) and "unscheduled" (no hour, grouped by TOD)
  const { hourlyByHour, todSections, allDayEntries } = useMemo(() => {
    const hourly = new Map<number, { meals: ApiPlannedMeal[]; chores: Chore[]; tasks: Task[]; entries: ApiCalendarEntry[] }>();
    const ensureH = (h: number) => { if (!hourly.has(h)) hourly.set(h, { meals: [], chores: [], tasks: [], entries: [] }); return hourly.get(h)!; };

    const morning:   TODSection = { key: "morning",   label: "Morning",   icon: <Sun   className="h-4 w-4 text-yellow-500" />, meals: [], chores: [], tasks: [], entries: [] };
    const afternoon: TODSection = { key: "afternoon", label: "Afternoon", icon: <Cloud className="h-4 w-4 text-blue-400"   />, meals: [], chores: [], tasks: [], entries: [] };
    const evening:   TODSection = { key: "evening",   label: "Evening",   icon: <Moon  className="h-4 w-4 text-indigo-400" />, meals: [], chores: [], tasks: [], entries: [] };
    const sections = { morning, afternoon, evening };

    const allDay: ApiCalendarEntry[] = [];

    dayItems.entries.forEach((e) => {
      if (e.all_day) { allDay.push(e); return; }
      const h = hourFromTime(e.start_time);
      if (h !== null) ensureH(h).entries.push(e);
      else { const tod = (e.time_of_day === "all_day" ? "morning" : e.time_of_day) as "morning" | "afternoon" | "evening"; sections[tod].entries.push(e); }
    });
    dayItems.meals.forEach((m) => { sections[SLOT_TO_TOD[m.slot] ?? "afternoon"].meals.push(m); });
    dayItems.chores.forEach((c) => {
      const h = hourFromTime(hourMap[`chore:${c.id}`]);
      if (h !== null) ensureH(h).chores.push(c);
      else { const tod = (c.time_of_day as "morning" | "afternoon" | "evening") ?? "afternoon"; sections[tod].chores.push(c); }
    });
    dayItems.tasks.forEach((t) => {
      const h = hourFromTime(t.scheduled_time);
      if (h !== null) ensureH(h).tasks.push(t);
      else { const tod = (t.time_of_day as "morning" | "afternoon" | "evening") ?? "afternoon"; sections[tod].tasks.push(t); }
    });

    return { hourlyByHour: hourly, todSections: [morning, afternoon, evening] as TODSection[], allDayEntries: allDay };
  }, [dayItems, hourMap]);

  const overdue = useMemo(() => ({
    chores: chores.filter((c) => { const d = parseDateSafe(c.due_date); return !c.completed && d && isBefore(d, today); }),
    tasks:  tasks.filter((t)  => { const d = parseDateSafe(t.due_date); return !t.completed && d && isBefore(d, today); }),
  }), [chores, tasks]);

  const daysWithItems = useMemo(() => {
    const dates: Date[] = [];
    itemsByDay.forEach((_, key) => { const d = parseDateSafe(key); if (d) dates.push(d); });
    return dates;
  }, [itemsByDay]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          </Button>
          <div className="flex items-center gap-2 text-primary">
            <CalendarDays className="h-5 w-5" />
            <span className="font-serif text-xl font-bold tracking-tight">Calendar</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="space-y-6">
          <Card className="shadow-[var(--card-shadow)]">
            <CardContent className="p-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(startOfDay(d))}
                month={viewMonth}
                onMonthChange={setViewMonth}
                modifiers={{ hasItems: daysWithItems }}
                modifiersClassNames={{ hasItems: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary" }}
                className="pointer-events-auto"
              />
            </CardContent>
          </Card>

          {(overdue.chores.length > 0 || overdue.tasks.length > 0) && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Overdue</CardTitle>
                <CardDescription>Past due and not yet completed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdue.chores.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={c.completed} onCheckedChange={() => completeChore.mutate(c.id)} />
                      <ListChecks className="h-4 w-4 text-primary" /><span>{c.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{c.due_date?.slice(0, 10)}</span>
                  </div>
                ))}
                {overdue.tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={t.completed} onCheckedChange={() => completeTask.mutate(t.id)} />
                      <ClipboardList className="h-4 w-4 text-primary" /><span>{t.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.due_date?.slice(0, 10)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="shadow-[var(--card-shadow)]">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="font-serif text-2xl">
                {isSameDay(selectedDate, today) ? "Today — " : ""}{format(selectedDate, "EEEE, MMMM d")}
              </CardTitle>
              <CardDescription>Everything scheduled for this day</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => openNewEntry()}>
                <Plus className="h-4 w-4" /> Add entry
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNewTask()}>
                <Plus className="h-4 w-4" /> Add task
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* All-day entries banner */}
            {allDayEntries.length > 0 && (
              <div className="rounded-md border bg-primary/5 px-3 py-2 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> All Day
                </p>
                {allDayEntries.map((e) => {
                  const c = entryColorClasses(e.color);
                  return (
                    <div key={e.id} className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${c.bg} ${c.border}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
                        <span className={`text-sm font-semibold truncate ${c.text}`}>{e.title}</span>
                        {e.description && <span className="text-xs text-muted-foreground truncate hidden sm:inline">{e.description}</span>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0" onClick={() => openEditEntry(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hourly timeline grouped by part of day */}
            <section>
              <div className="overflow-hidden rounded-md border">
                {TOD_RANGES.map((range) => {
                  const section = todSections.find((s) => s.key === range.key)!;
                  const unscheduledTotal = section.chores.length + section.tasks.length;
                  return (
                    <div key={range.key} className={range.tint}>
                      {/* Part-of-day header */}
                      <div className={`flex items-center gap-2 px-3 py-2 ${range.headerTint} border-y first:border-t-0`}>
                        {range.key === "morning" && <Sun className="h-4 w-4 text-primary" />}
                        {range.key === "afternoon" && <Cloud className="h-4 w-4 text-primary" />}
                        {range.key === "evening" && <Moon className="h-4 w-4 text-primary" />}
                        <h3 className="text-sm font-semibold text-foreground">{range.label}</h3>
                        <span className="text-xs text-muted-foreground">
                          {fmtHour(range.hours[0])} – {fmtHour(range.hours[range.hours.length - 1])}
                        </span>
                      </div>

                      {/* Meal plan sub-section — Breakfast / Lunch / Dinner */}
                      {section.meals.length > 0 && (
                        <div className="px-3 py-2 space-y-1 border-b border-primary/10">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                            <UtensilsCrossed className="h-3 w-3" />
                            {TOD_MEAL_LABEL[range.key]}
                          </p>
                          {section.meals.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <UtensilsCrossed className="h-4 w-4 text-primary shrink-0" />
                                {m.link ? (
                                  <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline hover:text-primary/80 truncate">{mealLabel(m)}</a>
                                ) : (
                                  <span className="text-sm truncate">{mealLabel(m)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditMeal(m)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-green-600" onClick={() => openLeftover(m)}>
                                  <Archive className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Events sub-section (un-timed calendar entries) */}
                      {section.entries.length > 0 && (
                        <div className="px-3 py-2 space-y-1 border-b border-primary/10">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                            <CalendarDays className="h-3 w-3" /> Events
                          </p>
                          {section.entries.map((e) => {
                            const c = entryColorClasses(e.color);
                            return (
                              <div key={e.id} className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${c.bg} ${c.border}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
                                  <span className={`text-sm font-medium truncate ${c.text}`}>{e.title}</span>
                                  {e.description && <span className="text-xs text-muted-foreground truncate hidden sm:inline">{e.description}</span>}
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0" onClick={() => openEditEntry(e)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Unscheduled chores and tasks (no specific hour) */}
                      {unscheduledTotal > 0 && (
                        <div className="px-3 py-2 space-y-1 border-b border-primary/10">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Any time</p>
                          {section.chores.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <Checkbox checked={c.completed} onCheckedChange={() => completeChore.mutate(c.id)} />
                                <ListChecks className="h-4 w-4 text-primary shrink-0" />
                                <span className={`text-sm truncate ${c.completed ? "line-through text-muted-foreground" : ""}`}>{c.title}</span>
                                {c.recurrence && c.recurrence !== "none" && <Badge variant="outline" className="text-xs">{c.recurrence}</Badge>}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{memberName(c.assignee_id)}</span>
                            </div>
                          ))}
                          {section.tasks.map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <Checkbox checked={t.completed} onCheckedChange={() => completeTask.mutate(t.id)} />
                                <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                                <span className={`text-sm truncate ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-muted-foreground">{memberName(t.assignee_id)}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTask(t)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Hour rows */}
                      <div className="divide-y divide-primary/10">
                        {range.hours.map((h) => {
                          const bucket = hourlyByHour.get(h);
                          const total = (bucket?.meals.length ?? 0) + (bucket?.chores.length ?? 0) + (bucket?.tasks.length ?? 0);
                          return (
                            <div key={h} className="group grid grid-cols-[64px_1fr_auto] items-start gap-3 px-3 py-2 hover:bg-primary/10 transition-colors">
                              <div className="text-xs font-medium text-muted-foreground pt-1">{fmtHour(h)}</div>
                              <div className="space-y-1 min-h-[28px]">
                                {bucket?.entries.map((e) => {
                                  const c = entryColorClasses(e.color);
                                  return (
                                    <div key={e.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${c.bg} ${c.border}`}>
                                      <div className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
                                      <span className={`text-sm font-medium truncate ${c.text}`}>{e.title}</span>
                                      {e.end_time && <span className="text-xs text-muted-foreground shrink-0">– {e.end_time}</span>}
                                      <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => openEditEntry(e)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  );
                                })}
                                {bucket?.meals.map((m) => (
                                  <div key={m.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                                    <UtensilsCrossed className="h-4 w-4 text-primary shrink-0" />
                                    {m.link ? (
                                      <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline hover:text-primary/80 transition-colors">{mealLabel(m)}</a>
                                    ) : (
                                      <span className="text-sm">{mealLabel(m)}</span>
                                    )}
                                    <span className="text-xs text-muted-foreground capitalize">· {SLOT_LABELS[m.slot] ?? m.slot}</span>
                                  </div>
                                ))}
                                {bucket?.chores.map((c) => (
                                  <div key={c.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                                    <Checkbox checked={c.completed} onCheckedChange={() => completeChore.mutate(c.id)} />
                                    <ListChecks className="h-4 w-4 text-primary shrink-0" />
                                    <span className={`text-sm ${c.completed ? "line-through text-muted-foreground" : ""}`}>{c.title}</span>
                                    <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-destructive" onClick={() => setHour(`chore:${c.id}`, null)}>clear time</button>
                                  </div>
                                ))}
                                {bucket?.tasks.map((t) => (
                                  <div key={t.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                                    <Checkbox checked={t.completed} onCheckedChange={() => completeTask.mutate(t.id)} />
                                    <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                                    <span className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                                    <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => openEditTask(t)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                title="Add task at this hour"
                                onClick={() => openNewTask({ hour: h })}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              {total === 0 && <div className="sr-only">empty</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </CardContent>
        </Card>
      </main>


      {/* Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entryDraft.id ? "Edit entry" : "Add entry"} — {format(selectedDate, "MMM d")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input autoFocus value={entryDraft.title} onChange={(e) => setEntryDraft({ ...entryDraft, title: e.target.value })} placeholder="What's happening?" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={entryDraft.description} onChange={(e) => setEntryDraft({ ...entryDraft, description: e.target.value })} placeholder="Details" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={entryDraft.all_day} onChange={(e) => setEntryDraft({ ...entryDraft, all_day: e.target.checked, start_time: "", end_time: "", time_of_day: e.target.checked ? "all_day" : "morning" })} />
              All day
            </label>
            {!entryDraft.all_day && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start time (optional)</Label>
                  <Input type="time" value={entryDraft.start_time} onChange={(e) => setEntryDraft({ ...entryDraft, start_time: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>End time (optional)</Label>
                  <Input type="time" value={entryDraft.end_time} onChange={(e) => setEntryDraft({ ...entryDraft, end_time: e.target.value })} />
                </div>
              </div>
            )}
            {!entryDraft.all_day && !entryDraft.start_time && (
              <div className="space-y-1.5">
                <Label>Part of day</Label>
                <Select value={entryDraft.time_of_day === "all_day" ? "morning" : entryDraft.time_of_day} onValueChange={(v) => setEntryDraft({ ...entryDraft, time_of_day: v as EntryDraft["time_of_day"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                {ENTRY_COLOR_OPTIONS.map((col) => {
                  const c = entryColorClasses(col || null);
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEntryDraft({ ...entryDraft, color: col })}
                      className={`h-6 w-6 rounded-full border-2 transition-all ${col === "" ? "bg-muted border-border" : `${c.dot}`} ${entryDraft.color === col ? "ring-2 ring-offset-1 ring-primary scale-110" : "opacity-70 hover:opacity-100"}`}
                      title={col || "default"}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between gap-2">
            {entryDraft.id ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (entryDraft.id) { deleteEntry.mutate(entryDraft.id); setEntryDialogOpen(false); } }}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>Cancel</Button>
              <Button onClick={confirmEntry} disabled={!entryDraft.title.trim() || saveEntry.isPending}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{taskDraft.id ? "Edit task" : "Add task"} — {format(selectedDate, "MMM d")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={taskDraft.title} autoFocus onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder="What needs doing?" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={taskDraft.description} rows={2} onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })} placeholder="Optional notes" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Time (optional)</Label>
                <Input type="time" value={taskDraft.time} onChange={(e) => setTaskDraft({ ...taskDraft, time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Or part of day</Label>
                <Select value={taskDraft.time_of_day} onValueChange={(v) => setTaskDraft({ ...taskDraft, time_of_day: v as TaskDraft["time_of_day"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={taskDraft.assignee_id} onValueChange={(v) => setTaskDraft({ ...taskDraft, assignee_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between gap-2">
            {taskDraft.id ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => {
                if (taskDraft.id) {
                  deleteTask.mutate(taskDraft.id);
                  setHour(`task:${taskDraft.id}`, null);
                  setTaskDialogOpen(false);
                }
              }}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
              <Button onClick={confirmTask} disabled={!taskDraft.title.trim() || saveTask.isPending}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Meal Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editMeal ? (SLOT_LABELS[editMeal.slot] ?? editMeal.slot) : ""} — {format(selectedDate, "MMM d")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {recipes.length > 0 && (
              <Select value={editRecipeId} onValueChange={(v) => { setEditRecipeId(v); setEditCustom(""); }}>
                <SelectTrigger><SelectValue placeholder="Pick a recipe" /></SelectTrigger>
                <SelectContent>{recipes.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Input placeholder="Custom meal name" value={editCustom} onChange={(e) => { setEditCustom(e.target.value); setEditRecipeId(""); }} />
            {!editRecipeId && (
              <Textarea placeholder="Ingredients (one per line, optional)" rows={4} value={editIngredients} onChange={(e) => setEditIngredients(e.target.value)} />
            )}
            <Input placeholder="Link (optional)" value={editLink} onChange={(e) => setEditLink(e.target.value)} />
            <Button onClick={confirmEdit} className="w-full" disabled={updateMeal.isPending}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leftover Dialog */}
      <Dialog open={!!leftoverDialog} onOpenChange={(open) => { if (!open) setLeftoverDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save as Leftover</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label>
              <Input value={leftoverDialog?.name ?? ""} onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Servings remaining</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} className="w-24" value={leftoverDialog?.servings ?? ""} onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, servings: e.target.value }))} />
                <span className="text-sm text-muted-foreground">servings</span>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Expiration date (optional)</Label>
              <Input type="date" value={leftoverDialog?.expirationDate ?? ""} onChange={(e) => setLeftoverDialog((p) => p && ({ ...p, expirationDate: e.target.value }))} />
            </div>
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
              onClick={() => { if (!leftoverDialog?.name.trim()) return; createLeftover.mutate({ name: leftoverDialog.name.trim(), servings: parseInt(leftoverDialog.servings) || 1, frozen: leftoverDialog.frozen, refrigerated: leftoverDialog.refrigerated, expirationDate: leftoverDialog.expirationDate }); }}>
              <Archive className="h-4 w-4 mr-2" /> Add to Pantry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
