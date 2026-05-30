const BASE = "/api";

export type ApiMember = {
  id: string;
  name: string;
  pin: string | null;
};

export type ApiPantryItem = {
  id: number;
  user_id: string;
  category_id: number | null;
  group_id: number | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  min_quantity: number;
  expiration_date: string | null;
  frozen: boolean;
  refrigerated: boolean;
};

export type ApiPantryGroup = {
  id: number;
  user_id: string;
  category_id: number | null;
  name: string;
};

export type ApiCategory = { id: number; name: string };

export type ApiRecipe = {
  id: number;
  name: string;
  ingredients: string[];
  instructions: string | null;
  servings: number;
  tags: string[];
};

export type ApiPlannedMeal = {
  id: number;
  plan_date: string;
  slot: string;
  recipe_id: number | null;
  custom_name: string | null;
  link: string | null;
  ingredients: string[] | null;
};

export type ApiCalendarEntry = {
  id: string;
  title: string;
  description: string | null;
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  time_of_day: "morning" | "afternoon" | "evening" | "all_day";
  color: string | null;
};

export type ApiShoppingListLink = {
  id: number;
  week_start: string;
  ingredient_name: string;
  pantry_item_id: number;
  meal_names: string[];
};

export type ApiShoppingItem = {
  id: number;
  user_id: string;
  pantry_item_id: number | null;
  item_name: string;
  requested_quantity: number | null;
  unit: string | null;
  category_id: number | null;
  group_id: number | null;
};

