import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Search,
  Package,
  AlertTriangle,
  ShoppingCart,
  Trash2,
  ChefHat,
  Calendar,
  TrendingDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const FALLBACK_CATEGORIES = [
  "Baking", "Beverages", "Canned Goods", "Dairy", "Grains",
  "Oils", "Produce", "Snacks", "Spices", "Spreads",
];

const BLANK_ITEM = {
  name: "",
  brand: "",
  category: "",
  newCategoryName: "",
  unit: "units",
  quantity: undefined as number | undefined,
  minQuantity: 1,
  expirationDate: "",
  groupSelection: "none",
  newGroupName: "",
};

// ── Types ──────────────────────────────────────────────────────────────────────

type PantryItem = {
  id: number;
  name: string;
  brand?: string;
  category: string;
  categoryId: number | null;
  groupId: number | null;
  quantity: number;
  unit: string;
  minQuantity: number;
  expirationDate?: string;
};

type PantryGroup = {
  id: number;
  name: string;
  category: string;
  categoryId: number | null;
};

/** A row in the inventory list — either a named group or a standalone item. */
type DisplayGroup = {
  id: number;           // group record id OR item id for standalones
  name: string;
  category: string;
  categoryId: number | null;
  unit: string;
  entries: PantryItem[];
  totalQuantity: number;
  totalMinQuantity: number;
  earliestExpiry: string | undefined;
  isLow: boolean;
  isNamedGroup: boolean; // false = standalone item acting as its own group
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatExpiryDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(new Date(date));
}

