import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Plus,
  Search,
  Package,
  AlertTriangle,
  ShoppingCart,
  Trash2,
  Edit,
  ChefHat,
  Calendar,
  TrendingDown,
} from "lucide-react";

type PantryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  expirationDate?: string;
};

const INITIAL_ITEMS: PantryItem[] = [
  { id: "1", name: "Rice", category: "Grains", quantity: 3, unit: "lbs", minQuantity: 2, expirationDate: "2026-09-15" },
  { id: "2", name: "Olive Oil", category: "Oils", quantity: 1, unit: "bottles", minQuantity: 1, expirationDate: "2027-01-20" },
  { id: "3", name: "Canned Tomatoes", category: "Canned Goods", quantity: 5, unit: "cans", minQuantity: 3, expirationDate: "2027-06-10" },
  { id: "4", name: "Flour", category: "Baking", quantity: 0.5, unit: "lbs", minQuantity: 2, expirationDate: "2026-05-01" },
  { id: "5", name: "Pasta", category: "Grains", quantity: 2, unit: "boxes", minQuantity: 2, expirationDate: "2027-03-22" },
  { id: "6", name: "Chicken Broth", category: "Canned Goods", quantity: 1, unit: "cartons", minQuantity: 2, expirationDate: "2026-04-15" },
  { id: "7", name: "Sugar", category: "Baking", quantity: 4, unit: "lbs", minQuantity: 1 },
  { id: "8", name: "Black Beans", category: "Canned Goods", quantity: 6, unit: "cans", minQuantity: 3, expirationDate: "2027-11-01" },
  { id: "9", name: "Peanut Butter", category: "Spreads", quantity: 1, unit: "jars", minQuantity: 1, expirationDate: "2026-08-20" },
  { id: "10", name: "Milk", category: "Dairy", quantity: 0, unit: "gallons", minQuantity: 1, expirationDate: "2026-03-18" },
];

const CATEGORIES = ["Grains", "Oils", "Canned Goods", "Baking", "Spreads", "Dairy", "Produce", "Spices", "Snacks", "Beverages"];

function getDaysUntilExpiry(date?: string) {
  if (!date) return Infinity;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getExpiryBadge(date?: string) {
  const days = getDaysUntilExpiry(date);
  if (days < 0) return <Badge variant="destructive">Expired</Badge>;
  if (days <= 7) return <Badge variant="destructive">Expires in {days}d</Badge>;
  if (days <= 30) return <Badge className="bg-accent text-accent-foreground">Expires in {days}d</Badge>;
  return <Badge variant="secondary">{date}</Badge>;
}

const Pantry = () => {
  const [items, setItems] = useState<PantryItem[]>(INITIAL_ITEMS);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PantryItem>>({ unit: "units", minQuantity: 1 });
  const [shoppingList, setShoppingList] = useState<string[]>([]);

  const filteredItems = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const lowStockItems = items.filter((i) => i.quantity <= i.minQuantity);
  const expiringItems = items.filter((i) => getDaysUntilExpiry(i.expirationDate) <= 30).sort(
    (a, b) => getDaysUntilExpiry(a.expirationDate) - getDaysUntilExpiry(b.expirationDate)
  );

  const totalItems = items.length;
  const wellStocked = items.filter((i) => i.quantity > i.minQuantity).length;
  const stockHealth = totalItems > 0 ? Math.round((wellStocked / totalItems) * 100) : 0;

  const handleAdd = () => {
    if (!newItem.name || !newItem.category) return;
    setItems((prev) => [
      ...prev,
      { ...newItem, id: Date.now().toString(), quantity: newItem.quantity ?? 0, minQuantity: newItem.minQuantity ?? 1, unit: newItem.unit ?? "units", name: newItem.name!, category: newItem.category! },
    ]);
    setNewItem({ unit: "units", minQuantity: 1 });
    setAddOpen(false);
  };

  const handleDelete = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const handleQuantityChange = (id: string, delta: number) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)));

  const toggleShoppingList = (name: string) =>
    setShoppingList((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const addAllLowStockToShopping = () => {
    const names = lowStockItems.map((i) => i.name);
    setShoppingList((prev) => [...new Set([...prev, ...names])]);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">Pantry</h1>
              <p className="text-sm text-muted-foreground">Manage your household inventory</p>
            </div>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Pantry Item</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input value={newItem.name ?? ""} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Rice" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={newItem.category} onValueChange={(v) => setNewItem((p) => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Unit</Label>
                    <Input value={newItem.unit ?? ""} onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))} placeholder="lbs, cans…" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input type="number" min={0} value={newItem.quantity ?? ""} onChange={(e) => setNewItem((p) => ({ ...p, quantity: Number(e.target.value) }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Min Quantity</Label>
                    <Input type="number" min={0} value={newItem.minQuantity ?? 1} onChange={(e) => setNewItem((p) => ({ ...p, minQuantity: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Expiration Date</Label>
                  <Input type="date" value={newItem.expirationDate ?? ""} onChange={(e) => setNewItem((p) => ({ ...p, expirationDate: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd}>Add Item</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-3"><Package className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold text-foreground">{totalItems}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-lg bg-destructive/10 p-3"><TrendingDown className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-foreground">{lowStockItems.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-lg bg-accent/10 p-3"><AlertTriangle className="h-5 w-5 text-accent" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-foreground">{expiringItems.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stock Health</span>
                <span className="font-semibold text-foreground">{stockHealth}%</span>
              </div>
              <Progress value={stockHealth} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="inventory" className="gap-1"><Package className="h-4 w-4 hidden sm:inline" />Inventory</TabsTrigger>
            <TabsTrigger value="restock" className="gap-1"><AlertTriangle className="h-4 w-4 hidden sm:inline" />Restock</TabsTrigger>
            <TabsTrigger value="shopping" className="gap-1"><ShoppingCart className="h-4 w-4 hidden sm:inline" />Shopping List</TabsTrigger>
          </TabsList>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              {filteredItems.length === 0 && (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No items found.</CardContent></Card>
              )}
              {filteredItems.map((item) => (
                <Card key={item.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{item.name}</span>
                        <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                        {item.quantity <= item.minQuantity && <Badge variant="destructive" className="text-xs">Low</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{item.quantity} {item.unit}</span>
                        <span className="text-border">|</span>
                        <span>Min: {item.minQuantity} {item.unit}</span>
                        {item.expirationDate && (
                          <>
                            <span className="text-border">|</span>
                            {getExpiryBadge(item.expirationDate)}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.id, -1)}>−</Button>
                      <span className="w-8 text-center font-medium text-foreground">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.id, 1)}>+</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Restock Tab */}
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
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <span className="font-semibold text-foreground">{item.name}</span>
                          <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.quantity} / {item.minQuantity} {item.unit} — need {Math.max(0, item.minQuantity - item.quantity)} more
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleShoppingList(item.name)}>
                          {shoppingList.includes(item.name) ? "✓ On List" : "Add to List"}
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

            {/* Expiring Soon */}
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
                          <span className="font-semibold text-foreground">{item.name}</span>
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

          {/* Shopping List Tab */}
          <TabsContent value="shopping" className="space-y-4">
            <div className="flex items-center justify-between">
              <CardDescription>{shoppingList.length} items on your shopping list</CardDescription>
              {shoppingList.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShoppingList([])}>Clear All</Button>
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
                {shoppingList.map((name) => {
                  const item = items.find((i) => i.name === name);
                  return (
                    <Card key={name}>
                      <CardContent className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{name}</span>
                          {item && <span className="text-sm text-muted-foreground">({item.quantity} {item.unit} left)</span>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleShoppingList(name)}>
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
