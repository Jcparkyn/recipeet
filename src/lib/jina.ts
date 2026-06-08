export async function fetchUrlContent(url: string): Promise<string> {
  const encoded = encodeURIComponent(url);
  const response = await fetch(`https://r.jina.ai/${encoded}`, {
    headers: {
      Accept: 'text/plain',
      'X-Return-Format': 'markdown',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  return response.text();
}
