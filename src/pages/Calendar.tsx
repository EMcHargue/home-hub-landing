import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ListChecks, UtensilsCrossed, ClipboardList, CalendarDays, Sun, Cloud, Moon } from "lucide-react";
import { api, ApiMember, ApiPlannedMeal, ApiRecipe } from "@/lib/api";
import { format, startOfDay, startOfMonth, endOfMonth, isSameDay, isBefore } from "date-fns";

type Chore = { id: string; title: string; assignee_id: string | null; completed: boolean; due_date: string | null; recurrence?: string; time_of_day?: string | null; };
type Task  = { id: string; title: string; assignee_id: string | null; completed: boolean; due_date: string | null; };

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
  breakfast: "morning",
  lunch:     "afternoon",
  dinner:    "evening",
};

type TODSection = {
  key:    "morning" | "afternoon" | "evening";
  label:  string;
  icon:   React.ReactNode;
  meals:  ApiPlannedMeal[];
  chores: Chore[];
  tasks:  Task[];
};

const CalendarPage = () => {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));

  const monthStart = format(startOfMonth(viewMonth), "yyyy-MM-dd");
  const monthEnd   = format(endOfMonth(viewMonth),   "yyyy-MM-dd");

  const { data: members = [] } = useQuery<ApiMember[]>({ queryKey: ["members"],  queryFn: () => api.getMembers() });
  const { data: chores  = [] } = useQuery<Chore[]>({    queryKey: ["chores"],    queryFn: () => fetch("/api/chores").then((r) => r.json()) });
  const { data: tasks   = [] } = useQuery<Task[]>({     queryKey: ["tasks"],     queryFn: () => fetch("/api/tasks").then((r) => r.json()) });
  const { data: meals   = [] } = useQuery<ApiPlannedMeal[]>({
    queryKey: ["planned-meals", monthStart, monthEnd],
    queryFn:  () => api.getPlannedMeals(monthStart, monthEnd),
  });
  const { data: recipes = [] } = useQuery<ApiRecipe[]>({ queryKey: ["recipes"], queryFn: () => api.getRecipes() });

  const completeChore = useMutation({
    mutationFn: (id: string) => fetch(`/api/chores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chores"] }),
  });

  const completeTask = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const memberName = (id: string | null) =>
    !id ? "Unassigned" : members.find((m) => m.id === id)?.name ?? "Unknown";

  const recipeName = (id: number | null) =>
    !id ? null : recipes.find((r) => r.id === id)?.name ?? null;

  const today = startOfDay(new Date());
  const selectedKey = format(selectedDate, "yyyy-MM-dd");

  const itemsByDay = useMemo(() => {
    const map = new Map<string, { chores: Chore[]; tasks: Task[]; meals: ApiPlannedMeal[] }>();
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { chores: [], tasks: [], meals: [] });
      return map.get(key)!;
    };
    chores.forEach((c) => { const d = parseDateSafe(c.due_date); if (d) ensure(format(d, "yyyy-MM-dd")).chores.push(c); });
    tasks.forEach((t)  => { const d = parseDateSafe(t.due_date);  if (d) ensure(format(d, "yyyy-MM-dd")).tasks.push(t); });
    meals.forEach((m)  => { ensure(m.plan_date.slice(0, 10)).meals.push(m); });
    return map;
  }, [chores, tasks, meals]);

  const todSections = useMemo((): TODSection[] => {
    const dayItems = itemsByDay.get(selectedKey) ?? { chores: [], tasks: [], meals: [] };

    const morning:   TODSection = { key: "morning",   label: "Morning",   icon: <Sun   className="h-4 w-4 text-yellow-500" />, meals: [], chores: [], tasks: [] };
    const afternoon: TODSection = { key: "afternoon", label: "Afternoon", icon: <Cloud className="h-4 w-4 text-blue-400"   />, meals: [], chores: [], tasks: [] };
    const evening:   TODSection = { key: "evening",   label: "Evening",   icon: <Moon  className="h-4 w-4 text-indigo-400" />, meals: [], chores: [], tasks: [] };
    const sections = { morning, afternoon, evening };

    dayItems.meals.forEach((m) => { sections[SLOT_TO_TOD[m.slot] ?? "afternoon"].meals.push(m); });
    dayItems.chores.forEach((c) => {
      const tod = (c.time_of_day as "morning" | "afternoon" | "evening") ?? "afternoon";
      sections[tod].chores.push(c);
    });
    dayItems.tasks.forEach((t) => afternoon.tasks.push(t));

    return [morning, afternoon, evening];
  }, [itemsByDay, selectedKey]);

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
                modifiersClassNames={{
                  hasItems: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                }}
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
                      <ListChecks className="h-4 w-4 text-primary" />
                      <span>{c.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{c.due_date?.slice(0, 10)}</span>
                  </div>
                ))}
                {overdue.tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={t.completed} onCheckedChange={() => completeTask.mutate(t.id)} />
                      <ClipboardList className="h-4 w-4 text-primary" />
                      <span>{t.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.due_date?.slice(0, 10)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="shadow-[var(--card-shadow)]">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">
              {isSameDay(selectedDate, today) ? "Today — " : ""}{format(selectedDate, "EEEE, MMMM d")}
            </CardTitle>
            <CardDescription>Everything scheduled for this day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {todSections.map((section) => {
              const total = section.meals.length + section.chores.length + section.tasks.length;
              return (
                <section key={section.key}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    {section.icon}{section.label}
                    {total > 0 && <Badge variant="secondary" className="ml-1">{total}</Badge>}
                  </h3>
                  {total === 0 ? (
                    <p className="text-sm text-muted-foreground pl-6">Nothing scheduled</p>
                  ) : (
                    <div className="space-y-2 pl-2">
                      {section.meals.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                          <UtensilsCrossed className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{recipeName(m.recipe_id) ?? m.custom_name ?? "Untitled meal"}</p>
                            <p className="text-xs text-muted-foreground capitalize">{m.slot}</p>
                          </div>
                        </div>
                      ))}
                      {section.chores.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={c.completed} onCheckedChange={() => completeChore.mutate(c.id)} />
                            <ListChecks className="h-4 w-4 text-primary shrink-0" />
                            <span className={`text-sm ${c.completed ? "line-through text-muted-foreground" : ""}`}>{c.title}</span>
                            {c.recurrence && c.recurrence !== "none" && <Badge variant="outline" className="text-xs">{c.recurrence}</Badge>}
                          </div>
                          <span className="text-xs text-muted-foreground">{memberName(c.assignee_id)}</span>
                        </div>
                      ))}
                      {section.tasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={t.completed} onCheckedChange={() => completeTask.mutate(t.id)} />
                            <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                            <span className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{memberName(t.assignee_id)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CalendarPage;