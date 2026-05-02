export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { leads } = body;
    
    // Debug: Check if token exists
    const token = env.GITHUB_TOKEN;
    
    if (!token) {
      return new Response(JSON.stringify({ 
        error: 'Server misconfigured: Missing GITHUB_TOKEN environment variable',
        debug: 'env.GITHUB_TOKEN is undefined or empty'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // GitHub API details
    const repoOwner = 'kamatanuj';
    const repoName = 'livealth-crm';
    const filePath = 'public/dashboard_data.json';
    
    // Get current file to get its SHA
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Worker'
        }
      }
    );
    
    if (!getFileResponse.ok) {
      const errorText = await getFileResponse.text();
      return new Response(JSON.stringify({ 
        error: 'Failed to get file from GitHub',
        status: getFileResponse.status,
        details: errorText
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const fileData = await getFileResponse.json();
    const sha = fileData.sha;
    
    // Update file content
    const content = JSON.stringify({ leads, lastUpdated: new Date().toISOString() }, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    
    const updateResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker'
        },
        body: JSON.stringify({
          message: 'Delete lead - auto-update from CRM',
          content: base64Content,
          sha: sha
        })
      }
    );
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return new Response(JSON.stringify({ error: 'Failed to update file', details: error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: true, message: 'Leads updated successfully' }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