type NewPantryItem = Omit<ApiPantryItem, "id" | "user_id">;
type NewPantryGroup = Omit<ApiPantryGroup, "id" | "user_id">;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const body = JSON.parse(text) as { error?: string; detail?: string };
      message = body.detail ?? body.error ?? text;
    } catch {
      // not JSON — use raw text
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Pantry items ───────────────────────────────────────────────────────────
  getPantry: () =>
    fetch(`${BASE}/pantry`).then((r) => json<ApiPantryItem[]>(r)),

  createPantryItem: (userId: string, item: NewPantryItem) =>
    fetch(`${BASE}/pantry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, user_id: userId }),
    }).then((r) => json<{ id: number }>(r)),

  updatePantryItem: (id: number, fields: Partial<NewPantryItem>) =>
    fetch(`${BASE}/pantry/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).then((r) => json<{ success: boolean }>(r)),

  deletePantryItem: (id: number) =>
    fetch(`${BASE}/pantry/${id}`, { method: "DELETE" }).then((r) =>
      json<{ success: boolean }>(r)
    ),

  // ── Pantry groups ──────────────────────────────────────────────────────────
  getGroups: () =>
    fetch(`${BASE}/pantry-groups`).then((r) => json<ApiPantryGroup[]>(r)),

  createGroup: (userId: string, group: NewPantryGroup) =>
    fetch(`${BASE}/pantry-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...group, user_id: userId }),
    }).then((r) => json<{ id: number }>(r)),

  updateGroup: (id: number, fields: Partial<NewPantryGroup>) =>
    fetch(`${BASE}/pantry-groups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).then((r) => json<{ success: boolean }>(r)),

  deleteGroup: (id: number) =>
    fetch(`${BASE}/pantry-groups/${id}`, { method: "DELETE" }).then((r) =>
      json<{ success: boolean }>(r)
    ),

  // ── Categories ─────────────────────────────────────────────────────────────
  getCategories: () =>
    fetch(`${BASE}/categories`).then((r) => json<ApiCategory[]>(r)),

  createCategory: (name: string) =>
    fetch(`${BASE}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<ApiCategory>(r)),

  // ── Shopping list ──────────────────────────────────────────────────────────
  getShopping: () =>
    fetch(`${BASE}/shopping`).then((r) => json<ApiShoppingItem[]>(r)),

  addShoppingItem: (
    userId: string,
    itemName: string,
    pantryItemId?: number,
    requestedQuantity?: number,
    unit?: string,
    categoryId?: number | null,
    groupId?: number | null,
  ) =>
    fetch(`${BASE}/shopping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        item_name: itemName,
        pantry_item_id: pantryItemId ?? null,
        requested_quantity: requestedQuantity ?? null,
        unit: unit ?? null,
        category_id: categoryId ?? null,
        group_id: groupId ?? null,
      }),
    }).then((r) => json<{ id: number }>(r)),

  updateShoppingItem: (id: number, requestedQuantity: number | null, unit: string | null) =>
    fetch(`${BASE}/shopping/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requested_quantity: requestedQuantity, unit }),
    }).then((r) => json<{ success: boolean }>(r)),

  deleteShoppingItem: (id: number) =>
    fetch(`${BASE}/shopping/${id}`, { method: "DELETE" }).then((r) =>
      json<{ success: boolean }>(r)
    ),

  // ── Members ────────────────────────────────────────────────────────────────
  getMembers: () =>
    fetch(`${BASE}/members`).then((r) => json<ApiMember[]>(r)),

  createMember: (name: string, pin?: string) =>
    fetch(`${BASE}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pin: pin || null }),
    }).then((r) => json<ApiMember>(r)),

  deleteMember: (id: string) =>
    fetch(`${BASE}/members/${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) =>
      json<{ success: boolean }>(r)
    ),

  // ── Recipes ────────────────────────────────────────────────────────────────
  getRecipes: () =>
    fetch(`${BASE}/recipes`).then((r) => json<ApiRecipe[]>(r)),

  createRecipe: (recipe: Omit<ApiRecipe, "id">) =>
    fetch(`${BASE}/recipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipe),
    }).then((r) => json<{ id: number }>(r)),

  deleteRecipe: (id: number) =>
    fetch(`${BASE}/recipes/${id}`, { method: "DELETE" }).then((r) => json<{ success: boolean }>(r)),

  // ── Planned meals ───────────────────────────────────────────────────────────
  getPlannedMeals: (start: string, end: string) =>
    fetch(`${BASE}/planned-meals?start=${start}&end=${end}`).then((r) => json<ApiPlannedMeal[]>(r)),

  createPlannedMeal: (plan_date: string, slot: string, recipe_id: number | null, custom_name: string | null, link: string | null, ingredients: string[] | null) =>
    fetch(`${BASE}/planned-meals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_date, slot, recipe_id, custom_name, link, ingredients }),
    }).then((r) => json<{ id: number }>(r)),

  updatePlannedMeal: (id: number, recipe_id: number | null, custom_name: string | null, link: string | null, ingredients: string[] | null) =>
    fetch(`${BASE}/planned-meals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id, custom_name, link, ingredients }),
    }).then((r) => json<{ success: boolean }>(r)),

  deletePlannedMeal: (id: number) =>
    fetch(`${BASE}/planned-meals/${id}`, { method: "DELETE" }).then((r) => json<{ success: boolean }>(r)),

  // ── Shopping list links ─────────────────────────────────────────────────────
  getShoppingListLinks: (week_start?: string) =>
    fetch(`${BASE}/shopping-list-links${week_start ? `?week_start=${week_start}` : ""}`).then((r) =>
      json<ApiShoppingListLink[]>(r)
    ),

  upsertShoppingListLink: (week_start: string, ingredient_name: string, pantry_item_id: number, meal_names: string[]) =>
    fetch(`${BASE}/shopping-list-links`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start, ingredient_name, pantry_item_id, meal_names }),
    }).then((r) => json<{ id: number }>(r)),

  deleteShoppingListLink: (id: number) =>
    fetch(`${BASE}/shopping-list-links/${id}`, { method: "DELETE" }).then((r) =>
      json<{ success: boolean }>(r)
    ),

  // ── Calendar entries ───────────────────────────────────────────────────────
  getCalendarEntries: (start: string, end: string) =>
    fetch(`${BASE}/calendar-entries?start=${start}&end=${end}`).then((r) => json<ApiCalendarEntry[]>(r)),

  createCalendarEntry: (entry: Omit<ApiCalendarEntry, "id">) =>
    fetch(`${BASE}/calendar-entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).then((r) => json<{ id: string }>(r)),

  updateCalendarEntry: (id: string, entry: Partial<Omit<ApiCalendarEntry, "id">>) =>
    fetch(`${BASE}/calendar-entries/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).then((r) => json<{ success: boolean }>(r)),

  deleteCalendarEntry: (id: string) =>
    fetch(`${BASE}/calendar-entries/${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) =>
      json<{ success: boolean }>(r)
    ),

  // ── User bootstrap ─────────────────────────────────────────────────────────
  getOrCreateUserId: async (): Promise<string> => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const stored = localStorage.getItem("home_hub_user_id");
    if (stored && UUID_RE.test(stored)) {
      const check = await fetch(`${BASE}/users/${encodeURIComponent(stored)}`);
      if (check.ok) return stored;
      localStorage.removeItem("home_hub_user_id");
    } else if (stored) {
      localStorage.removeItem("home_hub_user_id");
    }
    const suffix = crypto.randomUUID().slice(0, 8);
    const res = await fetch(`${BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `local-${suffix}`,
        email: `local+${suffix}@home.hub`,
        password_hash: "placeholder",
      }),
    });
    const data = (await res.json()) as { id: string };
    localStorage.setItem("home_hub_user_id", data.id);
    return data.id;
  },
};