function getDaysUntilExpiry(date?: string) {
  if (!date) return Infinity;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getExpiryBadge(date?: string) {
  const days = getDaysUntilExpiry(date);
  if (days < 0) return <Badge variant="destructive">Expired</Badge>;
  if (days <= 7) return <Badge variant="destructive">Expires in {days}d</Badge>;
  if (days <= 30) return <Badge className="bg-accent text-accent-foreground">Expires in {days}d</Badge>;
  return <Badge variant="secondary">{formatExpiryDate(date!)}</Badge>;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Pantry = () => {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(
    () => localStorage.getItem("home_hub_user_id")
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState(BLANK_ITEM);
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [editingShoppingId, setEditingShoppingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");

  const toggleGroup = (id: number) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // ── Bootstrap user ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      api.getOrCreateUserId()
        .then(setUserId)
        .catch(() => toast({
          title: "Could not connect to server",
          description: "Make sure the API server is running.",
          variant: "destructive",
        }));
    }
  }, [userId, toast]);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: apiItems = [], isLoading } = useQuery({
    queryKey: ["pantry", userId],
    queryFn: () => api.getPantry(userId!),
    enabled: !!userId,
  });

  const { data: apiGroups = [] } = useQuery({
    queryKey: ["pantry-groups", userId],
    queryFn: () => api.getGroups(userId!),
    enabled: !!userId,
  });

  const { data: apiCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(),
    enabled: !!userId,
  });

  const { data: apiShopping = [] } = useQuery({
    queryKey: ["shopping", userId],
    queryFn: () => api.getShopping(userId!),
    enabled: !!userId,
  });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const categoryById = useMemo(
    () => new Map<number, string>(apiCategories.map((c) => [c.id, c.name])),
    [apiCategories]
  );
  const categoryIdByName = useMemo(
    () => new Map<string, number>(apiCategories.map((c) => [c.name, c.id])),
    [apiCategories]
  );
  const categoryNames = apiCategories.length > 0
    ? apiCategories.map((c) => c.name)
    : FALLBACK_CATEGORIES;

  const items: PantryItem[] = useMemo(
    () => apiItems.map((i) => ({
      id: i.id,
      name: i.name,
      brand: i.brand ?? undefined,
      category: (i.category_id && categoryById.get(i.category_id)) || "Uncategorized",
      categoryId: i.category_id,
      groupId: i.group_id,
      quantity: i.quantity,
      unit: i.unit,
      minQuantity: i.min_quantity,
      expirationDate: i.expiration_date ?? undefined,
    })),
    [apiItems, categoryById]
  );

  const groups: PantryGroup[] = useMemo(
    () => apiGroups.map((g) => ({
      id: g.id,
      name: g.name,
      category: (g.category_id && categoryById.get(g.category_id)) || "Uncategorized",
      categoryId: g.category_id,
    })),
    [apiGroups, categoryById]
  );

  const shoppingList = useMemo(
    () => apiShopping.map((s) => ({
      id: s.id,
      name: s.item_name,
      requestedQuantity: s.requested_quantity,
      unit: s.unit,
    })),
    [apiShopping]
  );
  const shoppingNames = useMemo(() => new Set(shoppingList.map((s) => s.name)), [shoppingList]);

  // ── Display grouping ─────────────────────────────────────────────────────────
  const displayGroups: DisplayGroup[] = useMemo(() => {
    const result: DisplayGroup[] = [];

    const matchesFilter = (item: PantryItem) => {
      const matchSearch = !search
        || item.name.toLowerCase().includes(search.toLowerCase())
        || (item.brand ?? "").toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchSearch && matchCategory;
    };

    // Named groups
    for (const group of groups) {
      if (categoryFilter !== "all" && group.category !== categoryFilter) continue;
      const allEntries = items.filter((i) => i.groupId === group.id);
      const entries = search ? allEntries.filter(matchesFilter) : allEntries;
      if (search && entries.length === 0) continue;

      const expiries = entries.map((e) => e.expirationDate).filter(Boolean).sort() as string[];
      const total = entries.reduce((s, e) => s + e.quantity, 0);
      const totalMin = entries.reduce((s, e) => s + e.minQuantity, 0);
      result.push({
        id: group.id,
        name: group.name,
        category: group.category,
        categoryId: group.categoryId,
        unit: entries[0]?.unit ?? "units",
        entries,
        totalQuantity: total,
        totalMinQuantity: totalMin,
        earliestExpiry: expiries[0],
        isLow: entries.length > 0 && total <= totalMin,
        isNamedGroup: true,
      });
    }

    // Standalone items (no group)
    for (const item of items.filter((i) => !i.groupId)) {
      if (!matchesFilter(item)) continue;
      result.push({
        id: item.id,
        name: item.name,
        category: item.category,
        categoryId: item.categoryId,
        unit: item.unit,
        entries: [item],
        totalQuantity: item.quantity,
        totalMinQuantity: item.minQuantity,
        earliestExpiry: item.expirationDate,
        isLow: item.quantity <= item.minQuantity,
        isNamedGroup: false,
      });
    }

    return result;
  }, [items, groups, search, categoryFilter]);

  const lowStockItems = items.filter((i) => i.quantity <= i.minQuantity);
  const expiringItems = items
    .filter((i) => getDaysUntilExpiry(i.expirationDate) <= 30)
    .sort((a, b) => getDaysUntilExpiry(a.expirationDate) - getDaysUntilExpiry(b.expirationDate));

  const totalItems = items.length;
  const wellStocked = items.filter((i) => i.quantity > i.minQuantity).length;
  const stockHealth = totalItems > 0 ? Math.round((wellStocked / totalItems) * 100) : 0;

  // ── Mutations ────────────────────────────────────────────────────────────────
  const addItem = useMutation({
    mutationFn: (payload: { item: typeof BLANK_ITEM; resolvedGroupId: number | null; resolvedCategoryId: number | null }) =>
      api.createPantryItem(userId!, {
        name: payload.item.name,
        brand: payload.item.brand || null,
        category_id: payload.resolvedCategoryId,
        group_id: payload.resolvedGroupId,
        quantity: payload.item.quantity ?? 0,
        unit: payload.item.unit,
        min_quantity: payload.item.minQuantity,
        expiration_date: payload.item.expirationDate || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pantry", userId] }),
    onError: (err) => toast({ title: "Failed to add item", description: String(err), variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.deletePantryItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pantry", userId] }),
    onError: (err) => toast({ title: "Failed to delete item", description: String(err), variant: "destructive" }),
  });

  const updateQuantity = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      api.updatePantryItem(id, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pantry", userId] }),
    onError: (err) => toast({ title: "Failed to update quantity", description: String(err), variant: "destructive" }),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => api.deleteGroup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pantry-groups", userId] });
      qc.invalidateQueries({ queryKey: ["pantry", userId] });
    },
    onError: (err) => toast({ title: "Failed to delete group", description: String(err), variant: "destructive" }),
  });

  const addShopping = useMutation({
    mutationFn: ({ name, pantryItemId, requestedQuantity, unit }: { name: string; pantryItemId?: number; requestedQuantity?: number; unit?: string }) =>
      api.addShoppingItem(userId!, name, pantryItemId, requestedQuantity, unit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping", userId] }),
    onError: (err) => toast({ title: "Failed to update shopping list", description: String(err), variant: "destructive" }),
  });

  const deleteShopping = useMutation({
    mutationFn: (id: number) => api.deleteShoppingItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping", userId] }),
    onError: (err) => toast({ title: "Failed to update shopping list", description: String(err), variant: "destructive" }),
  });

  const updateShopping = useMutation({
    mutationFn: ({ id, requestedQuantity, unit }: { id: number; requestedQuantity: number | null; unit: string | null }) =>
      api.updateShoppingItem(id, requestedQuantity, unit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping", userId] }),
    onError: (err) => toast({ title: "Failed to update shopping item", description: String(err), variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newItem.name) return;
    const isNewCategory = newItem.category === "__new__";
    if (!isNewCategory && !newItem.category) return;
    if (isNewCategory && !newItem.newCategoryName.trim()) return;

    // Create category if needed
    let resolvedCategory = newItem.category;
    let resolvedCategoryId: number | null = categoryIdByName.get(newItem.category) ?? null;
    if (isNewCategory) {
      try {
        const cat = await api.createCategory(newItem.newCategoryName.trim());
        qc.invalidateQueries({ queryKey: ["categories"] });
        resolvedCategory = cat.name;
        resolvedCategoryId = cat.id;
      } catch (err) {
        toast({ title: "Failed to create category", description: String(err), variant: "destructive" });
        return;
      }
    }

    let resolvedGroupId: number | null = null;

    if (newItem.groupSelection === "new" && newItem.newGroupName.trim()) {
      try {
        const result = await api.createGroup(userId!, {
          name: newItem.newGroupName.trim(),
          category_id: resolvedCategoryId,
        });
        resolvedGroupId = result.id;
        qc.invalidateQueries({ queryKey: ["pantry-groups", userId] });
      } catch (err) {
        toast({ title: "Failed to create group", description: String(err), variant: "destructive" });
        return;
      }
    } else if (newItem.groupSelection !== "none") {
      resolvedGroupId = parseInt(newItem.groupSelection);
    }

    addItem.mutate({ item: { ...newItem, category: resolvedCategory }, resolvedGroupId, resolvedCategoryId });
    setNewItem(BLANK_ITEM);
    setAddOpen(false);
  };

  const openAddDialog = (prefill?: Partial<typeof BLANK_ITEM>) => {
    setNewItem({ ...BLANK_ITEM, ...prefill });
    setAddOpen(true);
  };

  const handleQuantityChange = (id: number, delta: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    updateQuantity.mutate({ id, quantity: Math.max(0, item.quantity + delta) });
  };

  const toggleShoppingList = (name: string, pantryItemId?: number, requestedQuantity?: number, unit?: string) => {
    const existing = shoppingList.find((s) => s.name === name);
    if (existing) { deleteShopping.mutate(existing.id); }
    else { addShopping.mutate({ name, pantryItemId, requestedQuantity, unit }); }
  };

  const addAllLowStockToShopping = () => {
    lowStockItems.forEach((item) => {
      if (!shoppingNames.has(item.name)) {
        const needed = Math.max(0, item.minQuantity - item.quantity);
        addShopping.mutate({ name: item.name, pantryItemId: item.id, requestedQuantity: needed, unit: item.unit });
      }
    });
  };

  // When group selection changes, auto-fill category from the selected group
  const handleGroupSelectionChange = (value: string) => {
    const group = groups.find((g) => String(g.id) === value);
    setNewItem((p) => ({
      ...p,
      groupSelection: value,
      category: group?.category ?? p.category,
    }));
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-secondary/40 font-sans">
      {/* Header */}
      <header className="border-b border-primary/10 bg-primary/5 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/"><Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10"><ArrowLeft className="h-5 w-5 text-primary" /></Button></Link>
            <div>
              <h1 className="text-2xl font-display font-bold text-primary">Pantry</h1>
              <p className="text-sm text-muted-foreground">Manage your household inventory</p>
            </div>
          </div>

          {/* Add Item dialog */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openAddDialog()} className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-md"><Plus className="h-4 w-4 mr-2" />Add Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Pantry Item</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">

                {/* Group */}
                <div className="grid gap-2">
                  <Label>Group <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Select value={newItem.groupSelection} onValueChange={handleGroupSelectionChange}>
                    <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No group</SelectItem>
                      {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                      <SelectItem value="new">Create new group…</SelectItem>
                    </SelectContent>
                  </Select>
                  {newItem.groupSelection === "new" && (
                    <Input
                      value={newItem.newGroupName}
                      onChange={(e) => setNewItem((p) => ({ ...p, newGroupName: e.target.value }))}
                      placeholder="Group name, e.g. Flour"
                    />
                  )}
                </div>

                {/* Name + Brand */}
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={newItem.name}
                    onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                    placeholder={newItem.groupSelection !== "none" ? "e.g. All-Purpose Flour" : "e.g. Flour"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Brand <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    value={newItem.brand}
                    onChange={(e) => setNewItem((p) => ({ ...p, brand: e.target.value }))}
                    placeholder="e.g. Bob's Red Mill"
                  />
                </div>

                {/* Category + Unit */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={newItem.category} onValueChange={(v) => setNewItem((p) => ({ ...p, category: v, newCategoryName: "" }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="__new__">Create new category…</SelectItem>
                      </SelectContent>
                    </Select>
                    {newItem.category === "__new__" && (
                      <Input
                        value={newItem.newCategoryName}
                        onChange={(e) => setNewItem((p) => ({ ...p, newCategoryName: e.target.value }))}
                        placeholder="Category name, e.g. Frozen"
                      />
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Unit</Label>
                    <Input
                      value={newItem.unit}
                      onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))}
                      placeholder="lbs, cans…"
                    />
                  </div>
                </div>

                {/* Quantity + Min */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input type="number" min={0} step="any" value={newItem.quantity ?? ""} onChange={(e) => setNewItem((p) => ({ ...p, quantity: Number(e.target.value) }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Min Quantity</Label>
                    <Input type="number" min={0} step="any" value={newItem.minQuantity} onChange={(e) => setNewItem((p) => ({ ...p, minQuantity: Number(e.target.value) }))} />
                  </div>
                </div>

                {/* Expiration */}
                <div className="grid gap-2">
                  <Label>Expiration Date</Label>
                  <Input type="date" value={newItem.expirationDate} onChange={(e) => setNewItem((p) => ({ ...p, expirationDate: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={addItem.isPending}>Add Item</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/15 bg-card shadow-[var(--card-shadow)] hover:shadow-[var(--card-hover-shadow)] transition-shadow"><CardContent className="pt-6 flex items-center gap-4">
            <div className="rounded-full bg-primary/15 p-3"><Package className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Items</p><p className="text-2xl font-display font-bold text-foreground">{totalItems}</p></div>
          </CardContent></Card>
          <Card className="border-destructive/15 bg-card shadow-[var(--card-shadow)] hover:shadow-[var(--card-hover-shadow)] transition-shadow"><CardContent className="pt-6 flex items-center gap-4">
            <div className="rounded-full bg-destructive/10 p-3"><TrendingDown className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-display font-bold text-foreground">{lowStockItems.length}</p></div>
          </CardContent></Card>
          <Card className="border-accent/20 bg-card shadow-[var(--card-shadow)] hover:shadow-[var(--card-hover-shadow)] transition-shadow"><CardContent className="pt-6 flex items-center gap-4">
            <div className="rounded-full bg-accent/15 p-3"><AlertTriangle className="h-5 w-5 text-accent" /></div>
            <div><p className="text-sm text-muted-foreground">Expiring Soon</p><p className="text-2xl font-display font-bold text-foreground">{expiringItems.length}</p></div>
          </CardContent></Card>
          <Card className="border-primary/15 bg-card shadow-[var(--card-shadow)] hover:shadow-[var(--card-hover-shadow)] transition-shadow"><CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stock Health</span>
              <span className="font-display font-semibold text-primary">{stockHealth}%</span>
            </div>
            <Progress value={stockHealth} className="h-2" />
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="inventory" className="gap-1"><Package className="h-4 w-4 hidden sm:inline" />Inventory</TabsTrigger>
            <TabsTrigger value="restock" className="gap-1"><AlertTriangle className="h-4 w-4 hidden sm:inline" />Restock</TabsTrigger>
            <TabsTrigger value="shopping" className="gap-1"><ShoppingCart className="h-4 w-4 hidden sm:inline" />Shopping List</TabsTrigger>
          </TabsList>

          {/* ── Inventory Tab ── */}
          <TabsContent value="inventory" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search items or brands…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              {isLoading && (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent></Card>
              )}
              {!isLoading && displayGroups.length === 0 && (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No items found.</CardContent></Card>
              )}

              {displayGroups.map((dg) => {
                const isOpen = openGroups.has(dg.id);
                return (
                  <Collapsible key={dg.id} open={isOpen} onOpenChange={() => toggleGroup(dg.id)}>
                    <Card className="overflow-hidden transition-shadow hover:shadow-md">
                      {/* Group / item header */}
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none">
                          <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{dg.name}</span>
                              <Badge variant="secondary" className="text-xs">{dg.category}</Badge>
                              {dg.isLow && <Badge variant="destructive" className="text-xs">Low</Badge>}
                              {dg.isNamedGroup && dg.entries.length > 0 && (
                                <Badge variant="outline" className="text-xs">{dg.entries.length} {dg.entries.length === 1 ? "lot" : "lots"}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                              <span>{dg.totalQuantity} {dg.unit} total</span>
                              {dg.earliestExpiry && (
                                <><span className="text-border">|</span>{getExpiryBadge(dg.earliestExpiry)}</>
                              )}
                            </div>
                          </div>
                          {/* Add lot button */}
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Add lot"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddDialog({
                                category: dg.category,
                                unit: dg.unit,
                                groupSelection: dg.isNamedGroup ? String(dg.id) : "none",
                              });
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          {/* Delete group button (named groups only) */}
                          {dg.isNamedGroup && (
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              title="Delete group (items become standalone)"
                              onClick={(e) => { e.stopPropagation(); deleteGroup.mutate(dg.id); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CollapsibleTrigger>

                      {/* Lot rows */}
                      <CollapsibleContent>
                        <div className="border-t divide-y bg-muted/20">
                          {dg.entries.length === 0 && (
                            <p className="pl-11 pr-4 py-3 text-sm text-muted-foreground italic">No items in this group yet.</p>
                          )}
                          {dg.entries.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 pl-11 pr-4 py-2.5">
                              <div className="flex-1 min-w-0">
                                {/* Name + brand on their own line inside a group */}
                                {dg.isNamedGroup && (
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                                    {item.brand && <span className="text-xs text-muted-foreground">{item.brand}</span>}
                                  </div>
                                )}
                                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                  <span className="font-medium text-foreground tabular-nums">{item.quantity} {item.unit}</span>
                                  <span className="text-border">|</span>
                                  <span>Min: {item.minQuantity}</span>
                                  {item.expirationDate && (
                                    <><span className="text-border">|</span>{getExpiryBadge(item.expirationDate)}</>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.id, -1)}>−</Button>
                                <span className="w-7 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.id, 1)}>+</Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteItem.mutate(item.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Restock Tab ── */}
          <TabsContent value="restock" className="space-y-4">
            <div className="flex items-center justify-between">
              <CardDescription>{lowStockItems.length} items need restocking</CardDescription>
              {lowStockItems.length > 0 && (
                <Button variant="outline" size="sm" onClick={addAllLowStockToShopping}>
                  <ShoppingCart className="h-4 w-4 mr-2" />Add All to Shopping List
                </Button>
              )}
            </div>
            {lowStockItems.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <ChefHat className="h-10 w-10 text-primary" />
                <p className="font-medium text-foreground">All stocked up!</p>
                <p>Your pantry is in great shape.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {lowStockItems.map((item) => (
                  <Card key={item.id} className="border-destructive/30">
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <span className="font-semibold text-foreground">{item.name}</span>
                          {item.brand && <span className="text-sm text-muted-foreground">{item.brand}</span>}
                          <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.quantity} / {item.minQuantity} {item.unit} — need {Math.max(0, item.minQuantity - item.quantity)} more
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleShoppingList(item.name, item.id, Math.max(0, item.minQuantity - item.quantity), item.unit)}>
                          {shoppingNames.has(item.name) ? "✓ On List" : "Add to List"}
                        </Button>
                        <Button size="sm" onClick={() => handleQuantityChange(item.id, item.minQuantity - item.quantity + 1)}>
                          Restock
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {expiringItems.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-accent" /> Expiring Soon
                </h3>
                <div className="grid gap-3">
                  {expiringItems.map((item) => (
                    <Card key={item.id} className="border-accent/30">
                      <CardContent className="py-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{item.name}</span>
                            {item.brand && <span className="text-sm text-muted-foreground">{item.brand}</span>}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.quantity} {item.unit}</p>
                        </div>
                        {getExpiryBadge(item.expirationDate)}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Shopping List Tab ── */}
          <TabsContent value="shopping" className="space-y-4">
            <div className="flex items-center justify-between">
              <CardDescription>{shoppingList.length} items on your shopping list</CardDescription>
              {shoppingList.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => shoppingList.forEach((s) => deleteShopping.mutate(s.id))}>
                  Clear All
                </Button>
              )}
            </div>
            {shoppingList.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <ShoppingCart className="h-10 w-10 text-primary" />
                <p className="font-medium text-foreground">Shopping list is empty</p>
                <p>Add items from the Restock tab or search your inventory.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-2">
                {shoppingList.map((s) => {
                  const item = items.find((i) => i.name === s.name);
                  const isEditing = editingShoppingId === s.id;
                  return (
                    <Card key={s.id}>
                      <CardContent className="py-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground">{s.name}</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                className="h-7 w-20 text-sm"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const qty = editQty === "" ? null : Number(editQty);
                                    updateShopping.mutate({ id: s.id, requestedQuantity: qty, unit: s.unit });
                                    setEditingShoppingId(null);
                                  } else if (e.key === "Escape") {
                                    setEditingShoppingId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <span className="text-sm text-muted-foreground">{s.unit ?? ""}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  const qty = editQty === "" ? null : Number(editQty);
                                  updateShopping.mutate({ id: s.id, requestedQuantity: qty, unit: s.unit });
                                  setEditingShoppingId(null);
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setEditingShoppingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="text-sm font-medium text-foreground hover:underline cursor-pointer"
                              onClick={() => {
                                setEditQty(s.requestedQuantity != null ? String(s.requestedQuantity) : "");
                                setEditingShoppingId(s.id);
                              }}
                            >
                              {s.requestedQuantity != null
                                ? `× ${s.requestedQuantity} ${s.unit ?? ""}`
                                : <span className="text-muted-foreground text-xs">+ qty</span>}
                            </button>
                          )}
                          {item && <span className="text-sm text-muted-foreground">({item.quantity} {item.unit} left)</span>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => deleteShopping.mutate(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Pantry;
