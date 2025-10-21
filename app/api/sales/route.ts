// Order Pulling API - aggregates PROCESSING orders by brand for fulfillment
import { NextRequest, NextResponse } from 'next/server';

type OrderProduct = {
  name: string;
  totalCasesToPull: number;
  totalUnitsToPull: number;
  totalDollarsValue: number;
};

type BrandOrderData = {
  brand: string;
  products: OrderProduct[];
  brandTotalCases: number;
  brandTotalUnits: number;
  brandTotalDollars: number;
};

async function fetchProcessingOrdersAllPages(base: string, token: string) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const all: any[] = [];

  console.log(`📊 Fetching PROCESSING orders for order pulling...`);

  // Fetch orders with PROCESSING status for order pulling data
  for (let pageNum = 1; pageNum <= 10; pageNum++) {
    const url = `${base}/orders?status%5B%5D=PROCESSING&page[number]=${pageNum}`;
    console.log(`📊 Fetching order pulling page ${pageNum}...`);

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      console.log(`📊 Order pulling page ${pageNum} failed: ${res.status}`);
      break;
    }
    
    const json = await res.json();
    const rows: any[] = json.data ?? json.items ?? json.results ?? [];
    all.push(...rows);
    console.log(`📊 Order pulling page ${pageNum}: got ${rows.length} orders (total: ${all.length})`);
    
    if (rows.length === 0 || rows.length < 25) {
      console.log(`📊 Reached end of order pulling data at page ${pageNum}`);
      break;
    }
  }

  console.log(`📊 Fetched ${all.length} PROCESSING orders total`);
  return all;
}

function toNum(v: any): number {
  const n = parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
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

    console.log(`📊 Generating sales analytics for location: ${locationId}`);

    // Fetch completed orders and products
    const [orders, productsResponse] = await Promise.all([
      fetchProcessingOrdersAllPages(base, token),
      fetch(`${new URL(req.url).origin}/api/distru/products`, { cache: 'no-store' })
    ]);

    if (!productsResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    const products = await productsResponse.json();
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // Aggregate sales data by product - ONLY from products that appear in PROCESSING orders
    const productSales = new Map<string, {
      product: any;
      totalCases: number;
      totalUnits: number;
      totalDollars: number;
    }>();

    // Set to track which products actually appear in orders
    const productsInOrders = new Set<string>();

    console.log(`📊 Processing ${orders.length} orders...`);

    // First pass: collect all product IDs that appear in PROCESSING orders for this location
    for (const order of orders) {
      const items = order.items || [];
      
      for (const item of items) {
        // Only include items from our target location
        if (item.location?.id !== locationId) {
          continue;
        }
        
        const productId = item.product?.id;
        if (productId) {
          productsInOrders.add(productId);
        }
      }
    }

    console.log(`� Found ${productsInOrders.size} unique products in PROCESSING orders for this location`);

    // Second pass: only process items for products that we know are in orders
    for (const order of orders) {
      const items = order.items || [];
      
      for (const item of items) {
        // Only include items from our target location
        if (item.location?.id !== locationId) {
          continue;
        }
        
        const productId = item.product?.id;
        if (!productId || !productsInOrders.has(productId)) {
          continue;
        }

        const product = productMap.get(productId);
        if (!product) {
          console.log(`🚫 Product not found in products API: ${productId}`);
          continue;
        }

        // Debug specific problem product
        if ((product as any).name && (product as any).name.includes('Payroll Giovanni')) {
          console.log(`🔍 PAYROLL GIOVANNI DEBUG:`);
          console.log(`   Order ID: ${order.id}`);
          console.log(`   Item Location ID: ${item.location?.id}`);
          console.log(`   Target Location ID: ${locationId}`);
          console.log(`   Product ID: ${productId}`);
          console.log(`   Product Name: ${(product as any).name}`);
          console.log(`   Item Qty: ${item.quantity}`);
          console.log(`   Item Price: ${item.price}`);
        }

        const quantity = toNum(item.quantity);
        const unitPrice = toNum(item.price);
        const totalPrice = unitPrice * quantity; // Total line value (unit price × quantity)
        
        console.log(`🔍 Item debug: Product=${item.product?.name?.substring(0, 30)}, Qty=${quantity}, UnitPrice=${unitPrice}, Total=${totalPrice}`);
        
        const caseSize = (product as any)?.units_per_case && (product as any).units_per_case > 0 ? (product as any).units_per_case : 1;
        const casesDecimal = quantity / caseSize;
        
        console.log(`📦 Case calc: CaseSize=${caseSize}, Cases=${casesDecimal}`);

        const existing = productSales.get(productId) || {
          product,
          totalCases: 0,
          totalUnits: 0,
          totalDollars: 0
        };

        productSales.set(productId, {
          product,
          totalCases: existing.totalCases + casesDecimal,
          totalUnits: existing.totalUnits + quantity,
          totalDollars: existing.totalDollars + totalPrice
        });
      }
    }

    // Group by brand
    const brandMap = new Map<string, BrandOrderData>();

    for (const [productId, sales] of productSales) {
      const brand = sales.product.brand || 'Unknown Brand';
      
      if (!brandMap.has(brand)) {
        brandMap.set(brand, {
          brand,
          products: [],
          brandTotalCases: 0,
          brandTotalUnits: 0,
          brandTotalDollars: 0
        });
      }

      const brandData = brandMap.get(brand)!;
      
      brandData.products.push({
        name: sales.product.name || 'Unnamed Product',
        totalCasesToPull: Math.round(sales.totalCases * 100) / 100, // Round to 2 decimals
        totalUnitsToPull: sales.totalUnits,
        totalDollarsValue: Math.round(sales.totalDollars * 100) / 100
      });

      brandData.brandTotalCases += sales.totalCases;
      brandData.brandTotalUnits += sales.totalUnits;
      brandData.brandTotalDollars += sales.totalDollars;
    }

    // Round brand totals and sort products within each brand
    const orderData = Array.from(brandMap.values()).map(brand => ({
      ...brand,
      brandTotalCases: Math.round(brand.brandTotalCases * 100) / 100,
      brandTotalDollars: Math.round(brand.brandTotalDollars * 100) / 100,
      products: brand.products.sort((a, b) => b.totalDollarsValue - a.totalDollarsValue) // Sort by highest value
    })).sort((a, b) => b.brandTotalDollars - a.brandTotalDollars); // Sort brands by highest value

    console.log(`📊 Generated order pulling data for ${orderData.length} brands`);

    return NextResponse.json(orderData, { status: 200 });
  } catch (e: any) {
    console.error('📊 Order pulling analytics error:', e);
    return NextResponse.json({ error: 'Order pulling analytics failed', details: String(e?.message || e) }, { status: 500 });
  }
}