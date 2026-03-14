import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const sections = [
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
      <main className="container mx-auto px-6 py-10">
        <div className="mb-8">
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
      </main>
    </div>
  );
};

export default Dashboard;
