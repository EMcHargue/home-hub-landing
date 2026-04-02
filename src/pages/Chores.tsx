import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Plus, Search, Trash2, Users, CheckCircle2, Clock, CalendarDays, RotateCcw, ClipboardList, Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, ApiMember } from "@/lib/api";

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

const BLANK_CHORE = { title: "", description: "", assigneeId: "unassigned", dueDate: "", recurrence: "none" as RecurrenceFrequency };
const BLANK_TASK = { title: "", description: "", assigneeId: "unassigned", dueDate: "" };

const Chores = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: members = [] } = useQuery<ApiMember[]>({ queryKey: ["members"], queryFn: () => api.getMembers() });
  const { data: chores = [] } = useQuery<Chore[]>({ queryKey: ["chores"], queryFn: () => fetch("/api/chores").then((r) => r.json()) });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => fetch("/api/tasks").then((r) => r.json()) });

  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [activeMainTab, setActiveMainTab] = useState("chores");
  const [choreOpen, setChoreOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [choreForm, setChoreForm] = useState(BLANK_CHORE);
  const [taskForm, setTaskForm] = useState(BLANK_TASK);
  const [editChore, setEditChore] = useState<Chore | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editChoreForm, setEditChoreForm] = useState(BLANK_CHORE);
  const [editTaskForm, setEditTaskForm] = useState(BLANK_TASK);

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

  function getMemberName(id: string | null) {
    if (!id) return "Unassigned";
    return members.find((m) => m.id === id)?.name ?? "Unknown";
  }

  function isOverdueDate(dueDate: string | null) {
    return dueDate && new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
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

  const openEditChore = (chore: Chore) => {
    setEditChoreForm({
      title: chore.title,
      description: chore.description ?? "",
      assigneeId: chore.assignee_id ?? "unassigned",
      dueDate: chore.due_date ? chore.due_date.slice(0, 10) : "",
      recurrence: chore.recurrence,
    });
    setEditChore(chore);
  };

  const saveEditChore = () => {
    if (!editChore || !editChoreForm.title.trim()) return;
    updateChoreMutation.mutate({
      id: editChore.id,
      title: editChoreForm.title.trim(),
      description: editChoreForm.description.trim() || null,
      assignee_id: editChoreForm.assigneeId === "unassigned" ? null : editChoreForm.assigneeId,
      due_date: editChoreForm.dueDate || null,
      recurrence: editChoreForm.recurrence,
    }, { onSuccess: () => setEditChore(null) });
  };

  const addChore = () => {
    if (!choreForm.title.trim()) { toast({ title: "Chore title is required", variant: "destructive" }); return; }
    createChoreMutation.mutate({
      title: choreForm.title.trim(), description: choreForm.description.trim() || null,
      assignee_id: choreForm.assigneeId === "unassigned" ? null : choreForm.assigneeId,
      due_date: choreForm.dueDate || null, recurrence: choreForm.recurrence,
    }, { onSuccess: () => { setChoreForm(BLANK_CHORE); setChoreOpen(false); } });
  };

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

  const openEditTask = (task: Task) => {
    setEditTaskForm({
      title: task.title,
      description: task.description ?? "",
      assigneeId: task.assignee_id ?? "unassigned",
      dueDate: task.due_date ? task.due_date.slice(0, 10) : "",
    });
    setEditTask(task);
  };

  const saveEditTask = () => {
    if (!editTask || !editTaskForm.title.trim()) return;
    updateTaskMutation.mutate({
      id: editTask.id,
      title: editTaskForm.title.trim(),
      description: editTaskForm.description.trim() || null,
      assignee_id: editTaskForm.assigneeId === "unassigned" ? null : editTaskForm.assigneeId,
      due_date: editTaskForm.dueDate || null,
    }, { onSuccess: () => setEditTask(null) });
  };

  const addTask = () => {
    if (!taskForm.title.trim()) { toast({ title: "Task title is required", variant: "destructive" }); return; }
    createTaskMutation.mutate({
      title: taskForm.title.trim(), description: taskForm.description.trim() || null,
      assignee_id: taskForm.assigneeId === "unassigned" ? null : taskForm.assigneeId,
      due_date: taskForm.dueDate || null,
    }, { onSuccess: () => { setTaskForm(BLANK_TASK); setTaskOpen(false); } });
  };

  const today = new Date().toISOString().slice(0, 10);

  const filterItem = (item: { title: string; description: string | null; assignee_id: string | null }) =>
    (!search || item.title.toLowerCase().includes(search.toLowerCase()) || (item.description ?? "").toLowerCase().includes(search.toLowerCase())) &&
    (filterAssignee === "all" || (filterAssignee === "unassigned" ? item.assignee_id === null : item.assignee_id === filterAssignee));

  const isArchived = (item: { completed: boolean; due_date: string | null }) =>
    item.completed && (!item.due_date || item.due_date < today);

  const sortedChores = useMemo(() =>
    chores.filter((c) => !isArchived(c) && filterItem(c))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        return b.created_at.localeCompare(a.created_at);
      }), [chores, search, filterAssignee]);

  const archivedChores = useMemo(() =>
    chores.filter((c) => isArchived(c))
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()),
    [chores]);

  const sortedTasks = useMemo(() =>
    tasks.filter((t) => !isArchived(t) && filterItem(t))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        return b.created_at.localeCompare(a.created_at);
      }), [tasks, search, filterAssignee]);

  const archivedTasks = useMemo(() =>
    tasks.filter((t) => isArchived(t))
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()),
    [tasks]);

  const totalActiveChores = chores.filter((c) => !c.completed).length;
  const totalActiveTasks = tasks.filter((t) => !t.completed).length;
  const overdue = [...chores.filter((c) => !c.completed && isOverdueDate(c.due_date)), ...tasks.filter((t) => !t.completed && isOverdueDate(t.due_date))].length;
  const completedToday = [...chores.filter((c) => c.completed && c.completed_at?.slice(0, 10) === today), ...tasks.filter((t) => t.completed && t.completed_at?.slice(0, 10) === today)].length;

  const renderChoreItem = (chore: Chore) => (
    <Card key={chore.id} className="shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-hover-shadow)]">
      <CardContent className="flex items-start gap-3 p-4">
        <Checkbox checked={false} onCheckedChange={() => toggleChore(chore)} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{chore.title}</span>
            {chore.recurrence !== "none" && <Badge variant="secondary" className="text-xs capitalize"><RotateCcw className="mr-1 h-3 w-3" />{chore.recurrence}</Badge>}
            {isOverdueDate(chore.due_date) && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
          </div>
          {chore.description && <p className="mt-0.5 text-sm text-muted-foreground truncate">{chore.description}</p>}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getMemberName(chore.assignee_id)}</span>
            {chore.due_date && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(chore.due_date + "T00:00:00").toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary" onClick={() => openEditChore(chore)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteChoreMutation.mutate(chore.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderTaskItem = (task: Task) => (
    <Card key={task.id} className="shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-hover-shadow)]">
      <CardContent className="flex items-start gap-3 p-4">
        <Checkbox checked={false} onCheckedChange={() => updateTaskMutation.mutate({ id: task.id, completed: true })} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{task.title}</span>
            {isOverdueDate(task.due_date) && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
          </div>
          {task.description && <p className="mt-0.5 text-sm text-muted-foreground truncate">{task.description}</p>}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getMemberName(task.assignee_id)}</span>
            {task.due_date && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(task.due_date + "T00:00:00").toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary" onClick={() => openEditTask(task)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteTaskMutation.mutate(task.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCompleted = (item: Chore | Task, isChore: boolean) => (
    <Card key={item.id} className="shadow-[var(--card-shadow)] opacity-75">
      <CardContent className="flex items-start gap-3 p-4">
        <Checkbox checked onCheckedChange={() => isChore ? updateChoreMutation.mutate({ id: item.id, completed: false }) : updateTaskMutation.mutate({ id: item.id, completed: false })} className="mt-1" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-muted-foreground line-through">{item.title}</span>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{getMemberName(item.assignee_id)}</span>
            {item.completed_at && <span>Completed {new Date(item.completed_at).toLocaleDateString()}</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => isChore ? deleteChoreMutation.mutate(item.id) : deleteTaskMutation.mutate(item.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );

  const emptyState = (icon: React.ReactNode, message: string) => (
    <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">
      {icon}<p className="text-muted-foreground">{message}</p>
    </CardContent></Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 sm:px-6 py-4">
          <Button variant="ghost" size="icon" asChild><Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Chores & Tasks</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Recurring chores and one-time tasks for your household.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><RotateCcw className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{totalActiveChores}</p><p className="text-xs text-muted-foreground">Active Chores</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><ClipboardList className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{totalActiveTasks}</p><p className="text-xs text-muted-foreground">Active Tasks</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><Clock className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{overdue}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"><CheckCircle2 className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{completedToday}</p><p className="text-xs text-muted-foreground">Done today</p></div>
          </CardContent></Card>
        </div>

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="chores" className="gap-1.5"><RotateCcw className="h-4 w-4" /> Chores</TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5"><ClipboardList className="h-4 w-4" /> Tasks</TabsTrigger>
            </TabsList>

            {activeMainTab === "chores" && (
              <Dialog open={choreOpen} onOpenChange={setChoreOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Chore</Button></DialogTrigger>
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
            )}

            {activeMainTab === "tasks" && (
              <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Task</Button></DialogTrigger>
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
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={activeMainTab === "chores" ? "Search chores…" : "Search tasks…"} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-[180px]">
                <span>{filterAssignee === "all" ? "All members" : filterAssignee === "unassigned" ? "Unassigned" : getMemberName(filterAssignee)}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="chores" className="space-y-4">
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived" className="gap-1.5">
                  Archived {archivedChores.length > 0 && <Badge variant="secondary" className="text-xs">{archivedChores.length}</Badge>}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="space-y-2 mt-4">
                {sortedChores.length === 0
                  ? emptyState(<CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/40" />, chores.length === 0 ? "No chores yet — create one to get started!" : "All caught up! 🎉")
                  : <div className="space-y-2">{sortedChores.map((c) => c.completed ? renderCompleted(c, true) : renderChoreItem(c))}</div>}
              </TabsContent>
              <TabsContent value="archived" className="space-y-2 mt-4">
                {archivedChores.length === 0
                  ? emptyState(<Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />, "No archived chores.")
                  : <div className="space-y-2">{archivedChores.map((c) => renderCompleted(c, true))}</div>}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived" className="gap-1.5">
                  Archived {archivedTasks.length > 0 && <Badge variant="secondary" className="text-xs">{archivedTasks.length}</Badge>}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="space-y-2 mt-4">
                {sortedTasks.length === 0
                  ? emptyState(<CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/40" />, tasks.length === 0 ? "No tasks yet — create one to get started!" : "All tasks done! 🎉")
                  : <div className="space-y-2">{sortedTasks.map((t) => t.completed ? renderCompleted(t, false) : renderTaskItem(t))}</div>}
              </TabsContent>
              <TabsContent value="archived" className="space-y-2 mt-4">
                {archivedTasks.length === 0
                  ? emptyState(<Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />, "No archived tasks.")
                  : <div className="space-y-2">{archivedTasks.map((t) => renderCompleted(t, false))}</div>}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
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
