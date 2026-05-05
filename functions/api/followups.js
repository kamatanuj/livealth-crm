export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  
  try {
    // GitHub API details
    const repoOwner = 'kamatanuj';
    const repoName = 'livealth-crm';
    const filePath = 'public/followups.json';
    
    // Get followups file from GitHub
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Worker'
        }
      }
    );
    
    if (!getFileResponse.ok) {
      // File doesn't exist yet, return empty object
      if (getFileResponse.status === 404) {
        return new Response(JSON.stringify({}), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: 'Failed to fetch followups' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const fileData = await getFileResponse.json();
    const content = JSON.parse(decodeURIComponent(escape(atob(fileData.content))));
    
    // Return followups for specific lead or all
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
    
    // GitHub API details
    const repoOwner = 'kamatanuj';
    const repoName = 'livealth-crm';
    const filePath = 'public/followups.json';
    
    // Get current followups file
    const getFileResponse = await fetch(
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
    
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
      followups = JSON.parse(decodeURIComponent(escape(atob(fileData.content))));
    }
    
    // Initialize lead's followups array if not exists
    if (!followups[leadId]) {
      followups[leadId] = [];
    }
    
    // Add new followup
    const newFollowUp = {
      id: `fup_${Date.now()}`,
      type,
      timestamp: new Date().toISOString(),
      content,
      rep,
      nextFollowUpDate: nextFollowUpDate || null,
      status: status || "pending"
    };
    
    followups[leadId].push(newFollowUp);
    
    // Update file on GitHub
    const updatedContent = JSON.stringify(followups, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(updatedContent)));
    
    const updateResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker'
        },
        body: JSON.stringify({
          message: `Add follow-up for lead ${leadId}`,
          content: base64Content,
          sha: sha || undefined
        })
      }
    );
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return new Response(JSON.stringify({ error: 'Failed to update followups', details: error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(newFollowUp), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
