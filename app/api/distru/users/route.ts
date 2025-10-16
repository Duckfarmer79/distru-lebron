import { NextRequest, NextResponse } from 'next/server';

async function fetchUsersAllPages(base: string, token: string) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const all: any[] = [];

  console.log(`👥 Fetching users with correct pagination...`);

  // Use correct Distru pagination format: page[number]=X
  for (let pageNum = 1; pageNum <= 10; pageNum++) { // Limit to 10 pages for performance
    const url = `${base}/users?page[number]=${pageNum}`;
    console.log(`👥 Fetching page ${pageNum}...`);

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      console.log(`👥 Page ${pageNum} failed: ${res.status}`);
      break;
    }
    
    const json = await res.json();
    const rows: any[] = json.data ?? json.items ?? json.results ?? [];
    all.push(...rows);
    console.log(`👥 Page ${pageNum}: got ${rows.length} items (total: ${all.length})`);
    
    // If we get fewer items than expected, we've reached the end
    if (rows.length === 0 || rows.length < 25) { // Assuming ~25 items per page
      console.log(`👥 Reached end at page ${pageNum}`);
      break;
    }
  }

  console.log(`👥 Fetched ${all.length} users total`);
  return all;
}

export async function GET(_req: NextRequest) {
  try {
    const base = process.env.DISTRU_BASE_URL;
    const token = process.env.DISTRU_API_KEY;
    if (!base || !token) {
      return NextResponse.json({ error: 'Missing env variables' }, { status: 500 });
    }

    const users = await fetchUsersAllPages(base, token);

    console.log(`👥 Raw users fetched: ${users.length}`);

    // Filter for active users and map to frontend structure
    const activeUsers = users
      .filter((user: any) => !user.banned && user.email && user.full_name)
      .map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role_name: user.role?.name || 'User',
        role_id: user.role?.id,
        banned: user.banned,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)); // Sort by name

    console.log(`👥 Filtered active users: ${activeUsers.length} users`);

    return NextResponse.json(activeUsers, { status: 200 });
  } catch (e: any) {
    console.error('👥 Users route failed:', e);
    return NextResponse.json({ 
      error: 'Users route failed', 
      details: String(e?.message || e) 
    }, { status: 500 });
  }
}