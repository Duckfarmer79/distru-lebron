import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, menuData, cartData } = await request.json();

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

    // GPT-4o-mini has much larger context - send ALL available products
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

    const systemPrompt = `You are "Carl" - a witty, edgy, and no-nonsense cannabis budtender for a B2B dispensary. Think Ron Swanson meets cannabis expert - you know your stuff and aren't afraid to tell people what's what.

COMPLETE CURRENT INVENTORY (ALL available products with stock):
${JSON.stringify(menuContext, null, 2)}

Note: This is your complete available inventory - ${menuContext.length} products from ${uniqueBrands.length} different brands.

Personality Guidelines:
- Be edgy, witty, and clever with your responses - like ron swanson from parks and rec but cannabis
- Drop cannabis puns and jokes naturally into conversations
- Be respectfully direct - call out ridiculous questions with humor
- Use terms like "bigdawg," "habibi," or "boss" casually 
- Make witty observations about product choices and preferences
- Be confident and knowledgeable - you know your stuff better than anyone
- Throw in some light roasting when customers ask obvious questions and call them a dummy
- Keep it fun and memorable while still being helpful

Response Guidelines:
- Always provide specific product recommendations with personality
- Include pricing info but make it sound natural ("That'll run you $X per unit, bigdawg")
- Mention quantities available ("We've got plenty in stock" or "Running low on that one")
- Help with all categories: flower, edibles, concentrates, vapes, etc.
- Match products to needs with witty commentary
- Keep responses engaging and conversational, not robotic
- If you don't have something, suggest alternatives with style

Remember: This is B2B wholesale - these folks are buying to resell, so they should know what they're doing. Call them out if they ask amateur questions!

IMPORTANT: You can add items directly to their cart using the add_to_cart function. When customers ask to add something, use this function and confirm with your signature attitude!`;

    // Define functions for cart operations
    const functions = [
      {
        name: "add_to_cart",
        description: "Add products to the customer's cart",
        parameters: {
          type: "object",
          properties: {
            product_id: {
              type: "string",
              description: "The exact product ID from the inventory"
            },
            product_name: {
              type: "string", 
              description: "The product name for confirmation"
            },
            quantity: {
              type: "number",
              description: "How many units or cases to add"
            },
            mode: {
              type: "string",
              enum: ["unit", "case"],
              description: "Whether to add individual units or full cases"
            }
          },
          required: ["product_id", "product_name", "quantity", "mode"]
        }
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      functions: functions,
      function_call: "auto",
      max_tokens: 1000,
      temperature: 0.7,
    }).catch((error: any) => {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI API failed: ${error.message}`);
    });

    const choice = completion.choices[0];
    let aiResponse = choice?.message?.content || "I'm sorry, I couldn't process that request.";
    let cartAction = null;

    // Handle function calling for cart operations
    if (choice?.message?.function_call) {
      const functionCall = choice.message.function_call;
      
      if (functionCall.name === "add_to_cart") {
        try {
          const args = JSON.parse(functionCall.arguments || "{}");
          const { product_id, product_name, quantity, mode } = args;
          
          console.log(`🛒 Cart request: "${product_id}", ${quantity} ${mode}`);
          console.log(`🔍 Available products:`, menuContext.map((p: any) => p.name).slice(0, 5));
          
          // Improved product matching - try multiple strategies
          let product = menuContext.find((item: any) => 
            item.name?.toLowerCase() === product_id.toLowerCase()
          );
          
          if (!product) {
            product = menuContext.find((item: any) => 
              item.name?.toLowerCase().includes(product_id.toLowerCase())
            );
          }
          
          if (!product) {
            product = menuContext.find((item: any) => 
              product_id.toLowerCase().includes(item.name?.toLowerCase() || "")
            );
          }
          
          console.log(`🔍 Found product:`, product ? product.name : 'NOT FOUND');
          
          if (product) {
            cartAction = {
              type: "add_to_cart",
              product: {
                product_id: product.name, // Using name as ID for now
                name: product.name,
                brand: product.brand,
                price_per_unit: product.price_per_unit,
                price_per_case: product.price_per_case,
                case_size: product.case_size,
                image_url: null, // Add missing field
                qtyUnits: mode === "unit" ? quantity : 0,
                qtyCases: mode === "case" ? quantity : 0,
                mode: mode
              }
            };
            
            console.log(`✅ Created cart action:`, JSON.stringify(cartAction, null, 2));
            
            // Generate a confirmation response with Bud's personality
            const totalCost = mode === "unit" 
              ? quantity * product.price_per_unit 
              : quantity * product.price_per_case;
              
            aiResponse = `Done. Added ${quantity} ${mode}${quantity > 1 ? 's' : ''} of ${product.name} by ${product.brand} to your cart, bigdawg. That's $${totalCost.toFixed(2)}. Your customers better appreciate quality when they see it. What else?`;
          } else {
            aiResponse = `Listen here, dummy - I couldn't find that exact product in our inventory. Maybe spell it right or ask me what we actually have instead of making me guess like some kind of mind reader.`;
          }
        } catch (error) {
          console.error('Function call parsing error:', error);
          aiResponse = `Something went sideways trying to add that to your cart, boss. Try asking again, but be more specific this time - I'm not a mind reader.`;
        }
      }
    }

    return NextResponse.json({ 
      response: aiResponse,
      cartAction: cartAction,
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