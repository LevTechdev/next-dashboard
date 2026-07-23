import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { dashboardTools } from "@/lib/ai/tools";
import { requireAuth } from "@/lib/api-guard";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { response } = await requireAuth(req);
    if (response) return response;

    const { messages } = await req.json();

    const result = streamText({
      model: openai("gpt-4o"),
      instructions: `You are an intelligent AI analytics assistant for a business management dashboard called "Dashboard". 
      
Your role is to help users understand their business data by answering questions about revenue, orders, customers, products, and sales channels.

Key capabilities:
- You can look up real-time dashboard statistics (revenue, orders, customers, products)
- You can retrieve recent orders and order details
- You can find top-selling products
- You can analyze sales by channel
- You can search across orders, customers, and products
- You can get detailed customer information
- You can view monthly revenue trends

When answering:
- Be concise and data-driven
- Use natural language to explain numbers
- Suggest relevant follow-up questions when appropriate
- If a tool returns an error or empty data, acknowledge it gracefully
- Format currency values appropriately (e.g., $1,234.56)
- When showing multiple items, present them in a clean, readable way

If the user asks about something outside your capabilities, politely explain what you can help with instead.`,
      tools: dashboardTools,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI Chat API Error:", error);
    return new Response(
      JSON.stringify({
        error: "An error occurred processing your request. Please try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
