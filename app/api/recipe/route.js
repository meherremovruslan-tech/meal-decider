import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req) {
  try {
    const { meal, ingredients } = await req.json();
    if (!meal) {
      return Response.json({ error: 'No meal provided' }, { status: 400 });
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Write a concise recipe for: ${meal}
Available ingredients the user has: ${ingredients}

Format the recipe with these sections:
## Ingredients
(list what's needed, mark anything the user may need to buy)

## Steps
(numbered steps, keep them short and clear)

## Tips
(1-2 practical cooking tips)

Keep it practical and under 400 words.`,
      }],
    });

    return Response.json({ recipe: message.content[0].text });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
