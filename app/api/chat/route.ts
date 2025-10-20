import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, menuData } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Fetch current menu data for context
    let currentMenu = menuData;
    if (!currentMenu) {
      try {
        const menuResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/menu`, {
          cache: 'no-store'
        });
        currentMenu = await menuResponse.json();
      } catch (error) {
        console.error('Failed to fetch menu data:', error);
        currentMenu = [];
      }
    }

    // Create context about available products - ensure diversity across categories
    const availableProducts = currentMenu.filter((item: any) => item.units > 0 || item.cases_available > 0);
    
    // Group by category to ensure diversity
    const categories = ['flower', 'edibles', 'concentrates', 'vapes', 'pre-rolls'];
    let menuContext: any[] = [];
    
    // Add products from each category
    categories.forEach(cat => {
      const categoryItems = availableProducts
        .filter((item: any) => item.category?.toLowerCase().includes(cat))
        .slice(0, 8); // 8 per category
      menuContext.push(...categoryItems);
    });
    
    // Fill remaining slots with other products
    const remaining = availableProducts
      .filter((item: any) => !menuContext.some((existing: any) => existing.id === item.id))
      .slice(0, Math.max(0, 50 - menuContext.length));
    
    menuContext.push(...remaining);
    menuContext = menuContext.slice(0, 50) // Final limit
      .map((item: any) => ({
        name: item.name,
        brand: item.brand,
        category: item.category,
        price_per_unit: item.price_per_unit,
        price_per_case: item.price_per_case,
        units: item.units,
        cases_available: item.cases_available,
        case_size: item.case_size,
        thc: item.avg_thc_percentage,
        unit_type: item.unit_type
      }));

    const systemPrompt = `You are a knowledgeable cannabis budtender assistant for a B2B dispensary menu. Help customers find products, answer questions about inventory, effects, and pricing.

Current Available Products (first 20 items):
${JSON.stringify(menuContext, null, 2)}

Guidelines:
- Be friendly and professional
- Provide specific product recommendations when asked
- Include pricing information (per unit and per case)
- Mention available quantities (units and cases)
- Help with product categories: flower, edibles, concentrates, vapes, etc.
- Suggest products based on customer needs (pain relief, sleep, energy, etc.)
- If asked about ordering, explain they can add items to cart from the main menu
- Keep responses concise but informative
- If you don't see a specific product, suggest similar alternatives from available inventory

Remember: This is a B2B wholesale menu, so customers typically order in cases for retail resale.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that request.";

    return NextResponse.json({ 
      response: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error.message },
      { status: 500 }
    );
  }
}