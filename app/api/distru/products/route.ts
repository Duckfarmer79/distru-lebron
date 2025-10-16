import { NextRequest, NextResponse } from 'next/server';

function toNum(x: any) {
  const v = parseFloat(String(x));
  return Number.isFinite(v) ? v : 0;
}

async function fetchProductsAllPages(base: string, token: string) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const all: any[] = [];
  
  console.log(`🛍️ Fetching products with correct pagination...`);
  
  // Use correct Distru pagination format: page[number]=X
  for (let pageNum = 1; pageNum <= 10; pageNum++) { // Limit to 10 pages for performance
    const url = `${base}/products?page[number]=${pageNum}`;
    console.log(`🛍️ Fetching page ${pageNum}...`);
    
    const res = await fetch(url, { headers, cache: 'no-store' });
    
    if (!res.ok) {
      console.log(`🛍️ Page ${pageNum} failed: ${res.status}`);
      break;
    }
    
    const json = await res.json();
    const rows: any[] = json.data ?? json.items ?? json.results ?? [];
    all.push(...rows);
    console.log(`🛍️ Page ${pageNum}: got ${rows.length} items (total: ${all.length})`);
    
    // If we get fewer items than expected, we've reached the end
    if (rows.length === 0 || rows.length < 25) { // Assuming ~25 items per page
      console.log(`🛍️ Reached end at page ${pageNum}`);
      break;
    }
  }
  
  console.log(`🛍️ Fetched ${all.length} products total`);
  return all;
}

export async function GET(_req: NextRequest) {
  try {
    const base = process.env.DISTRU_BASE_URL;
    const token = process.env.DISTRU_API_KEY;
    if (!base || !token) return NextResponse.json({ error: 'Missing env' }, { status: 500 });

    const rows = await fetchProductsAllPages(base, token);

    console.log(`🛍️ Raw products fetched: ${rows.length}`);

    const items = rows.map((r: any) => ({
      id: String(r.id),
      name: r.name ?? null,
      brand: r.brand?.name ?? r.brand ?? null, // Handle both null and object cases
      category: r.category?.name ?? null, // Extract category name from nested object
      unit_price: toNum(r.unit_price ?? 0),
      units_per_case: toNum(r.units_per_case ?? 1) || 1,
      image_url: r.images?.[0]?.url ?? null,
      is_active: Boolean(r.is_active),
      unit_type: r.unit_type?.name ?? null,
    }));

    console.log(`🛍️ Processed products: ${items.length}`);

    return NextResponse.json(items, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Route failed', details: String(e?.message || e) }, { status: 500 });
  }
}
