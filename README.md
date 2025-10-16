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

## 🚀 One-Click Deployment

Deploy your own instance of Distru-LeBron with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDuckfarmer79%2Fdistru-lebron&env=DISTRU_BASE_URL,DISTRU_API_KEY,DISTRU_LOCATION_ID&envDescription=Distru%20API%20credentials%20required%20for%20the%20cannabis%20ordering%20system&envLink=https%3A%2F%2Fgithub.com%2FDuckfarmer79%2Fdistru-lebron%23environment-variables&project-name=distru-lebron&repository-name=distru-lebron)

### Manual Deployment

#### Vercel
1. Fork this repository
2. Go to [Vercel](https://vercel.com/new)
3. Import your forked repository
4. Add environment variables (see below)
5. Deploy

#### Other Platforms
```bash
npm run build
npm start
```

## 🔒 Environment Variables

When deploying, you'll need to set these environment variables:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DISTRU_BASE_URL` | Distru API base URL | ✅ | `https://api.distru.com` |
| `DISTRU_API_KEY` | Your Distru API token | ✅ | `your_api_key_here` |
| `DISTRU_LOCATION_ID` | Your location ID for inventory | ✅ | `your_location_id_here` |

### Getting Your Distru Credentials

1. **Login to Distru**: Go to your Distru dashboard
2. **API Settings**: Navigate to Settings → API or Developer settings
3. **Generate Token**: Create a new API token if you don't have one
4. **Location ID**: Find your location ID in the locations section
5. **Copy Values**: Use these in your deployment environment variables

### Deployment Environment Variables Setup

When using the one-click deploy button, you'll be prompted to enter:
- **DISTRU_BASE_URL**: `https://api.distru.com` (default)
- **DISTRU_API_KEY**: Your actual API token from Distru
- **DISTRU_LOCATION_ID**: Your location identifier from Distru
