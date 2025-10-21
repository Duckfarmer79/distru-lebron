'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTotals, addUnits } from '../lib/cart';
import SmsInfo from '../components/SmsInfo';
import ChatWidget from '../components/ChatWidget';

// Default image for products missing images
const DEFAULT_PRODUCT_IMAGE = '/default-product.JPG';

// Fallback placeholder SVG for when image fails to load
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23f5f5f5"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial, sans-serif" font-size="14" fill="%23999" text-anchor="middle" dy="0.3em"%3ENo Image%3C/text%3E%3C/svg%3E';

// Helper function to get product image with fallback
function getProductImage(imageUrl: string | null): string {
  return imageUrl || DEFAULT_PRODUCT_IMAGE;
}

type MenuItem = {
  product_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  units: number;
  case_size: number;
  cases_available: number;
  price_per_unit: number;
  price_per_case: number;
  image_url: string | null;
  unit_type: string | null;
  avg_thc_percentage: number | null;
};

type CartItem = {
  product_id: string;
  name: string;
  brand: string | null;
  case_size: number;
  image_url: string | null;
  mode: 'unit' | 'case';
  qtyUnits: number;
  qtyCases: number;
  price_per_unit: number;
  price_per_case: number;
};

type Customer = {
  id: string;
  company_name: string;
  display_name?: string;
  category: string;
  phone_number: string | null;
  default_email: string | null;
  invoice_email: string | null;
  relationship_type: string;
  primary_address?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  locations: {
    id: string;
    name: string;
    address: string;
    license_id: string;
  }[];
  licenses: {
    id: string;
    license_number: string;
  }[];
  updated_datetime: string;
};

type User = {
  id: string;
  email: string;
  full_name: string;
  role_name: string;
  role_id?: string;
  banned: boolean;
};

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => {
  console.log('🌐 Fetch response:', { url, status: r.status, ok: r.ok });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json().then(data => {
    console.log('📦 Parsed data:', { length: data?.length, sample: data?.[0] });
    return data;
  });
});

function currency(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0);
}

