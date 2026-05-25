import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Plus, Trash2, Users, CalendarDays, RotateCcw, ClipboardList,
  Pencil, AlertTriangle, ChevronLeft, ChevronRight, Sun, Cloud, Moon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, ApiMember } from "@/lib/api";
import { format, addDays, startOfDay, isSameDay, isBefore } from "date-fns";

type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";
type TimeOfDay = "morning" | "afternoon" | "evening";

type Chore = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  completed: boolean; completed_at: string | null; created_at: string;
  due_date: string | null; start_date: string | null; end_date: string | null;
  recurrence: RecurrenceFrequency; time_of_day: string | null;
};

type Task = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  completed: boolean; completed_at: string | null; created_at: string; due_date: string | null;
};

type UnifiedItem = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  completed: boolean; completed_at: string | null; due_date: string | null;
  type: "chore" | "task"; recurrence?: RecurrenceFrequency; time_of_day?: string | null;
};

const END_OF_YEAR = `${new Date().getFullYear()}-12-31`;
const TODAY_STR   = format(new Date(), "yyyy-MM-dd");

const BLANK_CHORE = { title: "", description: "", assigneeId: "unassigned", dueDate: "", startDate: TODAY_STR, endDate: END_OF_YEAR, recurrence: "none" as RecurrenceFrequency, timeOfDay: "afternoon" };
const BLANK_TASK  = { title: "", description: "", assigneeId: "unassigned", dueDate: "" };

