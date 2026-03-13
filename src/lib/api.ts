const BASE = "/api";

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
};

export type ApiPantryGroup = {
  id: number;
  user_id: string;
  category_id: number | null;
  name: string;
};

export type ApiCategory = { id: number; name: string };

export type ApiShoppingItem = {
  id: number;
  user_id: string;
  pantry_item_id: number | null;
  item_name: string;
  requested_quantity: number | null;
  unit: string | null;
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
  getPantry: (userId: string) =>
    fetch(`${BASE}/pantry?user_id=${encodeURIComponent(userId)}`).then((r) =>
      json<ApiPantryItem[]>(r)
    ),

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
  getGroups: (userId: string) =>
    fetch(`${BASE}/pantry-groups?user_id=${encodeURIComponent(userId)}`).then((r) =>
      json<ApiPantryGroup[]>(r)
    ),

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
  getShopping: (userId: string) =>
    fetch(`${BASE}/shopping?user_id=${encodeURIComponent(userId)}`).then((r) =>
      json<ApiShoppingItem[]>(r)
    ),

  addShoppingItem: (
    userId: string,
    itemName: string,
    pantryItemId?: number,
    requestedQuantity?: number,
    unit?: string,
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

  // ── User bootstrap ─────────────────────────────────────────────────────────
  getOrCreateUserId: async (): Promise<string> => {
    const stored = localStorage.getItem("home_hub_user_id");
    if (stored) {
      const check = await fetch(`${BASE}/users/${encodeURIComponent(stored)}`);
      if (check.ok) return stored;
      localStorage.removeItem("home_hub_user_id");
    }
    const suffix = crypto.randomUUID().slice(0, 8);
    const res = await fetch(`${BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "local",
        email: `local+${suffix}@home.hub`,
        password_hash: "placeholder",
      }),
    });
    const data = (await res.json()) as { id: string };
    localStorage.setItem("home_hub_user_id", data.id);
    return data.id;
  },
};
