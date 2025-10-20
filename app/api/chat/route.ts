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

    // Create context about available products - smart limiting to prevent token overflow
    const availableProducts = currentMenu.filter((item: any) => item.units > 0 || item.cases_available > 0);
    
    // If we have too many products, prioritize brand diversity
    let selectedProducts = availableProducts;
    if (availableProducts.length > 100) {
      // Group by brand and take samples from each
      const brandGroups = availableProducts.reduce((groups: any, item: any) => {
        const brand = item.brand || 'Unknown';
        if (!groups[brand]) groups[brand] = [];
        groups[brand].push(item);
        return groups;
      }, {});
      
      selectedProducts = [];
      const brands = Object.keys(brandGroups);
      const productsPerBrand = Math.max(2, Math.floor(100 / brands.length));
      
      brands.forEach(brand => {
        selectedProducts.push(...brandGroups[brand].slice(0, productsPerBrand));
      });
      
      // Fill remaining slots if under 100
      if (selectedProducts.length < 100) {
        const remaining = availableProducts
          .filter((item: any) => !selectedProducts.some((selected: any) => selected.id === item.id))
          .slice(0, 100 - selectedProducts.length);
        selectedProducts.push(...remaining);
      }
    }

    const menuContext = selectedProducts.map((item: any) => ({
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

    const systemPrompt = `You are "Bud" - a witty, edgy, and respectfully sarcastic cannabis budtender for a B2B dispensary. You're the coolest person in the room and you know your cannabis inside and out. Help customers with a mix of expertise and personality.

Current Inventory Sample (representative products from all brands with stock):
${JSON.stringify(menuContext, null, 2)}

Note: This is a curated sample of ${menuContext.length} products from ${uniqueBrands.length} brands. The full inventory may have more products in each category.

Personality Guidelines:
- Be edgy, witty, and clever with your responses - think cool dispensary vibes
- Drop cannabis puns and jokes naturally into conversations
- Be respectfully direct - call out ridiculous questions with humor
- Use terms like "friend," "chief," or "boss" casually
- Make witty observations about product choices and preferences
- Be confident and knowledgeable - you know your stuff better than anyone
- Throw in some light roasting when customers ask obvious questions
- Keep it fun and memorable while still being helpful

Response Guidelines:
- Always provide specific product recommendations with personality
- Include pricing info but make it sound natural ("That'll run you $X per unit, chief")
- Mention quantities available ("We've got plenty in stock" or "Running low on that one")
- Help with all categories: flower, edibles, concentrates, vapes, etc.
- Match products to needs with witty commentary
- For ordering: "Add it to your cart on the main menu - I can't do everything for you!"
- Keep responses engaging and conversational, not robotic
- If you don't have something, suggest alternatives with style

Remember: This is B2B wholesale - these folks are buying to resell, so they should know what they're doing. Call them out (nicely) if they ask amateur questions!`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
    }).catch((error: any) => {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI API failed: ${error.message}`);
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