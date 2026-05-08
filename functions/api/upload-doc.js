// Pages Function to upload documents to GitHub
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
    const { leadId, fileName, fileContent, leadIndex } = body;
    
    if (!leadId || !fileName || !fileContent || leadIndex === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields: leadId, fileName, fileContent, leadIndex' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const repoOwner = 'kamatanuj';
    const repoName = 'livealth-crm';
    const filePath = `docs/${leadId}/${fileName}`;
    
    // 1. Upload file to GitHub
    const uploadResponse = await fetch(
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
          message: `Upload document: ${fileName} for lead ${leadId}`,
          content: fileContent, // Should be base64
          branch: 'main'
        })
      }
    );
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      return new Response(JSON.stringify({ 
        error: 'Failed to upload file to GitHub',
        details: error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const uploadData = await uploadResponse.json();
    const rawUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${filePath}`;
    
    // 2. Update dashboard_data.json to add document metadata to the lead
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/public/dashboard_data.json`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Livealth-CRM-App'
        }
      }
    );
    
    if (!getFileResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to get dashboard_data.json' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const fileData = await getFileResponse.json();
    const sha = fileData.sha;
    
    // Decode and parse current data
    const content = JSON.parse(atob(fileData.content));
    const lead = content.leads[leadIndex];
    
    if (!lead.documents) {
      lead.documents = [];
    }
    
    const docEntry = {
      id: `doc_${Date.now()}`,
      name: fileName,
      url: rawUrl,
      uploadedAt: new Date().toISOString()
    };
    
    lead.documents.push(docEntry);
    
    // Update GitHub
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
          message: `Add document metadata for lead ${leadId}`,
          content: base64Content,
          sha: sha
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
    
    return new Response(JSON.stringify({ 
      success: true,
      document: docEntry
    }), {
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
