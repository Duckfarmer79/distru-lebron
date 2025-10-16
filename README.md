# Distru-LeBron Cannabis Ordering System

A Next.js application that creates a cannabis product ordering interface by integrating with the Distru API.

## 🌟 Features

- **Real-time Inventory**: Live product catalog with real-time inventory tracking
- **Order Management**: Complete B2B ordering system with customer selection
- **User Assignment**: Owner and sales rep assignment for order tracking
- **Flexible Ordering**: Unit and case-based ordering with price overrides
- **Smart Images**: Automatic fallback images for products without photos
- **Responsive Design**: Works perfectly on desktop and mobile
- **Dark Mode**: Full dark mode support throughout the interface

## 🚀 Tech Stack

- **Next.js 15**: App Router with Turbopack for fast builds
- **React 19**: Latest React with modern hooks and patterns
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first CSS with dark mode support
- **SWR**: Data fetching with caching and real-time updates
- **Distru API**: Direct integration with cannabis industry ERP

## 📋 Prerequisites

- Node.js 18+ and npm
- Distru account with API access
- Distru API key and location ID

## 🔧 Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/distru-lebron.git
   cd distru-lebron
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your Distru API credentials:
   ```
   DISTRU_BASE_URL=https://api.distru.com
   DISTRU_API_KEY=your_api_key_here
   DISTRU_LOCATION_ID=your_location_id_here
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🏗️ Architecture

### Three-Tier Data Flow
1. **External API Layer** (`/api/distru/*`): Direct proxies to Distru API endpoints
2. **Data Aggregation Layer** (`/api/menu`): Combines and transforms data from multiple endpoints
3. **Frontend Layer** (`app/page.tsx`): Client-side SWR-powered interface

### Key Components
- **Product Catalog**: Real-time inventory with search and filtering
- **Shopping Cart**: Unit/case ordering with price modification capabilities
- **Customer Management**: B2B customer selection from Distru companies
- **Order Processing**: Complete order submission with user assignments

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Manual Deployment
```bash
npm run build
npm start
```

## 🔒 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISTRU_BASE_URL` | Distru API base URL | `https://api.distru.com` |
| `DISTRU_API_KEY` | Your Distru API token | `your_api_key_here` |
| `DISTRU_LOCATION_ID` | Your location ID for inventory | `your_location_id_here` |
