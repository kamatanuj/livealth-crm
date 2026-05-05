export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  
  try {
    const repoOwner = 'kamatanuj';
    const repoName = 'livealth-crm';
    const filePath = 'public/followups.json';
    
    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Worker'
        }
      }
    );
    
    if (!res.ok) {
      if (res.status === 404) {
        return new Response(JSON.stringify({}), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw new Error('Failed to fetch followups');
    }
    
    const fileData = await res.json();
    const content = JSON.parse(atob(fileData.content));
    
    if (leadId) {
      return new Response(JSON.stringify(content[leadId] || []), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(content), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { leadId, type, content, rep, nextFollowUpDate, status } = body;
    
    if (!leadId || !type || !content || !rep) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const repoOwner = 'kamatanuj';
    const repoName = 'livealth-crm';
    const filePath = 'public/followups.json';
    
    // Get current file
    const getRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Worker'
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
    followups[leadId].push({
      id: `fup_${Date.now()}`,
      type,
      timestamp: new Date().toISOString(),
      content,
      rep,
      nextFollowUpDate: nextFollowUpDate || null,
      status: status || 'pending'
    });
    
    // Save back to GitHub
    const updatedContent = JSON.stringify(followups, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(updatedContent)));
    
    const saveRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker'
        },
        body: JSON.stringify({
          message: `Add follow-up for ${leadId}`,
          content: base64Content,
          sha: sha
        })
      }
    );
    
    if (!saveRes.ok) {
      throw new Error('Failed to save followups');
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
