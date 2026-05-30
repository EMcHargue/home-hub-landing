import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Home,
  ArrowLeft,
  Plus,
  Star,
  ExternalLink,
  Trash2,
  Pencil,
  BookMarked,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Recipe = {
  id: string;
  title: string;
  url: string;
  category: string;
  rating: number; // 0-5
  notes: string;
  tried: boolean;
  createdAt: number;
};

const STORAGE_KEY = "recipes-to-try-v1";

function loadRecipes(): Recipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Recipe[]) : [];
  } catch {
    return [];
  }
}

function StarRating({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const interactive = !!onChange;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onMouseEnter={() => interactive && setHover(n)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => onChange?.(value === n ? 0 : n)}
            className={interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              style={{ width: size, height: size }}
              className={
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              }
            />
          </button>
        );
      })}
    </div>
  );
}

const Recipes = () => {
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>(() => loadRecipes());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [filter, setFilter] = useState<string>("All");

  // form fields
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }, [recipes]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.category && set.add(r.category));
    return ["All", ...Array.from(set).sort()];
  }, [recipes]);

  const visible = useMemo(
    () =>
      recipes
        .filter((r) => filter === "All" || r.category === filter)
        .sort((a, b) => b.createdAt - a.createdAt),
    [recipes, filter],
  );

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setUrl("");
    setCategory("");
    setRating(0);
    setNotes("");
    setTried(false);
    setDialogOpen(true);
  };

  const openEdit = (r: Recipe) => {
    setEditing(r);
    setTitle(r.title);
    setUrl(r.url);
    setCategory(r.category);
    setRating(r.rating);
    setNotes(r.notes);
    setTried(r.tried);
    setDialogOpen(true);
  };

  const save = () => {
    const t = title.trim();
    if (!t) {
      toast({ title: "Recipe needs a title", variant: "destructive" });
      return;
    }
    if (editing) {
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? { ...r, title: t, url: url.trim(), category: category.trim(), rating, notes, tried }
            : r,
        ),
      );
      toast({ title: "Recipe updated" });
    } else {
      setRecipes((prev) => [
        {
          id: crypto.randomUUID(),
          title: t,
          url: url.trim(),
          category: category.trim(),
          rating,
          notes,
          tried,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      toast({ title: "Recipe saved" });
    }
    setDialogOpen(false);
  };

  const remove = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-primary">
            <Home className="h-5 w-5" />
            <span className="font-serif text-xl font-bold tracking-tight">HomeBase</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <BookMarked className="h-5 w-5" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Recipes to Try
              </span>
            </div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Your recipe wishlist
            </h1>
            <p className="mt-1 text-muted-foreground">
              Save links, organize by category, rate after cooking, and jot notes.
            </p>
          </div>
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Recipe
          </Button>
        </div>

        {/* Category filters */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  filter === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookMarked className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                No recipes yet. Add a link to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((r) => (
              <Card key={r.id} className="group flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{r.title}</CardTitle>
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {r.category && <Badge variant="secondary">{r.category}</Badge>}
                    {r.tried && (
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
                        Tried
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <StarRating value={r.rating} />
                  {r.notes && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {r.notes}
                    </p>
                  )}
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Open recipe <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit recipe" : "Add a recipe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lemon ricotta pasta"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Link</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Dinner, Dessert, Weeknight"
                list="recipe-categories"
              />
              <datalist id="recipe-categories">
                {categories
                  .filter((c) => c !== "All")
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </div>
            <div>
              <label className="text-sm font-medium">Rating</label>
              <div className="pt-1">
                <StarRating value={rating} onChange={setRating} size={22} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Substitutions, tips, who liked it..."
                rows={3}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tried}
                onChange={(e) => setTried(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              I've tried this one
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save changes" : "Add recipe"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Recipes;
