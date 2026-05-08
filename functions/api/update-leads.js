// Pages Function to update leads - FIXED export
export async function onRequest(context) {
  const { request, env } = context;
  
  // Only accept POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const token = env.GITHUB_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ 
        error: 'Server misconfigured: Missing GITHUB_TOKEN',
        help: 'Set GITHUB_TOKEN in Pages environment variables'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { leads } = body;
    
    if (!leads) {
      return new Response(JSON.stringify({ error: 'Missing leads data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const repoOwner = 'kamatanuj';
    const repoName = 'livealth-crm';
    const filePath = 'public/dashboard_data.json';
    
    // Get current file SHA
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Livealth-CRM-App'
        }
      }
    );
    
    if (!getFileResponse.ok) {
      const error = await getFileResponse.text();
      return new Response(JSON.stringify({ 
        error: 'Failed to get file from GitHub',
        status: getFileResponse.status,
        details: error
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
          'User-Agent': 'Livealth-CRM-App'
        },
        body: JSON.stringify({
          message: 'Update leads from CRM',
          content: base64Content,
          sha: sha
        })
      }
    );
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return new Response(JSON.stringify({ 
        error: 'Failed to update GitHub',
        details: error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
