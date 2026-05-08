export async function onRequest(context) {
  const { env } = context;
  return new Response(JSON.stringify({
    hasToken: !!env.GITHUB_TOKEN,
    tokenLength: env.GITHUB_TOKEN ? env.GITHUB_TOKEN.length : 0,
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
