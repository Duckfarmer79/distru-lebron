// Net Availability Menu API - shows inventory minus committed orders
import { NextRequest, NextResponse } from 'next/server';

type Pkg = {
  id: string;
  product_id: string;
  quantity_available: number;
  thc_percentage_total: number;
};

type Prod = {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  unit_price: number;
  units_per_case: number;
  image_url: string | null;
  is_active: boolean;
  unit_type: string | null;
};

type OrderCommitment = {
  order_id: string;
  order_number: string;
  product_id: string;
  product_name: string;
  quantity_committed: number;
  location_id: string;
};

export async function GET(req: NextRequest) {
  try {
    const origin = new URL(req.url).origin;

    // Fetch all data in parallel
    const [pkgRes, prodRes, ordersRes] = await Promise.all([
      fetch(`${origin}/api/distru/packages`, { cache: 'no-store' }),
      fetch(`${origin}/api/distru/products`, { cache: 'no-store' }),
      fetch(`${origin}/api/distru/orders`, { cache: 'no-store' }),
    ]);

    if (!pkgRes.ok) {
      const t = await pkgRes.text();
      return NextResponse.json({ error: 'packages fetch failed', details: t }, { status: pkgRes.status });
    }
    if (!prodRes.ok) {
      const t = await prodRes.text();
      return NextResponse.json({ error: 'products fetch failed', details: t }, { status: prodRes.status });
    }
    if (!ordersRes.ok) {
      console.warn(`📋 Orders fetch failed: ${ordersRes.status}, continuing without order commitments`);
    }

    const pkgs: Pkg[] = await pkgRes.json();
    const prods: Prod[] = await prodRes.json();
    const commitments: OrderCommitment[] = ordersRes.ok ? await ordersRes.json() : [];
    
    console.log(`🔍 Fetched ${pkgs.length} packages, ${prods.length} products, ${commitments.length} order commitments`);

    const qtyByProduct = new Map<string, number>();
    const thcDataByProduct = new Map<string, { totalWeightedThc: number; totalQty: number }>();
    
    for (const p of pkgs) {
      if (!p.product_id) continue;
      
      // Aggregate quantity
      const prevQty = qtyByProduct.get(p.product_id) ?? 0;
      const qty = Number.isFinite(p.quantity_available) ? p.quantity_available : 0;
      qtyByProduct.set(p.product_id, prevQty + qty);
      
      // Aggregate THC data (weighted by quantity for proper averaging)
      if (qty > 0 && Number.isFinite(p.thc_percentage_total) && p.thc_percentage_total > 0) {
        const existing = thcDataByProduct.get(p.product_id) || { totalWeightedThc: 0, totalQty: 0 };
        thcDataByProduct.set(p.product_id, {
          totalWeightedThc: existing.totalWeightedThc + (p.thc_percentage_total * qty),
          totalQty: existing.totalQty + qty
        });
      }
    }

    // Calculate committed quantities from processing orders
    const committedByProduct = new Map<string, number>();
    for (const commitment of commitments) {
      if (!commitment.product_id) continue;
      const prevCommitted = committedByProduct.get(commitment.product_id) ?? 0;
      const committed = Number.isFinite(commitment.quantity_committed) ? commitment.quantity_committed : 0;
      committedByProduct.set(commitment.product_id, prevCommitted + committed);
    }

    console.log(`📦 ${qtyByProduct.size} unique products have raw inventory`);
    console.log(`📋 ${committedByProduct.size} products have committed quantities`);

    const items = prods
      .filter(pr => qtyByProduct.has(pr.id) && (qtyByProduct.get(pr.id)! > 0))
      .map(pr => {
        const rawUnits = qtyByProduct.get(pr.id)!;
        const committedUnits = committedByProduct.get(pr.id) ?? 0;
        const units = Math.max(0, rawUnits - committedUnits); // Available = Raw - Committed
        
        const caseSize = pr.units_per_case > 0 ? pr.units_per_case : 1;
        const pricePerUnit = Number.isFinite(pr.unit_price) ? pr.unit_price : 0;
        const pricePerCase = pricePerUnit * caseSize;
        
        // Calculate average THC percentage
        const thcData = thcDataByProduct.get(pr.id);
        const avgThcPercentage = thcData && thcData.totalQty > 0 
          ? thcData.totalWeightedThc / thcData.totalQty 
          : null;
        
        return {
          product_id: pr.id,
          name: pr.name ?? 'Unnamed',
          brand: pr.brand,
          category: pr.category,
          units: units,
          case_size: caseSize,
          cases_available: Math.floor(units / caseSize),
          price_per_unit: pricePerUnit,
          price_per_case: pricePerCase,
          image_url: pr.image_url,
          unit_type: pr.unit_type,
          avg_thc_percentage: avgThcPercentage,
        };
      })
      .filter(item => item.units > 0);

    console.log(`🍽️ Final menu has ${items.length} items (net available inventory)`);

    return NextResponse.json(items, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'menu route failed', details: String(e?.message || e) }, { status: 500 });
  }
}
