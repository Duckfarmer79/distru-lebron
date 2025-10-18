// SMS Menu Assistant API - handles incoming text messages about cannabis products
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// Twilio configuration (client initialized in webhook responses)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

type MenuItem = {
  product_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  units: number;
  cases_available: number;
  price_per_unit: number;
  price_per_case: number;
  avg_thc_percentage: number | null;
  case_size: number;
};

// Helper function to search products by name/brand
function searchProducts(products: MenuItem[], query: string): MenuItem[] {
  const searchTerm = query.toLowerCase();
  return products.filter(product => 
    product.name.toLowerCase().includes(searchTerm) ||
    (product.brand && product.brand.toLowerCase().includes(searchTerm)) ||
    (product.category && product.category.toLowerCase().includes(searchTerm))
  );
}

// Helper function to parse questions and generate responses
function generateResponse(message: string, products: MenuItem[]): string {
  const msg = message.toLowerCase();
  
  // Extract product name from message
  let productQuery = '';
  
  // Common patterns for product inquiries
  const patterns = [
    /(?:what's the thc|thc|thc%|thc percent) (?:of|for|on) (.+)/,
    /(?:how many|stock|inventory|available) (?:cases|units)? (?:of|for|on) (.+)/,
    /(?:price|cost|how much) (?:of|for|on) (.+)/,
    /(?:tell me about|info on|information about) (.+)/,
    /(.+) (?:thc|stock|price|info)/,
  ];
  
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      productQuery = match[1].trim();
      break;
    }
  }
  
  // If no pattern matched, use the whole message as search
  if (!productQuery) {
    productQuery = msg;
  }
  
  // Search for products
  const matchedProducts = searchProducts(products, productQuery);
  
  if (matchedProducts.length === 0) {
    return `Sorry, I couldn't find any products matching "${productQuery}". Try searching by product name, brand, or category. Text "help" for examples.`;
  }
  
  // If multiple matches, show top 3
  if (matchedProducts.length > 1) {
    const topMatches = matchedProducts.slice(0, 3);
    let response = `Found ${matchedProducts.length} products matching "${productQuery}". Here are the top matches:\n\n`;
    
    topMatches.forEach((product, index) => {
      response += `${index + 1}. ${product.name}\n`;
      response += `   Brand: ${product.brand || 'N/A'}\n`;
      response += `   THC: ${product.avg_thc_percentage ? product.avg_thc_percentage.toFixed(1) + '%' : 'N/A'}\n`;
      response += `   Stock: ${product.units} units (${product.cases_available} cases)\n`;
      response += `   Price: $${product.price_per_unit}/unit, $${product.price_per_case}/case\n\n`;
    });
    
    if (matchedProducts.length > 3) {
      response += `...and ${matchedProducts.length - 3} more. Be more specific for exact matches.`;
    }
    
    return response;
  }
  
  // Single product match - detailed response
  const product = matchedProducts[0];
  
  // Determine what specific info they're asking for
  if (msg.includes('thc')) {
    return `${product.name} has ${product.avg_thc_percentage ? product.avg_thc_percentage.toFixed(1) + '% THC' : 'THC info not available'}. Stock: ${product.units} units available. Price: $${product.price_per_unit}/unit.`;
  }
  
  if (msg.includes('stock') || msg.includes('available') || msg.includes('inventory')) {
    return `${product.name}: ${product.units} units in stock (${product.cases_available} full cases of ${product.case_size}). Price: $${product.price_per_unit}/unit, $${product.price_per_case}/case.`;
  }
  
  if (msg.includes('price') || msg.includes('cost') || msg.includes('how much')) {
    return `${product.name}: $${product.price_per_unit} per unit, $${product.price_per_case} per case (${product.case_size} units/case). ${product.units} units available.`;
  }
  
  // Default comprehensive response
  return `${product.name}\nBrand: ${product.brand || 'N/A'}\nTHC: ${product.avg_thc_percentage ? product.avg_thc_percentage.toFixed(1) + '%' : 'N/A'}\nStock: ${product.units} units (${product.cases_available} cases)\nPrice: $${product.price_per_unit}/unit, $${product.price_per_case}/case\n\nText specific questions like "THC of [product]" or "stock of [product]"`;
}

// Handle help messages
function getHelpMessage(): string {
  return `🌿 Cannabis Menu Assistant 🌿\n\nText me questions like:\n• "THC of Gelato 33"\n• "How many cases of OG Kush"\n• "Price of Purple Punch"\n• "Tell me about Ice Cream Cake"\n• "Pressure Pack stock"\n\nI'll search our live inventory and give you current info!`;
}

export async function POST(request: NextRequest) {
  try {
    // Parse incoming SMS data from Twilio
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    const from = params.get('From');
    const message = params.get('Body') || '';
    
    console.log(`📱 SMS from ${from}: ${message}`);
    
    // Handle help messages
    if (message.toLowerCase().trim() === 'help' || message.toLowerCase().trim() === 'menu') {
      const helpResponse = getHelpMessage();
      
      // Send response via Twilio
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${helpResponse}</Message>
</Response>`;
      
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }
    
    // Fetch current menu data
    const origin = new URL(request.url).origin;
    const menuResponse = await fetch(`${origin}/api/menu`, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!menuResponse.ok) {
      throw new Error('Failed to fetch menu data');
    }
    
    const products: MenuItem[] = await menuResponse.json();
    console.log(`📊 Loaded ${products.length} products for SMS query`);
    
    // Generate response based on the message
    const response = generateResponse(message, products);
    
    // Create TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${response}</Message>
</Response>`;
    
    console.log(`📤 SMS response: ${response.substring(0, 100)}...`);
    
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    });
    
  } catch (error: any) {
    console.error('SMS webhook error:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I'm having trouble accessing the menu right now. Please try again in a moment or call the store directly.</Message>
</Response>`;
    
    return new NextResponse(errorTwiml, {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}

// Handle GET requests (for webhook verification)
export async function GET() {
  return NextResponse.json({ 
    message: 'Cannabis Menu SMS Assistant is ready!',
    features: [
      'THC percentage lookup',
      'Stock/inventory checking', 
      'Price information',
      'Product search by name/brand',
      'Live inventory integration'
    ]
  });
}