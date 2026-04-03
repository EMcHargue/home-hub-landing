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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Trash2, Users, CheckCircle2, Clock, CalendarDays, RotateCcw, ClipboardList, Pencil, AlertTriangle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, ApiMember } from "@/lib/api";
import { format, addDays, startOfDay, isSameDay, isBefore, isAfter, parseISO } from "date-fns";

type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";

type Chore = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  completed: boolean; completed_at: string | null; created_at: string; due_date: string | null;
  recurrence: RecurrenceFrequency;
};

type Task = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  completed: boolean; completed_at: string | null; created_at: string; due_date: string | null;
};

type UnifiedItem = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  completed: boolean; completed_at: string | null; due_date: string | null;
  type: "chore" | "task"; recurrence?: RecurrenceFrequency;
};

const BLANK_CHORE = { title: "", description: "", assigneeId: "unassigned", dueDate: "", recurrence: "none" as RecurrenceFrequency };
const BLANK_TASK = { title: "", description: "", assigneeId: "unassigned", dueDate: "" };

const Chores = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: members = [] } = useQuery<ApiMember[]>({ queryKey: ["members"], queryFn: () => api.getMembers() });
  const { data: chores = [] } = useQuery<Chore[]>({ queryKey: ["chores"], queryFn: () => fetch("/api/chores").then((r) => r.json()) });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => fetch("/api/tasks").then((r) => r.json()) });

  const [createType, setCreateType] = useState<"chore" | "task">("chore");
  const [choreOpen, setChoreOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [choreForm, setChoreForm] = useState(BLANK_CHORE);
  const [taskForm, setTaskForm] = useState(BLANK_TASK);
  const [editChore, setEditChore] = useState<Chore | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editChoreForm, setEditChoreForm] = useState(BLANK_CHORE);
  const [editTaskForm, setEditTaskForm] = useState(BLANK_TASK);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [lookAheadDays, setLookAheadDays] = useState(7);

  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  function getMemberName(id: string | null) {
    if (!id) return "Unassigned";
    return members.find((m) => m.id === id)?.name ?? "Unknown";
  }

  function parseDateSafe(d: string | null): Date | null {
    if (!d) return null;
    try { return startOfDay(parseISO(d.trim())); } catch { return null; }
  }

  // ---------- Mutations (unchanged logic) ----------
  function getNextDueDate(currentDue: string | null, freq: RecurrenceFrequency): string | null {
    const base = currentDue ? new Date(currentDue) : new Date();
    switch (freq) {
      case "daily": base.setDate(base.getDate() + 1); break;
      case "weekly": base.setDate(base.getDate() + 7); break;
      case "monthly": base.setMonth(base.getMonth() + 1); break;
      default: return null;
    }
    return base.toISOString().slice(0, 10);
  }

  const createChoreMutation = useMutation({
    mutationFn: (body: object) => fetch("/api/chores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chores"] }); toast({ title: "Chore created" }); },
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
    mutationFn: (body: object) => fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
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

  const toggleChore = (chore: Chore) => {
    const nowComplete = !chore.completed;
    updateChoreMutation.mutate({ id: chore.id, completed: nowComplete });
    if (nowComplete && chore.recurrence !== "none") {
      createChoreMutation.mutate({
        title: chore.title, description: chore.description, assignee_id: chore.assignee_id,
        due_date: getNextDueDate(chore.due_date, chore.recurrence), recurrence: chore.recurrence,
      });
    }
  };

  // ---------- Form handlers ----------
  const openEditChore = (chore: Chore) => {
    setEditChoreForm({ title: chore.title, description: chore.description ?? "", assigneeId: chore.assignee_id ?? "unassigned", dueDate: chore.due_date ? chore.due_date.slice(0, 10) : "", recurrence: chore.recurrence });
    setEditChore(chore);
  };

  const saveEditChore = () => {
    if (!editChore || !editChoreForm.title.trim()) return;
    updateChoreMutation.mutate({ id: editChore.id, title: editChoreForm.title.trim(), description: editChoreForm.description.trim() || null, assignee_id: editChoreForm.assigneeId === "unassigned" ? null : editChoreForm.assigneeId, due_date: editChoreForm.dueDate || null, recurrence: editChoreForm.recurrence }, { onSuccess: () => setEditChore(null) });
  };

  const addChore = () => {
    if (!choreForm.title.trim()) { toast({ title: "Chore title is required", variant: "destructive" }); return; }
    createChoreMutation.mutate({ title: choreForm.title.trim(), description: choreForm.description.trim() || null, assignee_id: choreForm.assigneeId === "unassigned" ? null : choreForm.assigneeId, due_date: choreForm.dueDate || null, recurrence: choreForm.recurrence }, { onSuccess: () => { setChoreForm(BLANK_CHORE); setChoreOpen(false); } });
  };

  const openEditTask = (task: Task) => {
    setEditTaskForm({ title: task.title, description: task.description ?? "", assigneeId: task.assignee_id ?? "unassigned", dueDate: task.due_date ? task.due_date.slice(0, 10) : "" });
    setEditTask(task);
  };

  const saveEditTask = () => {
    if (!editTask || !editTaskForm.title.trim()) return;
    updateTaskMutation.mutate({ id: editTask.id, title: editTaskForm.title.trim(), description: editTaskForm.description.trim() || null, assignee_id: editTaskForm.assigneeId === "unassigned" ? null : editTaskForm.assigneeId, due_date: editTaskForm.dueDate || null }, { onSuccess: () => setEditTask(null) });
  };

  const addTask = () => {
    if (!taskForm.title.trim()) { toast({ title: "Task title is required", variant: "destructive" }); return; }
    createTaskMutation.mutate({ title: taskForm.title.trim(), description: taskForm.description.trim() || null, assignee_id: taskForm.assigneeId === "unassigned" ? null : taskForm.assigneeId, due_date: taskForm.dueDate || null }, { onSuccess: () => { setTaskForm(BLANK_TASK); setTaskOpen(false); } });
  };

  // ---------- Unified items ----------
  const allItems: UnifiedItem[] = useMemo(() => {
    const choreItems: UnifiedItem[] = chores.filter(c => !c.completed).map(c => ({ ...c, type: "chore" as const }));
    const taskItems: UnifiedItem[] = tasks.filter(t => !t.completed).map(t => ({ ...t, type: "task" as const }));
    return [...choreItems, ...taskItems];
  }, [chores, tasks]);

  const overdueItems = useMemo(() =>
    allItems.filter(item => {
      const d = parseDateSafe(item.due_date);
      return d && isBefore(d, today);
    }).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [allItems, todayStr]
  );

  const todayItems = useMemo(() =>
    allItems.filter(item => {
      const d = parseDateSafe(item.due_date);
      return d && isSameDay(d, today);
    }),
    [allItems, todayStr]
  );

  const noDateItems = useMemo(() =>
    allItems.filter(item => !item.due_date),
    [allItems]
  );

  const futureDays = useMemo(() => {
    const days: { date: Date; items: UnifiedItem[] }[] = [];
    for (let i = 1; i <= lookAheadDays; i++) {
      const d = addDays(today, i);
      const items = allItems.filter(item => {
        const itemDate = parseDateSafe(item.due_date);
        return itemDate && isSameDay(itemDate, d);
      });
      days.push({ date: d, items });
    }
    return days;
  }, [allItems, todayStr, lookAheadDays]);

  // Items for a selected future date
  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    return allItems.filter(item => {
      const d = parseDateSafe(item.due_date);
      return d && isSameDay(d, selectedDate);
    });
  }, [allItems, selectedDate]);

  const totalOverdue = overdueItems.length;
  const totalToday = todayItems.length;

  // ---------- Render helpers ----------
  const renderDetailItem = (item: UnifiedItem) => {
    const isChore = item.type === "chore";
    const isOverdue = (() => {
      const d = parseDateSafe(item.due_date);
      return d && isBefore(d, today);
    })();

    return (
      <Card key={`${item.type}-${item.id}`} className="shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-hover-shadow)]">
        <CardContent className="flex items-start gap-3 p-4">
          <Checkbox
            checked={false}
            onCheckedChange={() => isChore ? toggleChore(item as unknown as Chore) : updateTaskMutation.mutate({ id: item.id, completed: true })}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {isChore ? <><RotateCcw className="mr-1 h-3 w-3" />Chore</> : <><ClipboardList className="mr-1 h-3 w-3" />Task</>}
              </Badge>
              <span className="font-medium text-foreground">{item.title}</span>
              {isChore && (item as UnifiedItem & { recurrence: RecurrenceFrequency }).recurrence !== "none" && (
                <Badge variant="secondary" className="text-xs capitalize">
                  <RotateCcw className="mr-1 h-3 w-3" />{(item as UnifiedItem & { recurrence: RecurrenceFrequency }).recurrence}
                </Badge>
              )}
              {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
            </div>
            {item.description && <p className="mt-0.5 text-sm text-muted-foreground truncate">{item.description}</p>}
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getMemberName(item.assignee_id)}</span>
              {item.due_date && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(item.due_date.trim() + "T12:00:00").toLocaleDateString()}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => isChore ? openEditChore(chores.find(c => c.id === item.id)!) : openEditTask(tasks.find(t => t.id === item.id)!)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => isChore ? deleteChoreMutation.mutate(item.id) : deleteTaskMutation.mutate(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCompactItem = (item: UnifiedItem) => (
    <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 py-1">
      <Checkbox
        checked={false}
        onCheckedChange={() => item.type === "chore" ? toggleChore(chores.find(c => c.id === item.id)!) : updateTaskMutation.mutate({ id: item.id, completed: true })}
        className="h-4 w-4"
      />
      <span className="text-sm text-foreground truncate">{item.title}</span>
      <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
        {item.type === "chore" ? "C" : "T"}
      </Badge>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 sm:px-6 py-4">
          <Button variant="ghost" size="icon" asChild><Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div className="flex-1">
            <h1 className="font-serif text-2xl font-bold text-foreground">Chores & Tasks</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Calendar view of your household chores and tasks.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={choreOpen} onOpenChange={setChoreOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> Chore</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Chore</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5"><Label>Title *</Label>
                    <Input placeholder="e.g. Vacuum living room" value={choreForm.title} onChange={(e) => setChoreForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Description</Label>
                    <Input placeholder="Optional details" value={choreForm.description} onChange={(e) => setChoreForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Assign to</Label>
                      <Select value={choreForm.assigneeId} onValueChange={(v) => setChoreForm((f) => ({ ...f, assigneeId: v }))}>
                        <SelectTrigger><span>{choreForm.assigneeId === "unassigned" ? "Unassigned" : getMemberName(choreForm.assigneeId)}</span></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Recurrence</Label>
                      <Select value={choreForm.recurrence} onValueChange={(v) => setChoreForm((f) => ({ ...f, recurrence: v as RecurrenceFrequency }))}>
                        <SelectTrigger><span className="capitalize">{choreForm.recurrence === "none" ? "One-time" : choreForm.recurrence}</span></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">One-time</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>Due date</Label>
                    <Input type="date" value={choreForm.dueDate} onChange={(e) => setChoreForm((f) => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button onClick={addChore} disabled={createChoreMutation.isPending}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Task</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5"><Label>Title *</Label>
                    <Input placeholder="e.g. Call the plumber" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5"><Label>Description</Label>
                    <Input placeholder="Optional details" value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Assign to</Label>
                      <Select value={taskForm.assigneeId} onValueChange={(v) => setTaskForm((f) => ({ ...f, assigneeId: v }))}>
                        <SelectTrigger><span>{taskForm.assigneeId === "unassigned" ? "Unassigned" : getMemberName(taskForm.assigneeId)}</span></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Due date</Label>
                      <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
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
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{totalOverdue}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{totalToday}</p><p className="text-xs text-muted-foreground">Due Today</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ClipboardList className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{noDateItems.length}</p><p className="text-xs text-muted-foreground">No Date</p></div>
          </CardContent></Card>
        </div>

        {/* Overdue section */}
        {overdueItems.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive text-lg">
                <AlertTriangle className="h-5 w-5" /> Overdue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueItems.map(renderDetailItem)}
            </CardContent>
          </Card>
        )}

        {/* Today section */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" /> Today — {format(today, "EEEE, MMMM d")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayItems.length === 0 && noDateItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">Nothing due today — you're all caught up! 🎉</p>
            ) : (
              <>
                {todayItems.map(renderDetailItem)}
                {noDateItems.length > 0 && (
                  <div className="pt-2 border-t mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">No due date</p>
                    {noDateItems.map(renderDetailItem)}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Upcoming section - compact */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-muted-foreground" /> Coming Up
              </CardTitle>
              <Select value={String(lookAheadDays)} onValueChange={(v) => setLookAheadDays(Number(v))}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><span>Next {lookAheadDays} days</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Next 7 days</SelectItem>
                  <SelectItem value="14">Next 14 days</SelectItem>
                  <SelectItem value="30">Next 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {futureDays.every(d => d.items.length === 0) ? (
              <p className="text-muted-foreground text-center py-4">Nothing scheduled for the next {lookAheadDays} days.</p>
            ) : (
              <div className="space-y-1">
                {futureDays.map(({ date, items }) => {
                  if (items.length === 0) return null;
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  return (
                    <div key={date.toISOString()}>
                      <button
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
                        onClick={() => setSelectedDate(isSelected ? null : date)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground">{format(date, "EEE, MMM d")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                        </div>
                      </button>
                      {isSelected && (
                        <div className="pl-4 pr-2 pb-2 space-y-2 mt-1">
                          {selectedDateItems.map(renderDetailItem)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Chore Dialog */}
      <Dialog open={!!editChore} onOpenChange={(open) => { if (!open) setEditChore(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Chore</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Title *</Label>
              <Input value={editChoreForm.title} onChange={(e) => setEditChoreForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Description</Label>
              <Input value={editChoreForm.description} onChange={(e) => setEditChoreForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Assign to</Label>
                <Select value={editChoreForm.assigneeId} onValueChange={(v) => setEditChoreForm((f) => ({ ...f, assigneeId: v }))}>
                  <SelectTrigger><span>{editChoreForm.assigneeId === "unassigned" ? "Unassigned" : getMemberName(editChoreForm.assigneeId)}</span></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Recurrence</Label>
                <Select value={editChoreForm.recurrence} onValueChange={(v) => setEditChoreForm((f) => ({ ...f, recurrence: v as RecurrenceFrequency }))}>
                  <SelectTrigger><span className="capitalize">{editChoreForm.recurrence === "none" ? "One-time" : editChoreForm.recurrence}</span></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Due date</Label>
              <Input type="date" value={editChoreForm.dueDate} onChange={(e) => setEditChoreForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter><Button onClick={saveEditChore} disabled={updateChoreMutation.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => { if (!open) setEditTask(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Title *</Label>
              <Input value={editTaskForm.title} onChange={(e) => setEditTaskForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Description</Label>
              <Input value={editTaskForm.description} onChange={(e) => setEditTaskForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Assign to</Label>
                <Select value={editTaskForm.assigneeId} onValueChange={(v) => setEditTaskForm((f) => ({ ...f, assigneeId: v }))}>
                  <SelectTrigger><span>{editTaskForm.assigneeId === "unassigned" ? "Unassigned" : getMemberName(editTaskForm.assigneeId)}</span></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Due date</Label>
                <Input type="date" value={editTaskForm.dueDate} onChange={(e) => setEditTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
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