function ItemCard({
  item,
  onAdd,
  reservedUnits = 0,
}: {
  item: MenuItem;
  onAdd: (ci: CartItem) => void;
  reservedUnits?: number;
}) {
  const [mode, setMode] = useState<'unit' | 'case'>('case');
  const [qtyUnits, setQtyUnits] = useState<number>(0);
  const [qtyCases, setQtyCases] = useState<number>(1);
  const [ppu, setPpu] = useState<number>(item.price_per_unit || 0);
  const [ppc, setPpc] = useState<number>(item.price_per_case || (item.price_per_unit * item.case_size));

  function handlePpuChange(v: string) {
    const n = parseFloat(v);
    const val = Number.isFinite(n) ? n : 0;
    setPpu(val);
    setPpc(val * (item.case_size || 1));
  }

  function handlePpcChange(v: string) {
    const n = parseFloat(v);
    const val = Number.isFinite(n) ? n : 0;
    setPpc(val);
    const cs = item.case_size || 1;
    setPpu(cs ? val / cs : 0);
  }

  function addToCart() {
    onAdd({
      product_id: item.product_id,
      name: item.name,
      brand: item.brand,
      case_size: item.case_size,
      image_url: item.image_url,
      mode,
      qtyUnits: Math.max(0, Math.floor(qtyUnits)),
      qtyCases: Math.max(0, Math.floor(qtyCases)),
      price_per_unit: ppu,
      price_per_case: ppc,
    });
    setQtyUnits(0);
    setQtyCases(1);
  }

  const maxUnits = item.units;
  const maxCases = Math.floor(item.units / (item.case_size || 1));
  
  // Calculate display values with optimistic reservations
  const displayUnits = Math.max(0, maxUnits - reservedUnits);
  const displayCases = Math.floor(displayUnits / (item.case_size || 1));

  return (
    <div className="rounded-2xl shadow p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col">
            <div className="relative bg-neutral-100 dark:bg-neutral-800 rounded-xl aspect-square overflow-hidden">
        <img 
          src={getProductImage(item.image_url)} 
          alt={item.name} 
          className="w-full h-full object-cover"
          onError={(e) => {
            // If the default image fails, use placeholder
            const target = e.target as HTMLImageElement;
            if (target.src.includes('default-product.JPG')) {
              target.src = PLACEHOLDER_IMAGE;
            } else {
              target.src = DEFAULT_PRODUCT_IMAGE;
            }
          }}
        />
        <div className="hidden w-full h-full flex items-center justify-center text-neutral-400 text-sm bg-neutral-100 dark:bg-neutral-800">
          No Image
        </div>
      </div>
      <div className="text-sm text-neutral-500">{item.brand || '—'}</div>
      <div className="font-semibold">{item.name}</div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-2">
          <div className="text-neutral-500">Units</div>
          <div className={`font-semibold ${reservedUnits > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
            {displayUnits}
            {reservedUnits > 0 && (
              <span className="text-xs text-neutral-400 ml-1">({maxUnits})</span>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-2">
          <div className="text-neutral-500">Case Size</div>
          <div className="font-semibold">{item.case_size}</div>
        </div>
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-2">
          <div className="text-neutral-500">Cases Avail</div>
          <div className={`font-semibold ${reservedUnits > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
            {displayCases}
            {reservedUnits > 0 && (
              <span className="text-xs text-neutral-400 ml-1">({maxCases})</span>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-2">
          <div className="text-neutral-500">Avg THC</div>
          <div className="font-semibold text-green-600 dark:text-green-400">
            {item.avg_thc_percentage ? `${item.avg_thc_percentage.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-neutral-500">Unit Price</div>
          <input
            type="number"
            step="0.01"
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2"
            value={ppu}
            onChange={(e) => handlePpuChange(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs text-neutral-500">Case Price</div>
          <input
            type="number"
            step="0.01"
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2"
            value={ppc}
            onChange={(e) => handlePpcChange(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setMode('case')}
          className={`flex-1 rounded-lg p-2 text-sm ${mode === 'case' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-neutral-100 dark:bg-neutral-800'}`}
        >
          By Case
        </button>
        <button
          onClick={() => setMode('unit')}
          className={`flex-1 rounded-lg p-2 text-sm ${mode === 'unit' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-neutral-100 dark:bg-neutral-800'}`}
        >
          By Unit
        </button>
      </div>

      {mode === 'unit' ? (
        <div className="mt-3">
          <div className="text-xs text-neutral-500 mb-1">Units Qty</div>
          <input
            type="number"
            min={0}
            max={maxUnits} // Keep original max to allow overselling
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2"
            value={qtyUnits}
            onChange={(e) => setQtyUnits(parseInt(e.target.value || '0', 10))}
          />
          <div className="mt-1 text-xs text-neutral-500">
            Available: {displayUnits}
            {reservedUnits > 0 && <span className="text-orange-600 dark:text-orange-400"> ({reservedUnits} reserved)</span>}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="text-xs text-neutral-500 mb-1">Cases Qty</div>
          <input
            type="number"
            min={0}
            max={maxCases} // Keep original max to allow overselling
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2"
            value={qtyCases}
            onChange={(e) => setQtyCases(parseInt(e.target.value || '0', 10))}
          />
          <div className="mt-1 text-xs text-neutral-500">
            Available: {displayCases}
            {reservedUnits > 0 && <span className="text-orange-600 dark:text-orange-400"> ({Math.floor(reservedUnits / (item.case_size || 1))} cases reserved)</span>}
          </div>
        </div>
      )}

      <button
        onClick={addToCart}
        className="mt-4 rounded-xl bg-black text-white dark:bg-white dark:text-black p-3 font-medium"
      >
        Add
      </button>
    </div>
  );
}

export default function Page() {
  // Location state - default to the first location
  const [currentLocation, setCurrentLocation] = useState('00000000-0000-0000-0000-000000056821');

  // Tab state
  const [activeTab, setActiveTab] = useState<'menu' | 'sales'>('menu');

  // Location definitions
  const locations = [
    { id: '00000000-0000-0000-0000-000000056821', name: 'Warehouse A' },
    { id: '00000000-0000-0000-0000-00000005673a', name: 'Warehouse B' },
  ];

  const { data, error, isLoading } = useSWR<MenuItem[]>(
    `/api/menu?location=${currentLocation}`, 
    fetcher, 
    {
      refreshInterval: 30000,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  // Order pulling data for PROCESSING orders
  const { data: salesData, error: salesError, isLoading: salesLoading } = useSWR(
    activeTab === 'sales' ? `/api/sales?location=${currentLocation}` : null,
    fetcher,
    {
      refreshInterval: 60000, // Refresh less frequently for order pulling data
      dedupingInterval: 30000,
    }
  );

  // Clear cart when location changes
  const handleLocationChange = (newLocationId: string) => {
    if (cart.length > 0) {
      const confirmed = window.confirm(
        'Switching locations will clear your cart. Continue?'
      );
      if (!confirmed) return;
      
      // Clear cart
      setCart([]);
    }
    setCurrentLocation(newLocationId);
  };

  const { data: customers, error: customersError, isLoading: customersLoading } = useSWR<Customer[]>('/api/distru/companies', fetcher, {
    revalidateOnMount: true,
    revalidateOnFocus: false,
  });

  // Fetch users from users API
  const { data: users, error: usersError, isLoading: usersLoading } = useSWR<User[]>('/api/distru/users', fetcher, {
    refreshInterval: 600000, // 10 minutes for users (they don't change often)
    revalidateOnFocus: false,
  });

  // Debug customers data
  console.log('🎯 Frontend customers data:', {
    customersCount: customers?.length,
    isLoading: customersLoading,
    error: customersError?.message,
    first3Customers: customers?.slice(0, 3)?.map(c => ({ id: c.id, company_name: c.company_name, display_name: c.display_name }))
  });

  // Add useEffect to monitor when customers data changes
  React.useEffect(() => {
    if (customers) {
      console.log('✅ Customers loaded!', customers.length, 'customers');
      console.log('Sample customer:', customers[0]);
    }
    if (customersError) {
      console.error('❌ Customers error:', customersError);
    }
  }, [customers, customersError]);

  // Debug users data
  console.log('👥 Frontend users data:', {
    usersCount: users?.length,
    isLoading: usersLoading,
    error: usersError?.message,
    first3Users: users?.slice(0, 3)?.map(u => ({ id: u.id, full_name: u.full_name, role_name: u.role_name }))
  });

  console.log('🎯 Frontend received:', { 
    dataLength: data?.length, 
    isLoading, 
    error: error?.message,
    errorDetails: error,
    first5Items: data?.slice(0, 5)?.map(item => ({ id: item.product_id, name: item.name }))
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'quantity' | 'name' | 'thc'>('quantity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderMessage, setOrderMessage] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<User | null>(null);
  const [selectedSalesRep, setSelectedSalesRep] = useState<User | null>(null);
  
  // Bulk Fill State
  const [bulkFillQuantity, setBulkFillQuantity] = useState<number>(1);
  const [bulkFillBrand, setBulkFillBrand] = useState<string>('');
  const [bulkFillCategory, setBulkFillCategory] = useState<string>('');

  // Add a simple test to see what we have
  const testDisplay = data ? `Got ${data.length} items` : isLoading ? 'Loading...' : error ? `Error: ${error.message}` : 'No data';
  const totalsStore = useTotals();

  // Get unique brands and categories for filter dropdowns
  const uniqueBrands = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const brands = data
      .map(item => item.brand)
      .filter((brand): brand is string => Boolean(brand && brand.trim()))
      .filter((brand, index, arr) => arr.indexOf(brand) === index)
      .sort();
    return brands;
  }, [data]);

  const uniqueCategories = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const categories = data
      .map(item => item.category)
      .filter((category): category is string => Boolean(category && category.trim()))
      .filter((category, index, arr) => arr.indexOf(category) === index)
      .sort();
    return categories;
  }, [data]);

  function addToCart(ci: CartItem) {
    const cs = Math.max(1, ci.case_size);
    setCart(prev => {
      const idx = prev.findIndex(
        p =>
          p.product_id === ci.product_id &&
          p.price_per_unit === ci.price_per_unit &&
          p.price_per_case === ci.price_per_case &&
          p.mode === ci.mode
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          qtyUnits: next[idx].qtyUnits + ci.qtyUnits,
          qtyCases: next[idx].qtyCases + ci.qtyCases,
        };
        return next;
      }
      return [...prev, ci];
    });
    const unitsToAdd = ci.qtyUnits + ci.qtyCases * cs;
    const unitPriceUsed = ci.mode === 'case' ? ci.price_per_case / cs : ci.price_per_unit;
    if (unitsToAdd > 0) addUnits(unitsToAdd, unitPriceUsed, cs);
  }

  function removeFromCart(pid: string) {
    setCart(prev => prev.filter(p => p.product_id !== pid));
  }

  async function submitOrder() {
    if (cart.length === 0) {
      setOrderMessage('Cart is empty. Please add items before submitting order.');
      return;
    }

    if (!selectedCustomer) {
      setOrderMessage('Please select a customer before submitting the order.');
      return;
    }

    setIsSubmittingOrder(true);
    setOrderMessage('');

    try {
      const response = await fetch('/api/distru/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cart: cart,
          customerInfo: {
            notes: customerNotes.trim() || null,
          },
          selectedCustomer: selectedCustomer,
          selectedOwner: selectedOwner,
          selectedSalesRep: selectedSalesRep,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setOrderMessage(result.message || 'Order submitted successfully!');
        setCart([]); // Clear cart on successful submission
        setCustomerNotes(''); // Clear notes
        setSelectedCustomer(null); // Clear customer selection
        setSelectedOwner(null); // Clear owner selection
        setSelectedSalesRep(null); // Clear sales rep selection
        // Refresh the menu data to update inventory
        window.location.reload();
      } else {
        setOrderMessage(`Order submission failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setOrderMessage(`Order submission failed: ${err.message || 'Network error'}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  // Bulk Fill Function
  function handleBulkFill() {
    if (!bulkFillBrand || !bulkFillCategory || bulkFillQuantity < 1) {
      alert('Please select a quantity, brand, and category for bulk fill.');
      return;
    }

    // Find all products matching the brand and category
    const matchingProducts = data?.filter((item: MenuItem) => 
      item.brand === bulkFillBrand && 
      item.category === bulkFillCategory &&
      item.cases_available > 0 // Only include products with available case stock
    ) || [];

    if (matchingProducts.length === 0) {
      alert(`No products found for brand "${bulkFillBrand}" in category "${bulkFillCategory}" with available case stock.`);
      return;
    }

    // Add each matching product to cart with the specified quantity
    let addedCount = 0;
    matchingProducts.forEach((item: MenuItem) => {
      // Check if we can add the requested quantity (don't exceed available stock)
      const availableCases = item.cases_available;
      const quantityToAdd = Math.min(bulkFillQuantity, availableCases);

      if (quantityToAdd > 0) {
        // Create a cart item similar to how the individual product cards do it
        const cartItem: CartItem = {
          product_id: item.product_id,
          name: item.name,
          brand: item.brand,
          case_size: item.case_size,
          price_per_unit: item.price_per_unit,
          price_per_case: item.price_per_case,
          image_url: item.image_url,
          
          // Set the bulk quantity for CASES
          qtyUnits: 0,
          qtyCases: quantityToAdd,
          mode: 'case' as 'unit' | 'case'
        };

        // Check if this product is already in cart
        const existingIndex = cart.findIndex(c => 
          c.product_id === item.product_id && 
          c.price_per_unit === item.price_per_unit && 
          c.price_per_case === item.price_per_case
        );

        if (existingIndex >= 0) {
          // Update existing cart item
          setCart(prev => prev.map((c, i) => 
            i === existingIndex 
              ? { ...c, qtyCases: c.qtyCases + quantityToAdd }
              : c
          ));
        } else {
          // Add new cart item
          setCart(prev => [...prev, cartItem]);
        }
        
        addedCount++;
      }
    });

    // Show success message
    alert(`Bulk fill completed! Added ${bulkFillQuantity} cases each to ${addedCount} products from "${bulkFillBrand}" in "${bulkFillCategory}".`);
    
    // Reset bulk fill selections
    setBulkFillQuantity(1);
    setBulkFillBrand('');
    setBulkFillCategory('');
  }

  const totals = useMemo(() => {
    let units = 0;
    let cases = 0;
    let subtotal = 0;
    for (const c of cart) {
      units += c.qtyUnits + c.qtyCases * c.case_size;
      cases += c.qtyCases;
      subtotal += c.qtyUnits * c.price_per_unit + c.qtyCases * c.price_per_case;
    }
    return { units, cases, subtotal };
  }, [cart]);

  const visibleItems = useMemo(() => {
    if (!Array.isArray(data)) return [];
    
    // First, filter the items
    const filtered = data.filter(item => {
      // Keep existing inventory filter
      if ((item.units || 0) <= 0) return false;
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (item.name || '').toLowerCase().includes(query);
        const brandMatch = (item.brand || '').toLowerCase().includes(query);
        const categoryMatch = (item.category || '').toLowerCase().includes(query);
        
        if (!nameMatch && !brandMatch && !categoryMatch) return false;
      }
      
      // Brand filter
      if (selectedBrand !== 'all' && item.brand !== selectedBrand) return false;
      
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      
      return true;
    });

    // Then, sort the filtered items
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'quantity':
          comparison = (a.units || 0) - (b.units || 0);
          break;
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'thc':
          const aThc = a.avg_thc_percentage || 0;
          const bThc = b.avg_thc_percentage || 0;
          comparison = aThc - bThc;
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort order (desc = reverse)
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [data, selectedBrand, selectedCategory, sortBy, sortOrder, searchQuery]);

  // Calculate reserved units per product from cart
  const getReservedUnits = useMemo(() => {
    const reservedByProduct = new Map<string, number>();
    for (const cartItem of cart) {
      const currentReserved = reservedByProduct.get(cartItem.product_id) || 0;
      const totalReservedUnits = cartItem.qtyUnits + (cartItem.qtyCases * cartItem.case_size);
      reservedByProduct.set(cartItem.product_id, currentReserved + totalReservedUnits);
    }
    return (productId: string) => reservedByProduct.get(productId) || 0;
  }, [cart]);

  if (error) {
    return <div className="p-6 text-red-600">Failed to load menu</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="fixed top-2 right-2 z-40 text-xs bg-neutral-900 text-white rounded-full px-3 py-1 shadow">
        {totalsStore.units} • {totalsStore.cases} • {currency(totalsStore.subtotal)}
      </div>

      <header className="sticky top-0 z-10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto p-4">
          {/* Top row with title and location */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-6">
              <div className="text-lg font-semibold">Distru Menu - {testDisplay}</div>
              
              {/* Location Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Location:</span>
                <select
                  value={currentLocation}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-sm font-medium"
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex">
              <button
                onClick={() => setActiveTab('menu')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'menu'
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                Product Menu
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ml-2 ${
                  activeTab === 'sales'
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                Order Pulling
              </button>
            </div>
            
            {/* Filter and Sort Controls - only show for menu tab */}
            {activeTab === 'menu' && (
              <div className="flex items-center gap-3">
                {/* Search Input */}
              <input
                type="text"
                placeholder="Search products, brands, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-sm w-64 placeholder:text-neutral-400"
              />

              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-sm"
              >
                <option value="all">All Brands</option>
                {uniqueBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-sm"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'quantity' | 'name' | 'thc')}
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-sm"
                >
                  <option value="quantity">Quantity</option>
                  <option value="name">Name</option>
                  <option value="thc">THC %</option>
                </select>
                
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <div className="text-neutral-500">Total Units</div>
              <div className="font-semibold">{totals.units}</div>
            </div>
            <div className="text-sm">
              <div className="text-neutral-500">Total Cases</div>
              <div className="font-semibold">{totals.cases}</div>
            </div>
            <div className="text-sm">
              <div className="text-neutral-500">Subtotal</div>
              <div className="font-semibold">{currency(totals.subtotal)}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Tab Content */}
      {activeTab === 'menu' && (
        <>
          {/* Bulk Fill Section */}
          <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-700 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
              🚀 Bulk Fill Orders
            </h3>
            <span className="text-xs text-green-600 dark:text-green-400">Add same number of cases to multiple products at once</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Quantity Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-green-700 dark:text-green-300 min-w-[30px]">Qty:</label>
              <select
                value={bulkFillQuantity}
                onChange={(e) => setBulkFillQuantity(Number(e.target.value))}
                className="rounded-lg border border-green-300 dark:border-green-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm min-w-[70px] focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>

            {/* Brand Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-green-700 dark:text-green-300 min-w-[40px]">Brand:</label>
              <select
                value={bulkFillBrand}
                onChange={(e) => setBulkFillBrand(e.target.value)}
                className="rounded-lg border border-green-300 dark:border-green-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              >
                <option value="">Select Brand</option>
                {uniqueBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {/* Category Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-green-700 dark:text-green-300 min-w-[60px]">Category:</label>
              <select
                value={bulkFillCategory}
                onChange={(e) => setBulkFillCategory(e.target.value)}
                className="rounded-lg border border-green-300 dark:border-green-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              >
                <option value="">Select Category</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Bulk Fill Button */}
            <button
              onClick={handleBulkFill}
              disabled={!bulkFillBrand || !bulkFillCategory}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ml-auto ${
                bulkFillBrand && bulkFillCategory
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transform hover:scale-105'
                  : 'bg-neutral-300 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-400 cursor-not-allowed'
              }`}
            >
              {bulkFillBrand && bulkFillCategory ? '+ Add to Cart' : 'Select Brand & Category'}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading && <div className="col-span-full text-neutral-500">Loading…</div>}
        {visibleItems.length === 0 && !isLoading && (
          <div className="col-span-full text-neutral-500">No active items</div>
        )}
        {visibleItems.map(item => (
          <ItemCard 
            key={item.product_id} 
            item={item} 
            onAdd={addToCart} 
            reservedUnits={getReservedUnits(item.product_id)}
          />
        ))}
      </main>

      <aside className="max-w-7xl mx-auto p-4">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="font-semibold mb-3">Cart</div>
          {cart.length === 0 ? (
            <div className="text-neutral-500 text-sm">Empty</div>
          ) : (
            <div className="space-y-3">
              {cart.map(c => (
                <div key={c.product_id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 bg-neutral-50 dark:bg-neutral-800/50">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0">
                      <img 
                        src={getProductImage(c.image_url)} 
                        alt={c.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src.includes('default-product.JPG')) {
                            target.src = PLACEHOLDER_IMAGE;
                          } else {
                            target.src = DEFAULT_PRODUCT_IMAGE;
                          }
                        }}
                      />
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-neutral-500">{c.brand || '—'}</div>
                      </div>
                      
                      {/* Editable Quantities and Prices */}
                      <div className="space-y-2">
                        {/* Units Row - Show if there are units OR always show price editing */}
                        {(c.qtyUnits > 0 || c.qtyCases > 0) && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="min-w-[40px]">Units:</span>
                            {c.qtyUnits > 0 ? (
                              <input
                                type="number"
                                min="0"
                                value={c.qtyUnits}
                                onChange={(e) => {
                                  const newQty = Math.max(0, parseInt(e.target.value) || 0);
                                  setCart(prev => prev.map(item => 
                                    item.product_id === c.product_id ? { ...item, qtyUnits: newQty } : item
                                  ));
                                }}
                                className="w-16 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-xs"
                              />
                            ) : (
                              <span className="w-16 px-2 py-1 text-center text-neutral-400 text-xs">0</span>
                            )}
                            <span>@</span>
                            <span className="text-neutral-500">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={c.price_per_unit}
                              onChange={(e) => {
                                const newPrice = Math.max(0, parseFloat(e.target.value) || 0);
                                setCart(prev => prev.map(item => 
                                  item.product_id === c.product_id ? { 
                                    ...item, 
                                    price_per_unit: newPrice,
                                    price_per_case: newPrice * item.case_size // Auto-sync case price
                                  } : item
                                ));
                              }}
                              className="w-20 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-xs"
                            />
                            {c.qtyUnits > 0 && (
                              <span className="text-neutral-500">= {currency(c.qtyUnits * c.price_per_unit)}</span>
                            )}
                          </div>
                        )}
                        
                        {/* Cases Row - Show if there are cases OR always show price editing */}
                        {(c.qtyCases > 0 || c.qtyUnits > 0) && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="min-w-[40px]">Cases:</span>
                            {c.qtyCases > 0 ? (
                              <input
                                type="number"
                                min="0"
                                value={c.qtyCases}
                                onChange={(e) => {
                                  const newQty = Math.max(0, parseInt(e.target.value) || 0);
                                  setCart(prev => prev.map(item => 
                                    item.product_id === c.product_id ? { ...item, qtyCases: newQty } : item
                                  ));
                                }}
                                className="w-16 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-xs"
                              />
                            ) : (
                              <span className="w-16 px-2 py-1 text-center text-neutral-400 text-xs">0</span>
                            )}
                            <span>@</span>
                            <span className="text-neutral-500">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={c.price_per_case}
                              onChange={(e) => {
                                const newPrice = Math.max(0, parseFloat(e.target.value) || 0);
                                const caseSize = c.case_size || 1;
                                setCart(prev => prev.map(item => 
                                  item.product_id === c.product_id ? { 
                                    ...item, 
                                    price_per_case: newPrice,
                                    price_per_unit: caseSize ? newPrice / caseSize : 0 // Auto-sync unit price
                                  } : item
                                ));
                              }}
                              className="w-20 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-xs"
                            />
                            {c.qtyCases > 0 && (
                              <span className="text-neutral-500">= {currency(c.qtyCases * c.price_per_case)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-semibold mb-2">
                        {currency(c.qtyUnits * c.price_per_unit + c.qtyCases * c.price_per_case)}
                      </div>
                      <button
                        onClick={() => removeFromCart(c.product_id)}
                        className="text-xs px-2 py-1 rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Customer Selection - Simplified Debug Version */}
              <div className="mt-4">
                <label htmlFor="customer-select" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Select Customer * {customersLoading ? '(Loading...)' : `(${customers?.length || 0} available)`}
                </label>
                
                {customersError && (
                  <div className="text-red-600 dark:text-red-400 text-sm mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    Error loading customers: {customersError.message}
                  </div>
                )}
                
                <select
                  id="customer-select"
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customerId = e.target.value;
                    const customer = customers?.find((c: Customer) => c.id === customerId) || null;
                    setSelectedCustomer(customer);
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg 
                           bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={customersLoading}
                >
                  <option value="" style={{color: 'black', backgroundColor: 'white'}}>
                    {customersLoading ? 'Loading customers...' : 'Select a customer'}
                  </option>
                  {customers?.map((customer: Customer) => (
                    <option 
                      key={customer.id} 
                      value={customer.id}
                      style={{color: 'black', backgroundColor: 'white'}}
                    >
                      {customer.company_name || customer.id} 
                      {customer.display_name && customer.display_name !== customer.company_name 
                        ? ` (${customer.display_name})` 
                        : ''
                      }
                    </option>
                  ))}
                </select>
                
                {!customersLoading && (!customers || customers.length === 0) && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm rounded">
                    No customers found. Check API configuration.
                  </div>
                )}

                {selectedCustomer && (
                  <div className="mt-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-sm">
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {selectedCustomer.company_name}
                    </div>
                    {selectedCustomer.display_name && selectedCustomer.display_name !== selectedCustomer.company_name && (
                      <div className="text-neutral-600 dark:text-neutral-400">
                        Display Name: {selectedCustomer.display_name}
                      </div>
                    )}
                    {selectedCustomer.primary_address && (
                      <div className="text-neutral-600 dark:text-neutral-400 mt-1">
                        {selectedCustomer.primary_address.street1}
                        {selectedCustomer.primary_address.street2 && `, ${selectedCustomer.primary_address.street2}`}
                        <br />
                        {selectedCustomer.primary_address.city}, {selectedCustomer.primary_address.state} {selectedCustomer.primary_address.postal_code}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Owner Selection */}
              <div className="mt-4">
                <label htmlFor="owner-select" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Owner {usersLoading ? '(Loading...)' : users ? `(${users.length} available)` : ''}
                </label>
                {usersError ? (
                  <div className="text-red-600 dark:text-red-400 text-sm mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    Error loading users: {usersError.message}
                  </div>
                ) : users && users.length === 0 ? (
                  <div className="text-yellow-600 dark:text-yellow-400 text-sm mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    No users found
                  </div>
                ) : (
                  <select
                    id="owner-select"
                    value={selectedOwner?.id || ''}
                    onChange={(e) => {
                      const userId = e.target.value;
                      const user = users?.find((u: User) => u.id === userId) || null;
                      setSelectedOwner(user);
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg 
                             bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100
                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={usersLoading}
                  >
                    <option value="" style={{color: 'black', backgroundColor: 'white'}}>
                      {usersLoading ? 'Loading users...' : 'Select an owner (optional)'}
                    </option>
                    {users?.map((user: User) => (
                      <option 
                        key={user.id} 
                        value={user.id}
                        style={{color: 'black', backgroundColor: 'white'}}
                      >
                        {user.full_name} - {user.role_name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedOwner && (
                  <div className="mt-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-sm">
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {selectedOwner.full_name}
                    </div>
                    <div className="text-neutral-600 dark:text-neutral-400">
                      Role: {selectedOwner.role_name} • Email: {selectedOwner.email}
                    </div>
                  </div>
                )}
              </div>

              {/* Sales Rep Selection */}
              <div className="mt-4">
                <label htmlFor="salesrep-select" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Sales Representative {usersLoading ? '(Loading...)' : users ? `(${users.length} available)` : ''}
                </label>
                {usersError ? (
                  <div className="text-red-600 dark:text-red-400 text-sm mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    Error loading users: {usersError.message}
                  </div>
                ) : users && users.length === 0 ? (
                  <div className="text-yellow-600 dark:text-yellow-400 text-sm mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    No users found
                  </div>
                ) : (
                  <select
                    id="salesrep-select"
                    value={selectedSalesRep?.id || ''}
                    onChange={(e) => {
                      const userId = e.target.value;
                      const user = users?.find((u: User) => u.id === userId) || null;
                      setSelectedSalesRep(user);
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg 
                             bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100
                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={usersLoading}
                  >
                    <option value="" style={{color: 'black', backgroundColor: 'white'}}>
                      {usersLoading ? 'Loading users...' : 'Select a sales rep (optional)'}
                    </option>
                    {users?.map((user: User) => (
                      <option 
                        key={user.id} 
                        value={user.id}
                        style={{color: 'black', backgroundColor: 'white'}}
                      >
                        {user.full_name} - {user.role_name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedSalesRep && (
                  <div className="mt-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-sm">
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {selectedSalesRep.full_name}
                    </div>
                    <div className="text-neutral-600 dark:text-neutral-400">
                      Role: {selectedSalesRep.role_name} • Email: {selectedSalesRep.email}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Customer Notes */}
              <div className="mt-4">
                <label className="text-sm text-neutral-500 mb-1 block">Order Notes (Optional)</label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Any special instructions or notes for this order..."
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 text-sm resize-none"
                  rows={2}
                  disabled={isSubmittingOrder}
                />
              </div>

              {/* Order Summary */}
              <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex justify-between text-sm">
                  <span>Total Items:</span>
                  <span>{totals.units} units</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{currency(totals.subtotal)}</span>
                </div>
              </div>

              {/* Submit Order Button */}
              <button
                onClick={submitOrder}
                disabled={isSubmittingOrder || cart.length === 0}
                className={`w-full mt-4 rounded-xl p-3 font-medium ${
                  isSubmittingOrder || cart.length === 0
                    ? 'bg-neutral-300 dark:bg-neutral-700 text-neutral-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isSubmittingOrder ? 'Submitting Order...' : 'Submit Order'}
              </button>

              {/* Order Message */}
              {orderMessage && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  orderMessage.includes('failed') || orderMessage.includes('error')
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                }`}>
                  {orderMessage}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* SMS Menu Assistant Info */}
        <SmsInfo />
      </aside>

      {/* Floating Go to Cart Button */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 md:hidden">
        <button
          onClick={() => {
            // Scroll to cart section on mobile
            const cartElement = document.querySelector('aside');
            cartElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className={`px-6 py-3 rounded-full font-medium text-white shadow-lg transition-all duration-200 ${
            cart.length > 0
              ? 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105'
              : 'bg-neutral-400 cursor-not-allowed'
          }`}
          disabled={cart.length === 0}
        >
          Go to Cart ({cart.length})
        </button>
      </div>

      {/* Desktop Go to Cart Button - Bottom Right */}
      <div className="hidden md:block fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            // Scroll to cart section
            const cartElement = document.querySelector('aside');
            cartElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className={`px-4 py-2 rounded-lg font-medium text-white shadow-lg transition-all duration-200 ${
            cart.length > 0
              ? 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105'
              : 'bg-neutral-400 cursor-not-allowed'
          }`}
          disabled={cart.length === 0}
        >
          Cart ({cart.length})
        </button>
      </div>
        </>
      )}

      {/* Order Pulling Tab Content */}
      {activeTab === 'sales' && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          {salesLoading && (
            <div className="text-center py-8 text-neutral-500">Loading order pulling data...</div>
          )}
          
          {salesError && (
            <div className="text-center py-8 text-red-500">Failed to load order pulling data</div>
          )}
          
          {salesData && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Order Pulling Dashboard - {locations.find(loc => loc.id === currentLocation)?.name}
              </h2>
              
              {salesData.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  No processing orders for this location
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {salesData.map((brand: any) => (
                    <div key={brand.brand} className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6">
                      {/* Brand Header */}
                      <div className="mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-700">
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                          {brand.brand}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                          <div>
                            <span className="text-neutral-500">Total Cases:</span>
                            <div className="font-semibold text-blue-600 dark:text-blue-400">
                              {brand.brandTotalCases.toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <span className="text-neutral-500">Total Value:</span>
                            <div className="font-semibold text-green-600 dark:text-green-400">
                              ${brand.brandTotalDollars.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Products List */}
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {brand.products.map((product: any, index: number) => (
                          <div key={index} className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                            <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100 mb-2">
                              {product.name}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                              <div>
                                <span className="block">Cases to Pull:</span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  {product.totalCasesToPull}
                                </span>
                              </div>
                              <div>
                                <span className="block">Order Value:</span>
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  ${product.totalDollarsValue.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Chat Widget */}
      <ChatWidget 
        menuData={data} 
        onAddToCart={addToCart}
        currentLocation={locations.find(loc => loc.id === currentLocation)?.name || 'Unknown'}
      />
    </div>
  );
}
