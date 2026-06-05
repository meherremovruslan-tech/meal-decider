import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req) {
  try {
    const { ingredients, filters } = await req.json();
    if (!ingredients?.trim()) {
      return Response.json({ error: 'No ingredients provided' }, { status: 400 });
    }

    const filterText = filters?.length
      ? `\nDietary requirements (ALL meals MUST comply): ${filters.join(', ')}.`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `I have these ingredients: ${ingredients}.${filterText}
Suggest exactly 6 meal names I can realistically make with some or all of these.
Return ONLY a valid JSON array of 6 short meal name strings, nothing else.
Example format: ["Meal One", "Meal Two", "Meal Three", "Meal Four", "Meal Five", "Meal Six"]`,
      }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const meals = JSON.parse(text);

    return Response.json({ meals });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
