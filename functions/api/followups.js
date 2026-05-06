export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  
  try {
    // Read followups.json from the deployed files (local)
    const followups = await fetch('/followups.json').then(r => r.json());
    
    if (leadId) {
      return new Response(JSON.stringify(followups[leadId] || []), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(followups), {
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
  const { request } = context;
  
  try {
    const body = await request.json();
    const { leadId, type, content, rep, nextFollowUpDate, status } = body;
    
    if (!leadId || !type || !content || !rep) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Read current followups (from local file)
    const followups = await fetch('/followups.json').then(r => r.json());
    
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
    
    // In a real app, you'd save this back to GitHub
    // For now, we'll return success (client will need to save via GitHub API)
    return new Response(JSON.stringify({ success: true, message: 'Follow-up added (client-side save required)' }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
