const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// Always resolves — any error, missing key, or empty result returns null
// so callers never need a try/catch around this.
export async function searchRecipeVideo(mealName) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    part: 'snippet',
    q: `${mealName} recipe`,
    type: 'video',
    videoDuration: 'medium',
    safeSearch: 'strict',
    maxResults: '1',
    key: apiKey,
  });

  try {
    const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params}`);
    if (!res.ok) {
      console.error('YouTube search failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;
    return { videoId: item.id.videoId, videoTitle: item.snippet.title };
  } catch (e) {
    console.error('YouTube search error:', e.message);
    return null;
  }
}
