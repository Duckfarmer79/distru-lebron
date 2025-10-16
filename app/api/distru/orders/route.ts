import { NextRequest, NextResponse } from 'next/server';

function toNum(x: any) {
  const v = parseFloat(String(x));
  return Number.isFinite(v) ? v : 0;
}

async function fetchOrdersAllPages(base: string, token: string, locationId: string) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const all: any[] = [];

  console.log(`📋 Fetching processing orders...`);

  // Use correct Distru pagination format and filter by status=PROCESSING
  for (let pageNum = 1; pageNum <= 5; pageNum++) { // Limit to 5 pages for performance
    const url = `${base}/orders?page[number]=${pageNum}&statuses[]=PROCESSING`;
    console.log(`📋 Fetching orders page ${pageNum}...`);

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      console.log(`📋 Orders page ${pageNum} failed: ${res.status}`);
      break;
    }
    
    const json = await res.json();
    const rows: any[] = json.data ?? json.items ?? json.results ?? [];
    all.push(...rows);
    console.log(`📋 Orders page ${pageNum}: got ${rows.length} orders (total: ${all.length})`);
    
    // If we get fewer items than expected, we've reached the end
    if (rows.length === 0 || rows.length < 25) {
      console.log(`📋 Reached end at page ${pageNum}`);
      break;
    }
  }

  console.log(`📋 Fetched ${all.length} processing orders total`);
  return all;
}

export async function GET(_req: NextRequest) {
  try {
    const base = process.env.DISTRU_BASE_URL;
    const token = process.env.DISTRU_API_KEY;
    const locationId = process.env.DISTRU_LOCATION_ID;
    if (!base || !token || !locationId) {
      return NextResponse.json({ error: 'Missing env' }, { status: 500 });
    }

    const orders = await fetchOrdersAllPages(base, token, locationId);

    console.log(`📋 Raw orders fetched: ${orders.length}`);

    // Extract order items with quantities committed per product
    const commitments: any[] = [];
    
    for (const order of orders) {
      if (order.status !== 'PROCESSING') continue; // Double-check status
      
      const items = order.items || [];
      for (const item of items) {
        // Only include items from our target location
        if (item.location?.id === locationId) {
          commitments.push({
            order_id: order.id,
            order_number: order.order_number,
            product_id: item.product?.id,
            product_name: item.product?.name,
            quantity_committed: toNum(item.quantity),
            location_id: item.location?.id,
          });
        }
      }
    }

    console.log(`📋 Processed commitments: ${commitments.length} items from processing orders`);

    return NextResponse.json(commitments, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Orders route failed', details: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const base = process.env.DISTRU_BASE_URL;
    const token = process.env.DISTRU_API_KEY;
    const locationId = process.env.DISTRU_LOCATION_ID;
    if (!base || !token || !locationId) {
      return NextResponse.json({ error: 'Missing env variables' }, { status: 500 });
    }

    const body = await req.json();
    const { cart, customerInfo, selectedCustomer, selectedOwner, selectedSalesRep } = body;

    console.log(`📋 Creating order with ${cart?.length} items for customer: ${selectedCustomer?.company_name}`);
    console.log(`📋 Owner: ${selectedOwner?.full_name || 'None'}, Sales Rep: ${selectedSalesRep?.full_name || 'None'}`);

    // Validate required customer selection
    if (!selectedCustomer?.id) {
      return NextResponse.json({ 
        error: 'Customer selection required', 
        details: 'Please select a customer before submitting the order' 
      }, { status: 400 });
    }

    // Convert cart items to Distru order format
    const orderItems = cart.map((item: any) => {
      const totalUnits = item.qtyUnits + (item.qtyCases * item.case_size);
      return {
        product_id: item.product_id,
        quantity: totalUnits.toString(),
        price_base: item.price_per_unit.toString(),
        location_id: locationId,
      };
    });

    // Calculate order totals
    const subtotal = cart.reduce((sum: number, item: any) => {
      return sum + (item.qtyUnits * item.price_per_unit) + (item.qtyCases * item.price_per_case);
    }, 0);

    // Get customer's preferred shipping/billing location
    const customerShippingLocation = selectedCustomer.locations?.[0]; // Use first location as default
    const shippingLocationId = customerShippingLocation?.id || locationId;

    // Build notes with user assignments
    const userAssignments = [];
    if (selectedOwner) userAssignments.push(`Owner: ${selectedOwner.full_name} (${selectedOwner.email})`);
    if (selectedSalesRep) userAssignments.push(`Sales Rep: ${selectedSalesRep.full_name} (${selectedSalesRep.email})`);
    
    const assignmentNotes = userAssignments.length > 0 ? `\n\nAssignments:\n${userAssignments.join('\n')}` : '';
    const customNotes = customerInfo?.notes ? `\n\nCustomer Notes: ${customerInfo.notes}` : '';

    const orderPayload = {
      company_id: selectedCustomer.id,
      status: 'PROCESSING',
      order_datetime: new Date().toISOString(),
      due_datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      billing_location_id: locationId, // Our location for billing
      shipping_location_id: shippingLocationId, // Customer's location for shipping
      external_notes: customerInfo?.notes || `Order for ${selectedCustomer.company_name}`,
      internal_notes: `Order created via Distru-LeBron app for ${selectedCustomer.company_name} (${selectedCustomer.display_name || selectedCustomer.company_name}). Customer: ${selectedCustomer.relationship_type}. Subtotal: $${subtotal.toFixed(2)}${assignmentNotes}${customNotes}`,
      items: orderItems,
      charges: [] // No additional charges for now
    };

    console.log(`📋 Submitting order to Distru:`, JSON.stringify(orderPayload, null, 2));

    const response = await fetch(`${base}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`📋 Order creation failed: ${response.status} - ${errorText}`);
      return NextResponse.json({ 
        error: 'Order creation failed', 
        details: errorText,
        status: response.status 
      }, { status: response.status });
    }

    const orderResult = await response.json();
    console.log(`📋 Order created successfully:`, orderResult.data?.order_number);

    return NextResponse.json({
      success: true,
      order: orderResult.data,
      customer: selectedCustomer,
      message: `Order ${orderResult.data?.order_number} created successfully for ${selectedCustomer.name}!`
    }, { status: 201 });

  } catch (e: any) {
    console.error(`📋 Order creation error:`, e);
    return NextResponse.json({ 
      error: 'Order creation failed', 
      details: String(e?.message || e) 
    }, { status: 500 });
  }
}