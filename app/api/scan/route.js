import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { image, media_type } = await req.json();
    if (!image || !ALLOWED_TYPES.includes(media_type)) {
      return Response.json({ error: 'A photo is required' }, { status: 400 });
    }
    // Client resizes before upload; anything bigger than ~6MB binary is abuse
    if (image.length > 8_000_000) {
      return Response.json({ error: 'Photo too large' }, { status: 413 });
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data: image } },
          {
            type: 'text',
            text: `List every distinct food ingredient you can identify in this photo (fridge, pantry shelf, or groceries).
Use short lowercase names without quantities or brands (e.g. "chicken breast", "tomatoes", "cheddar cheese").
Ignore non-food items, containers, and appliances.
Return ONLY a valid JSON array of strings, nothing else. If you cannot identify any food items, return [].`,
          },
        ],
      }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(text);
    const ingredients = Array.isArray(parsed)
      ? [...new Set(
          parsed
            .filter(x => typeof x === 'string')
            .map(x => x.trim().toLowerCase())
            .filter(Boolean)
        )].slice(0, 40)
      : [];

    return Response.json({ ingredients });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Scan failed — please try again.' }, { status: 500 });
  }
}
