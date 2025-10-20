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

    // Create context about ALL available products - no artificial limits
    const menuContext = currentMenu
      .filter((item: any) => item.units > 0 || item.cases_available > 0)
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

    // Debug: Log unique brands being passed to AI
    const uniqueBrands = [...new Set(menuContext.map((item: any) => item.brand))].filter(Boolean);
    console.log(`🏷️ Brands being sent to AI: ${uniqueBrands.length} brands:`, uniqueBrands.slice(0, 10));
    console.log(`📦 Total products sent to AI: ${menuContext.length}`);

    const systemPrompt = `You are a knowledgeable cannabis budtender assistant for a B2B dispensary menu. Help customers find products, answer questions about inventory, effects, and pricing.

Complete Current Inventory (ALL available products with stock):
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