// Pages Function to delete documents from GitHub
export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const token = env.GITHUB_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: Missing GITHUB_TOKEN' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { leadId, docId, filePath, leadIndex } = body;
    
    if (!leadId || !docId || !filePath || leadIndex === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const repoOwner = 'kamatanuj';
    const repoName = 'livealth-crm';
    
    // 1. Get file SHA first
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
      return new Response(JSON.stringify({ error: 'File not found on GitHub' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const fileData = await getFileResponse.json();
    const fileSha = fileData.sha;
    
    // 2. Delete file from GitHub
    const deleteResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Livealth-CRM-App'
        },
        body: JSON.stringify({
          message: `Delete document: ${filePath}`,
          sha: fileSha,
          branch: 'main'
        })
      }
    );
    
    if (!deleteResponse.ok) {
      const error = await deleteResponse.json();
      return new Response(JSON.stringify({ 
        error: 'Failed to delete file from GitHub',
        details: error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 3. Update dashboard_data.json to remove document metadata
    const getLeadsResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/public/dashboard_data.json`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Livealth-CRM-App'
        }
      }
    );
    
    if (!getLeadsResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to get dashboard_data.json' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const leadsFileData = await getLeadsResponse.json();
    const leadsSha = leadsFileData.sha;
    
    const content = JSON.parse(atob(leadsFileData.content));
    const lead = content.leads[leadIndex];
    
    if (lead.documents) {
      lead.documents = lead.documents.filter(doc => doc.id !== docId);
    }
    
    const updatedContent = JSON.stringify(content, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(updatedContent)));
    
    const updateResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/public/dashboard_data.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Livealth-CRM-App'
        },
        body: JSON.stringify({
          message: `Remove document metadata for lead ${leadId}`,
          content: base64Content,
          sha: leadsSha
        })
      }
    );
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return new Response(JSON.stringify({ 
        error: 'Failed to update dashboard_data.json',
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
