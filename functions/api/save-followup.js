// Save follow-up to GitHub (server-side Pages Function)
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Get the request body
    const body = await request.json();
    const { leadId, followUp } = body;
    
    if (!leadId || !followUp) {
      return new Response(JSON.stringify({ error: 'Missing leadId or followUp' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get current followups.json from GitHub
    const getRes = await fetch(
      `https://api.github.com/repos/kamatanuj/livealth-crm/contents/followups.json`,
      {
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    let followups = {};
    let sha = null;
    
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      followups = JSON.parse(atob(fileData.content));
    }
    
    // Add new follow-up
    if (!followups[leadId]) followups[leadId] = [];
    followups[leadId].push(followUp);
    
    // Save back to GitHub
    const updatedContent = JSON.stringify(followups, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(updatedContent)));
    
    const saveRes = await fetch(
      `https://api.github.com/repos/kamatanuj/livealth-crm/contents/followups.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Add follow-up for ${leadId}`,
          content: base64Content,
          sha: sha
        })
      }
    );
    
    if (!saveRes.ok) {
      const error = await saveRes.json();
      throw new Error(`GitHub API error: ${error.message}`);
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (err) {
    console.error('Error saving follow-up:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
