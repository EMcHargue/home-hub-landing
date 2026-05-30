import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShoppingBasket,
  Wrench,
  DollarSign,
  Bell,
  FileText,
  ArrowRight,
  Home,
  ListChecks,
  LogOut,
  UserPlus,
  Trash2,
  Users,
  UtensilsCrossed,
  ShoppingCart,
  CalendarDays,
  BookMarked,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api, ApiMember } from "@/lib/api";

const sections = [
  {
    title: "Calendar",
    description: "See chores, tasks, and meals together by day, with overdue alerts.",
    icon: CalendarDays,
    href: "/calendar",
    ready: true,
  },
  {
    title: "Pantry",
    description: "Track inventory, restock items, and manage your shopping list.",
    icon: ShoppingBasket,
    href: "/pantry",
    ready: true,
  },
  {
    title: "Chores",
    description: "Create tasks, assign to household members, and track completion.",
    icon: ListChecks,
    href: "/chores",
    ready: true,
  },
  {
    title: "Meal Planning",
    description: "Plan weekly meals, save recipes, and auto-generate shopping lists.",
    icon: UtensilsCrossed,
    href: "/meals",
    ready: true,
  },
  {
    title: "Shopping",
    description: "Manage your shopping list and plan ingredients from meals.",
    icon: ShoppingCart,
    href: "/shopping",
    ready: true,
  },
  {
    title: "Recipes to Try",
    description: "Save recipe links, categorize, rate them, and keep notes.",
    icon: BookMarked,
    href: "/recipes",
    ready: true,
  },
  {
    title: "Maintenance",
    description: "Schedule repairs, track service history, and manage contractors.",
    icon: Wrench,
    href: "/maintenance",
    ready: false,
  },
  {
    title: "Expenses",
    description: "Monitor household spending, set budgets, and view reports.",
    icon: DollarSign,
    href: "/expenses",
    ready: false,
  },
  {
    title: "Reminders",
    description: "Set recurring tasks, due dates, and household alerts.",
    icon: Bell,
    href: "/reminders",
    ready: false,
  },
  {
    title: "Documents",
    description: "Store leases, warranties, manuals, and important records.",
    icon: FileText,
    href: "/documents",
    ready: false,
  },
];

const Dashboard = () => {
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPin, setNewMemberPin] = useState("");

  const { data: members = [] } = useQuery<ApiMember[]>({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  const createMember = useMutation({
    mutationFn: ({ name, pin }: { name: string; pin?: string }) =>
      api.createMember(name, pin),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({ title: `${member.name} added to household` });
      setNewMemberName("");
      setNewMemberPin("");
    },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) => api.deleteMember(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const addMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Member already exists", variant: "destructive" });
      return;
    }
    createMember.mutate({ name, pin: newMemberPin.trim() || undefined });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-primary">
            <Home className="h-5 w-5" />
            <span className="font-serif text-xl font-bold tracking-tight">HomeBase</span>
          </Link>
          <div className="flex items-center gap-3">
            {currentUser && (
              <span className="text-sm text-muted-foreground">
                Hi, <span className="font-medium text-foreground">{currentUser.name}</span>
              </span>
            )}
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={logout}>
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Manage every aspect of your home from one place.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <Card
              key={section.title}
              className="group relative transition-shadow hover:shadow-[var(--card-hover-shadow)]"
            >
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <section.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {section.ready ? (
                  <Button asChild size="sm" className="gap-1.5">
                    <Link to={section.href}>
                      Open <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled>
                    Coming Soon
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Household Members */}
        <Card className="shadow-[var(--card-shadow)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Household Members</CardTitle>
            </div>
            <CardDescription>
              Add people in your household so you can assign chores and log in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Member name"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                className="flex-1"
              />
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="PIN (optional)"
                value={newMemberPin}
                onChange={(e) => setNewMemberPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                className="w-28"
              />
              <Button
                onClick={addMember}
                size="sm"
                className="gap-1.5 shrink-0"
                disabled={createMember.isPending}
              >
                <UserPlus className="h-4 w-4" /> Add
              </Button>
            </div>

            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No members yet — add someone above.
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.pin ? "🔒 PIN set" : "No PIN"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMember.mutate(m.id)}
                      disabled={deleteMember.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