const TOD_META: Record<TimeOfDay, { label: string; icon: React.ReactNode }> = {
  morning:   { label: "Morning",   icon: <Sun   className="h-4 w-4 text-yellow-500" /> },
  afternoon: { label: "Afternoon", icon: <Cloud className="h-4 w-4 text-blue-400"   /> },
  evening:   { label: "Evening",   icon: <Moon  className="h-4 w-4 text-indigo-400" /> },
};
const TOD_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening"];

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const Chores = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: members = [] } = useQuery<ApiMember[]>({ queryKey: ["members"], queryFn: () => api.getMembers() });
  const { data: chores  = [] } = useQuery<Chore[]>({ queryKey: ["chores"],  queryFn: () => fetch("/api/chores").then((r) => r.json()) });
  const { data: tasks   = [] } = useQuery<Task[]>({  queryKey: ["tasks"],   queryFn: () => fetch("/api/tasks").then((r) => r.json()) });

  const [choreOpen, setChoreOpen] = useState(false);
  const [taskOpen,  setTaskOpen]  = useState(false);
  const [choreForm, setChoreForm] = useState(BLANK_CHORE);
  const [taskForm,  setTaskForm]  = useState(BLANK_TASK);
  const [editChore, setEditChore] = useState<Chore | null>(null);
  const [editTask,  setEditTask]  = useState<Task | null>(null);
  const [editChoreForm, setEditChoreForm] = useState(BLANK_CHORE);
  const [editTaskForm,  setEditTaskForm]  = useState(BLANK_TASK);

  const today = startOfDay(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => {
    const base = new Date(today);
    base.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return d; });
  }, [weekOffset]);

  function getMemberName(id: string | null) {
    if (!id) return "Unassigned";
    return members.find((m) => m.id === id)?.name ?? "Unknown";
  }

  function parseDateSafe(d: string | null): Date | null {
    if (!d) return null;
    try {
      const t = d.trim().slice(0, 10);
      const [y, m, day] = t.split("-").map(Number);
      if (isNaN(y) || isNaN(m) || isNaN(day)) return null;
      return startOfDay(new Date(y, m - 1, day));
    } catch { return null; }
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createChoreMutation = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/chores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["chores"] }); toast({ title: data.count ? `${data.count} chore instances created` : "Chore created" }); },
    onError: () => toast({ title: "Failed to create chore", variant: "destructive" }),
  });

  const updateChoreMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) =>
      fetch(`/api/chores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chores"] }),
  });

  const deleteChoreMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/chores/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chores"] }); toast({ title: "Chore deleted" }); },
  });

  const createTaskMutation = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast({ title: "Task created" }); },
    onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) =>
      fetch(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast({ title: "Task deleted" }); },
  });

  // ── Form handlers ──────────────────────────────────────────────────────────
  const addChore = () => {
    if (!choreForm.title.trim()) { toast({ title: "Chore title is required", variant: "destructive" }); return; }
    const isRecurring = choreForm.recurrence !== "none";
    createChoreMutation.mutate({
      title:       choreForm.title.trim(),
      description: choreForm.description.trim() || null,
      assignee_id: choreForm.assigneeId === "unassigned" ? null : choreForm.assigneeId,
      recurrence:  choreForm.recurrence,
      time_of_day: choreForm.timeOfDay,
      ...(isRecurring
        ? { start_date: choreForm.startDate, end_date: choreForm.endDate }
        : { due_date: choreForm.dueDate || null }),
    }, { onSuccess: () => { setChoreForm(BLANK_CHORE); setChoreOpen(false); } });
  };

  const openEditChore = (chore: Chore) => {
    setEditChoreForm({
      title:       chore.title,
      description: chore.description ?? "",
      assigneeId:  chore.assignee_id ?? "unassigned",
      dueDate:     chore.due_date    ? chore.due_date.slice(0, 10)    : "",
      startDate:   chore.start_date  ? chore.start_date.slice(0, 10)  : TODAY_STR,
      endDate:     chore.end_date    ? chore.end_date.slice(0, 10)    : END_OF_YEAR,
      recurrence:  chore.recurrence,
      timeOfDay:   chore.time_of_day ?? "afternoon",
    });
    setEditChore(chore);
  };

  const saveEditChore = () => {
    if (!editChore || !editChoreForm.title.trim()) return;
    const isRecurring = editChoreForm.recurrence !== "none";
    updateChoreMutation.mutate({
      id:          editChore.id,
      title:       editChoreForm.title.trim(),
      description: editChoreForm.description.trim() || null,
      assignee_id: editChoreForm.assigneeId === "unassigned" ? null : editChoreForm.assigneeId,
      recurrence:  editChoreForm.recurrence,
      time_of_day: editChoreForm.timeOfDay,
      ...(isRecurring
        ? { start_date: editChoreForm.startDate, end_date: editChoreForm.endDate, due_date: null }
        : { due_date: editChoreForm.dueDate || null, start_date: null, end_date: null }),
    }, { onSuccess: () => setEditChore(null) });
  };

  const addTask = () => {
    if (!taskForm.title.trim()) { toast({ title: "Task title is required", variant: "destructive" }); return; }
    createTaskMutation.mutate({
      title: taskForm.title.trim(), description: taskForm.description.trim() || null,
      assignee_id: taskForm.assigneeId === "unassigned" ? null : taskForm.assigneeId,
      due_date: taskForm.dueDate || null,
    }, { onSuccess: () => { setTaskForm(BLANK_TASK); setTaskOpen(false); } });
  };

  const openEditTask = (task: Task) => {
    setEditTaskForm({ title: task.title, description: task.description ?? "", assigneeId: task.assignee_id ?? "unassigned", dueDate: task.due_date ? task.due_date.slice(0, 10) : "" });
    setEditTask(task);
  };

  const saveEditTask = () => {
    if (!editTask || !editTaskForm.title.trim()) return;
    updateTaskMutation.mutate({
      id: editTask.id, title: editTaskForm.title.trim(),
      description: editTaskForm.description.trim() || null,
      assignee_id: editTaskForm.assigneeId === "unassigned" ? null : editTaskForm.assigneeId,
      due_date: editTaskForm.dueDate || null,
    }, { onSuccess: () => setEditTask(null) });
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const allIncomplete: UnifiedItem[] = useMemo(() => [
    ...chores.filter(c => !c.completed).map(c => ({ ...c, type: "chore" as const })),
    ...tasks.filter(t  => !t.completed).map(t => ({ ...t, type: "task"  as const })),
  ], [chores, tasks]);

  const overdueItems = useMemo(() =>
    allIncomplete.filter(item => { const d = parseDateSafe(item.due_date); return d && isBefore(d, today); })
                 .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [allIncomplete]);

  const noDateItems = useMemo(() => allIncomplete.filter(item => !item.due_date), [allIncomplete]);

  const selectedDayItems = useMemo(() =>
    allIncomplete.filter(item => { const d = parseDateSafe(item.due_date); return d && isSameDay(d, selectedDate); }),
    [allIncomplete, selectedDate]);

  const itemsByTod = useMemo(() => {
    const map: Record<TimeOfDay, UnifiedItem[]> = { morning: [], afternoon: [], evening: [] };
    for (const item of selectedDayItems) {
      const tod = (item.time_of_day as TimeOfDay) ?? "afternoon";
      map[tod].push(item);
    }
    if (isSameDay(selectedDate, today)) {
      for (const item of noDateItems) map.afternoon.push(item);
    }
    return map;
  }, [selectedDayItems, noDateItems, selectedDate]);

  // ── Chore form fields ──────────────────────────────────────────────────────
  const renderChoreFields = (form: typeof BLANK_CHORE, setForm: (f: typeof BLANK_CHORE) => void) => (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5"><Label>Title *</Label>
        <Input placeholder="e.g. Vacuum living room" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="space-y-1.5"><Label>Description</Label>
        <Input placeholder="Optional details" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>Assign to</Label>
          <Select value={form.assigneeId} onValueChange={(v) => setForm({ ...form, assigneeId: v })}>
            <SelectTrigger><span>{form.assigneeId === "unassigned" ? "Unassigned" : getMemberName(form.assigneeId)}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Recurrence</Label>
          <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as RecurrenceFrequency })}>
            <SelectTrigger><span className="capitalize">{form.recurrence === "none" ? "One-time" : form.recurrence}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">One-time</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {form.recurrence === "none" ? (
        <div className="space-y-1.5"><Label>Due date</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Start date</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="space-y-1.5"><Label>End date</Label>
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>
      )}
      <div className="space-y-1.5"><Label>Time of day</Label>
        <Select value={form.timeOfDay} onValueChange={(v) => setForm({ ...form, timeOfDay: v })}>
          <SelectTrigger><span className="capitalize">{form.timeOfDay}</span></SelectTrigger>
          <SelectContent>
            <SelectItem value="morning">Morning</SelectItem>
            <SelectItem value="afternoon">Afternoon</SelectItem>
            <SelectItem value="evening">Evening</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // ── Item card ──────────────────────────────────────────────────────────────
  const renderItem = (item: UnifiedItem) => {
    const isChore   = item.type === "chore";
    const isOverdue = (() => { const d = parseDateSafe(item.due_date); return d && isBefore(d, today); })();
    return (
      <Card key={`${item.type}-${item.id}`} className="shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3 p-4">
          <Checkbox checked={false}
            onCheckedChange={() => isChore
              ? updateChoreMutation.mutate({ id: item.id, completed: true })
              : updateTaskMutation.mutate({ id: item.id, completed: true })}
            className="mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {isChore ? <><RotateCcw className="mr-1 h-3 w-3" />Chore</> : <><ClipboardList className="mr-1 h-3 w-3" />Task</>}
              </Badge>
              <span className="font-medium text-foreground">{item.title}</span>
              {isChore && item.recurrence && item.recurrence !== "none" && (
                <Badge variant="secondary" className="text-xs capitalize"><RotateCcw className="mr-1 h-3 w-3" />{item.recurrence}</Badge>
              )}
              {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
            </div>
            {item.description && <p className="mt-0.5 text-sm text-muted-foreground truncate">{item.description}</p>}
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getMemberName(item.assignee_id)}</span>
              {item.due_date && (() => { const d = parseDateSafe(item.due_date); return d ? <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(d, "MMM d, yyyy")}</span> : null; })()}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"
              onClick={() => isChore ? openEditChore(chores.find(c => c.id === item.id)!) : openEditTask(tasks.find(t => t.id === item.id)!)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
              onClick={() => isChore ? deleteChoreMutation.mutate(item.id) : deleteTaskMutation.mutate(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const isSelectedToday = isSameDay(selectedDate, today);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 sm:px-6 py-4">
          <Button variant="ghost" size="icon" asChild><Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div className="flex-1">
            <h1 className="font-serif text-2xl font-bold text-foreground">Chores & Tasks</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Your daily chores and tasks.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={choreOpen} onOpenChange={setChoreOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> Chore</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Chore</DialogTitle></DialogHeader>
                {renderChoreFields(choreForm, setChoreForm)}
                <DialogFooter><Button onClick={addChore} disabled={createChoreMutation.isPending}>{createChoreMutation.isPending ? "Creating..." : "Create"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Task</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5"><Label>Title *</Label>
                    <Input placeholder="e.g. Call the plumber" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5"><Label>Description</Label>
                    <Input placeholder="Optional details" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Assign to</Label>
                      <Select value={taskForm.assigneeId} onValueChange={(v) => setTaskForm({ ...taskForm, assigneeId: v })}>
                        <SelectTrigger><span>{taskForm.assigneeId === "unassigned" ? "Unassigned" : getMemberName(taskForm.assigneeId)}</span></SelectTrigger>
                        <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Due date</Label>
                      <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button onClick={addTask} disabled={createTaskMutation.isPending}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{overdueItems.length}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ClipboardList className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{noDateItems.length}</p><p className="text-xs text-muted-foreground">No Date</p></div>
          </CardContent></Card>
        </div>

        {/* Overdue */}
        {overdueItems.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive text-lg"><AlertTriangle className="h-5 w-5" /> Overdue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">{overdueItems.map(renderItem)}</CardContent>
          </Card>
        )}

        {/* Week strip */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="flex gap-1.5">
              {weekDates.map((d) => {
                const isToday2   = isSameDay(d, today);
                const isSelected = isSameDay(d, selectedDate);
                const hasItems   = allIncomplete.some(item => { const pd = parseDateSafe(item.due_date); return pd && isSameDay(pd, d); });
                return (
                  <button key={d.toISOString()} onClick={() => setSelectedDate(d)}
                    className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-colors ${isSelected ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60"}`}>
                    <span className="text-[10px] text-muted-foreground">{DAY_NAMES[d.getDay()]}</span>
                    <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday2 ? "bg-primary text-primary-foreground" : isSelected ? "text-primary" : "text-foreground"}`}>
                      {d.getDate()}
                    </span>
                    {hasItems && <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />}
                  </button>
                );
              })}
            </div>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{format(selectedDate, "EEEE, MMMM d")}</p>
            {isSelectedToday && <Badge variant="outline" className="text-xs text-primary border-primary/30">Today</Badge>}
            {!isSelectedToday && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2"
                onClick={() => { setSelectedDate(today); setWeekOffset(0); }}>
                Back to today
              </Button>
            )}
          </div>
        </div>

        {/* Morning / Afternoon / Evening */}
        {TOD_ORDER.map((tod) => {
          const { label, icon } = TOD_META[tod];
          const items = itemsByTod[tod];
          return (
            <Card key={tod}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {icon}{label}
                  {items.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-3">Nothing scheduled</p>
                  : items.map(renderItem)}
              </CardContent>
            </Card>
          );
        })}
      </main>

      {/* Edit Chore Dialog */}
      <Dialog open={!!editChore} onOpenChange={(open) => { if (!open) setEditChore(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Chore</DialogTitle></DialogHeader>
          {renderChoreFields(editChoreForm, setEditChoreForm)}
          <DialogFooter><Button onClick={saveEditChore} disabled={updateChoreMutation.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => { if (!open) setEditTask(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Title *</Label>
              <Input value={editTaskForm.title} onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label>Description</Label>
              <Input value={editTaskForm.description} onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Assign to</Label>
                <Select value={editTaskForm.assigneeId} onValueChange={(v) => setEditTaskForm({ ...editTaskForm, assigneeId: v })}>
                  <SelectTrigger><span>{editTaskForm.assigneeId === "unassigned" ? "Unassigned" : getMemberName(editTaskForm.assigneeId)}</span></SelectTrigger>
                  <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Due date</Label>
                <Input type="date" value={editTaskForm.dueDate} onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveEditTask} disabled={updateTaskMutation.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chores;
