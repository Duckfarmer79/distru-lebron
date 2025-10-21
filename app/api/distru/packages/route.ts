import { NextRequest, NextResponse } from 'next/server';

function toNum(x: any) {
  const v = parseFloat(String(x));
  return Number.isFinite(v) ? v : 0;
}

async function fetchPackagesAllPages(base: string, token: string, locationId: string) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const all: any[] = [];

  console.log(`📦 Fetching packages with correct pagination...`);

  // Use correct Distru pagination format: page[number]=X and location_ids[]=Y
  for (let pageNum = 1; pageNum <= 10; pageNum++) { // Limit to 10 pages for performance
    const url = `${base}/packages?location_ids[]=${encodeURIComponent(locationId)}&page[number]=${pageNum}&statuses[]=active`;
    console.log(`📦 Fetching page ${pageNum}...`);

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      console.log(`📦 Page ${pageNum} failed: ${res.status}`);
      break;
    }
    
    const json = await res.json();
    const rows: any[] = json.data ?? json.items ?? json.results ?? [];
    all.push(...rows);
    console.log(`📦 Page ${pageNum}: got ${rows.length} items (total: ${all.length})`);
    
    // If we get fewer items than expected, we've reached the end
    if (rows.length === 0 || rows.length < 25) { // Assuming ~25 items per page
      console.log(`📦 Reached end at page ${pageNum}`);
      break;
    }
  }

  console.log(`📦 Fetched ${all.length} packages total`);
  return all;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const locationParam = searchParams.get('location');
    
    const base = process.env.DISTRU_BASE_URL;
    const token = process.env.DISTRU_API_KEY;
    const locationId = locationParam || process.env.DISTRU_LOCATION_ID;
    
    if (!base || !token || !locationId) {
      return NextResponse.json({ error: 'Missing env or location parameter' }, { status: 500 });
    }

    console.log(`📦 Fetching packages for location: ${locationId}`);

    const rows = await fetchPackagesAllPages(base, token, locationId);

    console.log(`📦 Raw packages fetched: ${rows.length}`);

    const items = rows
      .filter((r: any) => String(r.status).toLowerCase() === 'active')
      .filter((r: any) => (r.location?.id ?? r.location_id) === locationId)
      .map((r: any) => {
        // Extract THC data from primary_test_result
        const testResult = r.primary_test_result || {};
        const thcPercentageTotal = toNum(testResult.thc_percentage_total);
        
        return {
          id: String(r.id),
          product_id: String(r.product_id ?? ''),
          quantity_available: toNum(r.quantity_available ?? r.quantity ?? 0),
          unit_type: r.unit_type?.name ?? null,
          compliance_label: r.compliance_label ?? null,
          thc_percentage_total: thcPercentageTotal,
        };
      });

    console.log(`📦 Filtered packages: ${items.length} (active + correct location + has inventory)`);

    return NextResponse.json(items, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Route failed', details: String(e?.message || e) }, { status: 500 });
  }
}
