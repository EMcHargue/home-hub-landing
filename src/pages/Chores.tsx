import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Users,
  CheckCircle2,
  Clock,
  CalendarDays,
  RotateCcw,
  UserPlus,
  ListChecks,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";

type Chore = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  dueDate: string | null;
  recurrence: RecurrenceFrequency;
};

type HouseholdMember = {
  id: string;
  name: string;
  pin?: string;
};

// ── Persistence helpers ───────────────────────────────────────────────────────

const CHORES_KEY = "homebase_chores";
const MEMBERS_KEY = "homebase_members";

function loadChores(): Chore[] {
  try {
    return JSON.parse(localStorage.getItem(CHORES_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveChores(chores: Chore[]) {
  localStorage.setItem(CHORES_KEY, JSON.stringify(chores));
}
function loadMembers(): HouseholdMember[] {
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveMembers(members: HouseholdMember[]) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

// ── Blank form ────────────────────────────────────────────────────────────────

const BLANK_CHORE = {
  title: "",
  description: "",
  assigneeId: "unassigned",
  dueDate: "",
  recurrence: "none" as RecurrenceFrequency,
};

// ── Component ─────────────────────────────────────────────────────────────────

const Chores = () => {
  const { toast } = useToast();

  const [chores, setChores] = useState<Chore[]>(loadChores);
  const [members, setMembers] = useState<HouseholdMember[]>(loadMembers);
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("all");

  // Dialogs
  const [choreOpen, setChoreOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [form, setForm] = useState(BLANK_CHORE);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPin, setNewMemberPin] = useState("");

  // Persist on change
  useEffect(() => saveChores(chores), [chores]);
  useEffect(() => saveMembers(members), [members]);

  // ── Members CRUD ────────────────────────────────────────────────────────────

  const addMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Member already exists", variant: "destructive" });
      return;
    }
    setMembers((prev) => [...prev, { id: crypto.randomUUID(), name }]);
    setNewMemberName("");
    toast({ title: `${name} added to household` });
  };

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    // Unassign chores from removed member
    setChores((prev) =>
      prev.map((c) => (c.assigneeId === id ? { ...c, assigneeId: null } : c))
    );
  };

  // ── Chores CRUD ─────────────────────────────────────────────────────────────

  const addChore = () => {
    if (!form.title.trim()) {
      toast({ title: "Chore title is required", variant: "destructive" });
      return;
    }
    const chore: Chore = {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      description: form.description.trim(),
      assigneeId: form.assigneeId === "unassigned" ? null : form.assigneeId,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      dueDate: form.dueDate || null,
      recurrence: form.recurrence,
    };
    setChores((prev) => [chore, ...prev]);
    setForm(BLANK_CHORE);
    setChoreOpen(false);
    toast({ title: "Chore created" });
  };

  const toggleComplete = (id: string) => {
    setChores((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const nowComplete = !c.completed;

        // If completing a recurring chore, spawn a new one
        if (nowComplete && c.recurrence !== "none") {
          const next = getNextDueDate(c.dueDate, c.recurrence);
          const newChore: Chore = {
            ...c,
            id: crypto.randomUUID(),
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            dueDate: next,
          };
          // We'll add it after the map via a ref trick
          setTimeout(() => setChores((p) => [newChore, ...p]), 0);
        }

        return {
          ...c,
          completed: nowComplete,
          completedAt: nowComplete ? new Date().toISOString() : null,
        };
      })
    );
  };

  const deleteChore = (id: string) => {
    setChores((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Chore deleted" });
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getNextDueDate(
    currentDue: string | null,
    freq: RecurrenceFrequency
  ): string | null {
    const base = currentDue ? new Date(currentDue) : new Date();
    switch (freq) {
      case "daily":
        base.setDate(base.getDate() + 1);
        break;
      case "weekly":
        base.setDate(base.getDate() + 7);
        break;
      case "monthly":
        base.setMonth(base.getMonth() + 1);
        break;
      default:
        return null;
    }
    return base.toISOString().slice(0, 10);
  }

  function getMemberName(id: string | null) {
    if (!id) return "Unassigned";
    return members.find((m) => m.id === id)?.name ?? "Unknown";
  }

  // ── Filtered / sorted lists ─────────────────────────────────────────────────

  const activeChores = useMemo(() => {
    return chores
      .filter((c) => !c.completed)
      .filter((c) =>
        search
          ? c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.description.toLowerCase().includes(search.toLowerCase())
          : true
      )
      .filter((c) =>
        filterAssignee === "all"
          ? true
          : filterAssignee === "unassigned"
            ? c.assigneeId === null
            : c.assigneeId === filterAssignee
      )
      .sort((a, b) => {
        // Chores with due dates first, then by due date ascending
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [chores, search, filterAssignee]);

  const completedChores = useMemo(() => {
    return chores
      .filter((c) => c.completed)
      .sort(
        (a, b) =>
          new Date(b.completedAt!).getTime() -
          new Date(a.completedAt!).getTime()
      );
  }, [chores]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalActive = chores.filter((c) => !c.completed).length;
  const overdue = chores.filter(
    (c) =>
      !c.completed &&
      c.dueDate &&
      new Date(c.dueDate) < new Date(new Date().toISOString().slice(0, 10))
  ).length;
  const completedToday = chores.filter(
    (c) =>
      c.completed &&
      c.completedAt &&
      c.completedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)
  ).length;
  const recurringCount = chores.filter(
    (c) => !c.completed && c.recurrence !== "none"
  ).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Chores
            </h1>
            <p className="text-sm text-muted-foreground">
              Organize household tasks and keep everyone accountable.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="shadow-[var(--card-shadow)]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalActive}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-[var(--card-shadow)]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-[var(--card-shadow)]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {completedToday}
                </p>
                <p className="text-xs text-muted-foreground">Done today</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-[var(--card-shadow)]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {recurringCount}
                </p>
                <p className="text-xs text-muted-foreground">Recurring</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="members">
                <Users className="mr-1.5 h-4 w-4" />
                Household
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Dialog open={choreOpen} onOpenChange={setChoreOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> New Chore
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Chore</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label>Title *</Label>
                      <Input
                        placeholder="e.g. Vacuum living room"
                        value={form.title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, title: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input
                        placeholder="Optional details"
                        value={form.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Assign to</Label>
                        <Select
                          value={form.assigneeId}
                          onValueChange={(v) =>
                            setForm((f) => ({ ...f, assigneeId: v }))
                          }
                        >
                          <SelectTrigger>
                            <span>
                              {form.assigneeId === "unassigned"
                                ? "Unassigned"
                                : getMemberName(form.assigneeId)}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              Unassigned
                            </SelectItem>
                            {members.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Recurrence</Label>
                        <Select
                          value={form.recurrence}
                          onValueChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              recurrence: v as RecurrenceFrequency,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <span className="capitalize">
                              {form.recurrence === "none"
                                ? "One-time"
                                : form.recurrence}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">One-time</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Due date</Label>
                      <Input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, dueDate: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={addChore}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* ── Active tab ─────────────────────────────────────────────────── */}
          <TabsContent value="active" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search chores…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-[180px]">
                  <span>
                    {filterAssignee === "all"
                      ? "All members"
                      : filterAssignee === "unassigned"
                        ? "Unassigned"
                        : getMemberName(filterAssignee)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeChores.length === 0 ? (
              <Card className="shadow-[var(--card-shadow)]">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">
                    {chores.length === 0
                      ? "No chores yet — create one to get started!"
                      : "All caught up! 🎉"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {activeChores.map((chore) => {
                  const isOverdue =
                    chore.dueDate &&
                    new Date(chore.dueDate) <
                      new Date(new Date().toISOString().slice(0, 10));
                  return (
                    <Card
                      key={chore.id}
                      className="shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-hover-shadow)]"
                    >
                      <CardContent className="flex items-start gap-3 p-4">
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => toggleComplete(chore.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">
                              {chore.title}
                            </span>
                            {chore.recurrence !== "none" && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                <RotateCcw className="mr-1 h-3 w-3" />
                                {chore.recurrence}
                              </Badge>
                            )}
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          {chore.description && (
                            <p className="mt-0.5 text-sm text-muted-foreground truncate">
                              {chore.description}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {getMemberName(chore.assigneeId)}
                            </span>
                            {chore.dueDate && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {new Date(chore.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteChore(chore.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Completed tab ──────────────────────────────────────────────── */}
          <TabsContent value="completed" className="space-y-2">
            {completedChores.length === 0 ? (
              <Card className="shadow-[var(--card-shadow)]">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">
                    No completed chores yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              completedChores.map((chore) => (
                <Card key={chore.id} className="shadow-[var(--card-shadow)] opacity-75">
                  <CardContent className="flex items-start gap-3 p-4">
                    <Checkbox
                      checked
                      onCheckedChange={() => toggleComplete(chore.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-muted-foreground line-through">
                        {chore.title}
                      </span>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {getMemberName(chore.assigneeId)}
                        </span>
                        {chore.completedAt && (
                          <span>
                            Completed{" "}
                            {new Date(chore.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteChore(chore.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── Household tab ──────────────────────────────────────────────── */}
          <TabsContent value="members" className="space-y-6">
            <Card className="shadow-[var(--card-shadow)]">
              <CardHeader>
                <CardTitle className="text-lg">Household Members</CardTitle>
                <CardDescription>
                  Add people in your household so you can assign chores to them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Member name"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                  />
                  <Button onClick={addMember} size="sm" className="gap-1.5 shrink-0">
                    <UserPlus className="h-4 w-4" /> Add
                  </Button>
                </div>

                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No members yet — add someone above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => {
                      const assignedCount = chores.filter(
                        (c) => !c.completed && c.assigneeId === m.id
                      ).length;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {m.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {assignedCount} active chore
                                {assignedCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeMember(m.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Chores;
