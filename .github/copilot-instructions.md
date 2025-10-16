# Distru-LeBron Copilot Instructions

## Architecture Overview

This is a Next.js 15 application that creates a cannabis product ordering interface by integrating with the Distru API. The app follows a three-tier data flow pattern:

1. **External API Layer** (`/api/distru/*`): Direct proxies to Distru API endpoints
2. **Data Aggregation Layer** (`/api/menu`): Combines and transforms data from multiple Distru endpoints
3. **Frontend Layer** (`app/page.tsx`): Client-side SWR-powered interface

## Key Patterns

### API Route Structure
- **Proxy Routes**: `/api/distru/packages` and `/api/distru/products` are thin wrappers around Distru API calls
- **Aggregation Route**: `/api/menu` fetches from both proxy routes, joins data by `product_id`, and calculates inventory availability
- All routes use `cache: 'no-store'` for real-time inventory data
- Environment variables: `DISTRU_BASE_URL`, `DISTRU_API_KEY`, `DISTRU_LOCATION_ID`
- **API Documentation**: [Distru API Reference](https://apidocs.distru.dev/#upsert-an-order) for order creation and other endpoints

### Data Transformation Logic
```typescript
// Core pattern: Join packages and products by product_id
const qtyByProduct = new Map<string, number>();
for (const p of pkgs) {
  const prev = qtyByProduct.get(p.product_id) ?? 0;
  qtyByProduct.set(p.product_id, prev + p.quantity_available);
}
```

### Frontend State Management
- **SWR Configuration**: 30s refresh interval, 5s deduping, revalidate on focus
- **Cart Logic**: Items are keyed by `product_id + price_per_unit + price_per_case` to enable efficient order entry with discount modifications
- **Price Override System**: Users can modify unit/case prices independently, with automatic synchronization (`case_price = unit_price * case_size`)
- **Dual-mode Ordering**: Toggle between unit-based and case-based purchasing with automatic price calculation

### Styling Conventions
- **Tailwind CSS**: Uses neutral color palette with dark mode support
- **Component Pattern**: `bg-white dark:bg-neutral-900` for containers
- **Responsive Grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` for item cards

## Development Workflow

### Environment Setup
```bash
npm run dev --turbopack  # Development with Turbopack
npm run build --turbopack  # Production build with Turbopack
```

### Required Environment Variables
Create `.env.local` with:
```
DISTRU_BASE_URL=https://api.distru.com
DISTRU_API_KEY=your_token_here
DISTRU_LOCATION_ID=your_location_id
```

## Cannabis Industry Context

### Business Logic
- **Case Size Calculation**: `maxCases = Math.floor(units / case_size)` 
- **Price Synchronization**: Unit price changes auto-update case prices (`case_price = unit_price * case_size`)
- **Inventory Filtering**: Only shows products with `quantity_available > 0` and `status === 'active'`

### Data Model
- **MenuItem**: Frontend representation combining product info + inventory
- **CartItem**: Extends MenuItem with quantity state and purchase mode
- Products can be ordered by individual units OR full cases (mutual exclusion)

## Common Tasks

### Adding New API Endpoints
1. Create route in `/api/distru/[endpoint]/route.ts` following the proxy pattern
2. Add data transformation logic in `/api/menu/route.ts` if needed
3. Update TypeScript types in the consuming components

### Modifying Cart Behavior
- **Cart Aggregation Key**: `product_id + price_per_unit + price_per_case` enables same product with different discount prices
- **Efficient Order Entry**: Price modifications create separate cart entries for discount tracking and order processing
- Reset quantities after adding to cart: `setQtyUnits(0); setQtyCases(0)`
- Total calculation includes both unit and case quantities

### Styling Components
- Follow the established dark mode pattern: `className="bg-white dark:bg-neutral-900"`
- Use rounded corners: `rounded-2xl` for cards, `rounded-lg` for inputs
- Maintain consistent spacing with `p-4`, `gap-4`, `mt-3` patterns