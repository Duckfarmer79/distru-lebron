import { NextRequest, NextResponse } from 'next/server';

async function fetchCompaniesAllPages(base: string, token: string) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const all: any[] = [];

  console.log(`🏢 Fetching companies with correct pagination...`);

  // Use correct Distru pagination format: page[number]=X
  for (let pageNum = 1; pageNum <= 10; pageNum++) { // Limit to 10 pages for performance
    const url = `${base}/companies?page[number]=${pageNum}`;
    console.log(`🏢 Fetching page ${pageNum}...`);

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      console.log(`🏢 Page ${pageNum} failed: ${res.status}`);
      break;
    }
    
    const json = await res.json();
    const rows: any[] = json.data ?? json.items ?? json.results ?? [];
    all.push(...rows);
    console.log(`🏢 Page ${pageNum}: got ${rows.length} items (total: ${all.length})`);
    
    // If we get fewer items than expected, we've reached the end
    if (rows.length === 0 || rows.length < 25) { // Assuming ~25 items per page
      console.log(`🏢 Reached end at page ${pageNum}`);
      break;
    }
  }

  console.log(`🏢 Fetched ${all.length} companies total`);
  return all;
}

export async function GET(_req: NextRequest) {
  try {
    const base = process.env.DISTRU_BASE_URL;
    const token = process.env.DISTRU_API_KEY;
    if (!base || !token) {
      return NextResponse.json({ error: 'Missing env variables' }, { status: 500 });
    }

    const companies = await fetchCompaniesAllPages(base, token);

    console.log(`🏢 Raw companies fetched: ${companies.length}`);

    // Filter for active customers (dispensaries, retailers, etc.)
    const customers = companies
      .filter((company: any) => {
        // Only include companies with relationship_type indicating they are customers
        const relationshipType = company.relationship_type?.name?.toLowerCase() || '';
        return relationshipType.includes('customer') || 
               relationshipType.includes('client') ||
               company.category === 'Dispensary' ||
               company.category === 'Retailer';
      })
      .map((company: any) => ({
        id: company.id,
        company_name: company.name || company.legal_business_name,
        display_name: company.legal_business_name !== company.name ? company.legal_business_name : undefined,
        category: company.category,
        phone_number: company.phone_number,
        default_email: company.default_email,
        invoice_email: company.invoice_email,
        relationship_type: company.relationship_type?.name,
        primary_address: company.primary_address ? {
          street1: company.primary_address.street1 || '',
          street2: company.primary_address.street2,
          city: company.primary_address.city || '',
          state: company.primary_address.state || '',
          postal_code: company.primary_address.postal_code || '',
        } : undefined,
        locations: company.locations?.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          address: loc.address,
          license_id: loc.license_id,
        })) || [],
        licenses: company.licenses?.map((license: any) => ({
          id: license.id,
          license_number: license.license_number,
        })) || [],
        updated_datetime: company.updated_datetime,
      }));

    console.log(`🏢 Filtered customers: ${customers.length} active customers`);

    return NextResponse.json(customers, { status: 200 });
  } catch (e: any) {
    console.error('🏢 Companies route failed:', e);
    return NextResponse.json({ 
      error: 'Companies route failed', 
      details: String(e?.message || e) 
    }, { status: 500 });
  }
}