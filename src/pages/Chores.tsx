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
  ArrowLeft, Plus, Trash2, Users, CalendarDays, RotateCcw, ClipboardList, Pencil, AlertTriangle, ChevronRight, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, ApiMember } from "@/lib/api";
import { format, addDays, startOfDay, isSameDay, isBefore } from "date-fns";

type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";

type Chore = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  completed: boolean; completed_at: string | null; created_at: string;
  due_date: string | null; start_date: string | null; end_date: string | null;
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

const END_OF_YEAR = `${new Date().getFullYear()}-12-31`;
const TODAY_STR = format(new Date(), "yyyy-MM-dd");

const BLANK_CHORE = { title: "", description: "", assigneeId: "unassigned", dueDate: "", startDate: TODAY_STR, endDate: END_OF_YEAR, recurrence: "none" as RecurrenceFrequency };
const BLANK_TASK  = { title: "", description: "", assigneeId: "unassigned", dueDate: "" };

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
  const [selectedDate,  setSelectedDate]  = useState<Date | null>(null);
  const [lookAheadDays, setLookAheadDays] = useState(7);

  const today = startOfDay(new Date());

  function getMemberName(id: string | null) {
    if (!id) return "Unassigned";
    return members.find((m) => m.id === id)?.name ?? "Unknown";
  }

  function parseDateSafe(d: string | null): Date | null {
    if (!d) return null;
    try {
      const trimmed = d.trim().slice(0, 10);
      const [year, month, day] = trimmed.split("-").map(Number);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      return startOfDay(new Date(year, month - 1, day));
    } catch { return null; }
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createChoreMutation = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/chores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chores"] });
      toast({ title: data.count ? `${data.count} chore instances created` : "Chore created" });
    },
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
      ...(isRecurring
        ? { start_date: choreForm.startDate, end_date: choreForm.endDate }
        : { due_date: choreForm.dueDate || null }),
    }, { onSuccess: () => { setChoreForm(BLANK_CHORE); setChoreOpen(false); } });
  };

  const openEditChore = (chore: Chore) => {
    setEditChoreForm({
      title:      chore.title,
      description: chore.description ?? "",
      assigneeId: chore.assignee_id ?? "unassigned",
      dueDate:    chore.due_date   ? chore.due_date.slice(0, 10)   : "",
      startDate:  chore.start_date ? chore.start_date.slice(0, 10) : TODAY_STR,
      endDate:    chore.end_date   ? chore.end_date.slice(0, 10)   : END_OF_YEAR,
      recurrence: chore.recurrence,
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
      ...(isRecurring
        ? { start_date: editChoreForm.startDate, end_date: editChoreForm.endDate, due_date: null }
        : { due_date: editChoreForm.dueDate || null, start_date: null, end_date: null }),
    }, { onSuccess: () => setEditChore(null) });
  };

  const addTask = () => {
    if (!taskForm.title.trim()) { toast({ title: "Task title is required", variant: "destructive" }); return; }
    createTaskMutation.mutate({
      title:       taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      assignee_id: taskForm.assigneeId === "unassigned" ? null : taskForm.assigneeId,
      due_date:    taskForm.dueDate || null,
    }, { onSuccess: () => { setTaskForm(BLANK_TASK); setTaskOpen(false); } });
  };

  const openEditTask = (task: Task) => {
    setEditTaskForm({ title: task.title, description: task.description ?? "", assigneeId: task.assignee_id ?? "unassigned", dueDate: task.due_date ? task.due_date.slice(0, 10) : "" });
    setEditTask(task);
  };

  const saveEditTask = () => {
    if (!editTask || !editTaskForm.title.trim()) return;
    updateTaskMutation.mutate({
      id:          editTask.id,
      title:       editTaskForm.title.trim(),
      description: editTaskForm.description.trim() || null,
      assignee_id: editTaskForm.assigneeId === "unassigned" ? null : editTaskForm.assigneeId,
      due_date:    editTaskForm.dueDate || null,
    }, { onSuccess: () => setEditTask(null) });
  };

  // ── Unified items (incomplete only) ────────────────────────────────────────
  const allItems: UnifiedItem[] = useMemo(() => [
    ...chores.filter(c => !c.completed).map(c => ({ ...c, type: "chore" as const })),
    ...tasks.filter(t  => !t.completed).map(t => ({ ...t, type: "task"  as const })),
  ], [chores, tasks]);

  const overdueItems = useMemo(() =>
    allItems.filter(item => { const d = parseDateSafe(item.due_date); return d && isBefore(d, today); })
            .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [allItems]);

  const todayItems  = useMemo(() =>
    allItems.filter(item => { const d = parseDateSafe(item.due_date); return d && isSameDay(d, today); }),
    [allItems]);

  const noDateItems = useMemo(() => allItems.filter(item => !item.due_date), [allItems]);

  const futureDays  = useMemo(() => {
    const days: { date: Date; items: UnifiedItem[] }[] = [];
    for (let i = 1; i <= lookAheadDays; i++) {
      const d = addDays(today, i);
      days.push({ date: d, items: allItems.filter(item => { const id = parseDateSafe(item.due_date); return id && isSameDay(id, d); }) });
    }
    return days;
  }, [allItems, lookAheadDays]);

  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    return allItems.filter(item => { const d = parseDateSafe(item.due_date); return d && isSameDay(d, selectedDate); });
  }, [allItems, selectedDate]);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderDetailItem = (item: UnifiedItem) => {
    const isChore  = item.type === "chore";
    const isOverdue = (() => { const d = parseDateSafe(item.due_date); return d && isBefore(d, today); })();
    return (
      <Card key={`${item.type}-${item.id}`} className="shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-hover-shadow)]">
        <CardContent className="flex items-start gap-3 p-4">
          <Checkbox
            checked={false}
            onCheckedChange={() => isChore
              ? updateChoreMutation.mutate({ id: item.id, completed: true })
              : updateTaskMutation.mutate({ id: item.id, completed: true })}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {isChore ? <><RotateCcw className="mr-1 h-3 w-3" />Chore</> : <><ClipboardList className="mr-1 h-3 w-3" />Task</>}
              </Badge>
              <span className="font-medium text-foreground">{item.title}</span>
              {isChore && item.recurrence && item.recurrence !== "none" && (
                <Badge variant="secondary" className="text-xs capitalize">
                  <RotateCcw className="mr-1 h-3 w-3" />{item.recurrence}
                </Badge>
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

  // ── Chore form fields (reused in create + edit dialogs) ────────────────────
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
    </div>
  );

  // ── JSX ────────────────────────────────────────────────────────────────────
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
                {renderChoreFields(choreForm, setChoreForm)}
                <DialogFooter><Button onClick={addChore} disabled={createChoreMutation.isPending}>
                  {createChoreMutation.isPending ? "Creating..." : "Create"}
                </Button></DialogFooter>
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
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
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
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{overdueItems.length}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{todayItems.length}</p><p className="text-xs text-muted-foreground">Due Today</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ClipboardList className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{noDateItems.length}</p><p className="text-xs text-muted-foreground">No Date</p></div>
          </CardContent></Card>
        </div>

        {overdueItems.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive text-lg"><AlertTriangle className="h-5 w-5" /> Overdue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">{overdueItems.map(renderDetailItem)}</CardContent>
          </Card>
        )}

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

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-5 w-5 text-muted-foreground" /> Coming Up</CardTitle>
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
                        <span className="text-sm font-medium text-foreground">{format(date, "EEE, MMM d")}</span>
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
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
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
