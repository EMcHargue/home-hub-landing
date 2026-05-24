import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ListChecks, UtensilsCrossed, ClipboardList, CalendarDays } from "lucide-react";
import { api, ApiMember, ApiPlannedMeal, ApiRecipe } from "@/lib/api";
import { format, startOfDay, startOfMonth, endOfMonth, isSameDay, parseISO, isBefore } from "date-fns";

type Chore = {
  id: string; title: string; assignee_id: string | null;
  completed: boolean; due_date: string | null; recurrence?: string;
};
type Task = {
  id: string; title: string; assignee_id: string | null;
  completed: boolean; due_date: string | null;
};

function parseDateSafe(d: string | null): Date | null {
  if (!d) return null;
  try {
    const trimmed = d.trim().slice(0, 10);
    const [y, m, day] = trimmed.split("-").map(Number);
    if (!y || !m || !day) return null;
    return startOfDay(new Date(y, m - 1, day));
  } catch { return null; }
}

const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));

  const monthStart = format(startOfMonth(viewMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(viewMonth), "yyyy-MM-dd");

  const { data: members = [] } = useQuery<ApiMember[]>({ queryKey: ["members"], queryFn: () => api.getMembers() });
  const { data: chores = [] } = useQuery<Chore[]>({ queryKey: ["chores"], queryFn: () => fetch("/api/chores").then((r) => r.json()) });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => fetch("/api/tasks").then((r) => r.json()) });
  const { data: meals = [] } = useQuery<ApiPlannedMeal[]>({
    queryKey: ["planned-meals", monthStart, monthEnd],
    queryFn: () => api.getPlannedMeals(monthStart, monthEnd),
  });
  const { data: recipes = [] } = useQuery<ApiRecipe[]>({ queryKey: ["recipes"], queryFn: () => api.getRecipes() });

  const memberName = (id: string | null) =>
    !id ? "Unassigned" : members.find((m) => m.id === id)?.name ?? "Unknown";

  const recipeName = (id: number | null) =>
    !id ? null : recipes.find((r) => r.id === id)?.name ?? null;

  // Aggregate items per day
  const itemsByDay = useMemo(() => {
    const map = new Map<string, { chores: Chore[]; tasks: Task[]; meals: ApiPlannedMeal[] }>();
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { chores: [], tasks: [], meals: [] });
      return map.get(key)!;
    };
    chores.forEach((c) => {
      const d = parseDateSafe(c.due_date);
      if (d) ensure(format(d, "yyyy-MM-dd")).chores.push(c);
    });
    tasks.forEach((t) => {
      const d = parseDateSafe(t.due_date);
      if (d) ensure(format(d, "yyyy-MM-dd")).tasks.push(t);
    });
    meals.forEach((m) => {
      ensure(m.plan_date.slice(0, 10)).meals.push(m);
    });
    return map;
  }, [chores, tasks, meals]);

  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const selectedItems = itemsByDay.get(selectedKey) ?? { chores: [], tasks: [], meals: [] };

  // Overdue items (uncompleted, due before today)
  const today = startOfDay(new Date());
  const overdue = useMemo(() => {
    const oc = chores.filter((c) => {
      const d = parseDateSafe(c.due_date);
      return !c.completed && d && isBefore(d, today);
    });
    const ot = tasks.filter((t) => {
      const d = parseDateSafe(t.due_date);
      return !t.completed && d && isBefore(d, today);
    });
    return { chores: oc, tasks: ot };
  }, [chores, tasks, today]);

  const daysWithItems = useMemo(() => {
    const dates: Date[] = [];
    itemsByDay.forEach((_, key) => {
      const d = parseDateSafe(key);
      if (d) dates.push(d);
    });
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
        {/* Calendar + Overdue */}
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
                      <ListChecks className="h-4 w-4 text-primary" />
                      <span>{c.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{c.due_date?.slice(0, 10)}</span>
                  </div>
                ))}
                {overdue.tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
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

        {/* Day detail */}
        <Card className="shadow-[var(--card-shadow)]">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">
              {isSameDay(selectedDate, today) ? "Today — " : ""}{format(selectedDate, "EEEE, MMMM d")}
            </CardTitle>
            <CardDescription>Everything scheduled for this day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Meals */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <UtensilsCrossed className="h-4 w-4 text-primary" /> Meals
                <Badge variant="secondary" className="ml-1">{selectedItems.meals.length}</Badge>
              </h3>
              {selectedItems.meals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No meals planned. <Link to="/meals" className="text-primary underline">Plan one →</Link></p>
              ) : (
                <div className="space-y-2">
                  {selectedItems.meals.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{recipeName(m.recipe_id) ?? m.custom_name ?? "Untitled meal"}</p>
                        <p className="text-xs text-muted-foreground capitalize">{m.slot}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Chores */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListChecks className="h-4 w-4 text-primary" /> Chores
                <Badge variant="secondary" className="ml-1">{selectedItems.chores.length}</Badge>
              </h3>
              {selectedItems.chores.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chores due. <Link to="/chores" className="text-primary underline">Add one →</Link></p>
              ) : (
                <div className="space-y-2">
                  {selectedItems.chores.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${c.completed ? "line-through text-muted-foreground" : ""}`}>{c.title}</span>
                        {c.recurrence && c.recurrence !== "none" && (
                          <Badge variant="outline" className="text-xs">{c.recurrence}</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{memberName(c.assignee_id)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Tasks */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardList className="h-4 w-4 text-primary" /> Tasks
                <Badge variant="secondary" className="ml-1">{selectedItems.tasks.length}</Badge>
              </h3>
              {selectedItems.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks due. <Link to="/chores" className="text-primary underline">Add one →</Link></p>
              ) : (
                <div className="space-y-2">
                  {selectedItems.tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                      <span className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                      <span className="text-xs text-muted-foreground">{memberName(t.assignee_id)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CalendarPage;
