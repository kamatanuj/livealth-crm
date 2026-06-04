#!/usr/bin/env node

/**
 * Livealth Leads Pipeline (FIXED)
 * Fetches conversations from ElevenLabs and updates dashboard_data.json
 * Now fetches FULL conversation details with analysis
 */

const fs = require('fs');
const path = require('path');

// Load .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (!line || line.startsWith('#')) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
  console.log('✅ Loaded .env file');
}

// Configuration
const ELEVENLABS_API_KEY=proces..._KEY || '';
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_7601k8ms1yhqf19tk684c03bfbst';
const GITHUB_TOKEN=proces...N;
const REPO_OWNER = 'kamatanuj';
const REPO_NAME = 'livealth-crm';
const FILE_PATH = 'public/dashboard_data.json';

// Fetch conversations LIST from ElevenLabs
async function fetchConversationList() {
  try {
    const url = `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${AGENT_ID}&page_size=100`;
    console.log(`🔍 Fetching conversation list from ElevenLabs...`);
    
    const response = await fetch(url, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Fetched ${data.conversations?.length || 0} conversation references`);
    return data.conversations || [];
  } catch (error) {
    console.error('❌ Error fetching conversation list:', error.message);
    return [];
  }
}

// Fetch FULL conversation details with analysis - FIX #1
async function fetchFullConversation(conversationId) {
  try {
    const url = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`;
    
    const response = await fetch(url, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch conversation ${conversationId}: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error fetching conversation ${conversationId}:`, error.message);
    return null;
  }
}

// Extract data from full conversation - THE MAIN FIX
function extractLeadFromConversation(fullConv) {
  try {
    const conv = fullConv.conversation || fullConv;
    const analysis = conv.analysis || {};
    const evalData = analysis.eval_data || analysis.custom_eval_data || {};
    const transcript = conv.transcript || [];
    
    // FIXED: Extract from analysis.eval_data where ElevenLabs stores extracted data
    let name = evalData.name || evalData.customer_name || evalData.caller_name || evalData.extracted_name || '';
    let phone = evalData.phone || evalData.customer_phone || evalData.caller_phone || evalData.extracted_phone || conv.phone_number || '';
    let email = evalData.email || evalData.customer_email || evalData.caller_email || evalData.extracted_email || '';
    let summary = analysis.summary || analysis.call_summary || conv.status || '';
    
    // FIXED: Determine category from analysis with proper logic
    let category = 'COLD';
    if (analysis.success_evaluation === 'success' || analysis.success_evaluation === 'hot_lead') {
      category = 'HOT';
    } else if (analysis.success_evaluation === 'failure' || analysis.success_evaluation === 'not_interested') {
      category = 'COLD';
    }
    
    // FIXED: Generate title from summary/topic with keyword matching
    let title = determineTitle(summary, conv.call_type);
    
    // FIXED: Extract name from transcript if still missing
    if (!name && transcript.length > 0) {
      const firstUserMsg = transcript.find(t => (t.role === 'user' || t.is_user))?.message || '';
      const namePatterns = [
        /(?:i\'?m|my name is|this is)\s+([a-zA-Z\s]{2,20})/i,
        /(?:name is|called)\s+([a-zA-Z\s]{2,20})/i,
        /(?:this is)\s+([a-zA-Z\s]{2,20})\s+speaking/i
      ];
      for (const pattern of namePatterns) {
        const match = firstUserMsg.match(pattern);
        if (match) {
          name = match[1].trim().split(/\s+/).slice(0, 2).join(' '); // First 2 words
          if (name.length > 2) break;
        }
      }
    }
    
    // FIXED: Fallback if still unknown - check for explicit name mentions
    if (!name) {
      const fullTranscript = transcript.map(t => t.message || '').join(' ');
      const myNameMatch = fullTranscript.match(/my name is ([a-zA-Z\s]+?)(?:\.|,|\s+and|$)/i);
      if (myNameMatch) name = myNameMatch[1].trim();
    }
    
    // FIXED: Handle date correctly from unix timestamp
    const date = conv.start_time_unix_secs 
      ? new Date(conv.start_time_unix_secs * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    
    return {
      name: name || 'Unknown',
      phone: phone || '',
      email: email || '',
      date,
      title: title || 'General Inquiry',
      duration: Math.round((conv.duration_secs || 60) / 60),
      language: conv.language || 'en',
      category,
      conversation_id: conv.conversation_id,
      summary: summary || 'No summary available',
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
    };
  } catch (error) {
    console.error('Error extracting lead:', error);
    return null;
  }
}

// Generate title based on keywords in summary or call_type
function determineTitle(summary, callType) {
  const text = (summary || callType || '').toLowerCase();
  
  const keywords = {
    'Praziquantel': ['praziquantel', 'biltricide'],
    'Heparin': ['heparin', 'anticoagulant'],
    'Franchise Distribution': ['franchise', 'distributor', 'partner', 'agency'],
    'Export Inquiry': ['export', 'international', 'country', 'overseas', 'abroad'],
    'Product Purchase': ['buy', 'purchase', 'order', 'tablet', 'injection', 'capsule', 'medicine', 'drug'],
    'Job Application': ['job', 'vacancy', 'career', 'employment', 'hire', 'work', 'position'],
    'Domestic Sales': ['india', 'domestic', 'local distributor'],
    'Medical Consultation': ['doctor', 'patient', 'prescription', 'medication']
  };
  
  for (const [title, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      return title + ' Inquiry';
    }
  }
  
  return 'General Inquiry';
}

// Fetch current dashboard_data.json from GitHub
async function fetchCurrentLeads() {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Livealth-Leads-Pipeline'
      }
    });
    
    if (response.status === 404) {
      return { leads: [], sha: null };
    }
    
    if (!response.ok) {
      console.log(`⚠️ GitHub API error: ${response.status}, using local`);
      try {
        const localPath = path.join(__dirname, FILE_PATH);
        if (fs.existsSync(localPath)) {
          const localData = fs.readFileSync(localPath, 'utf8');
          return { leads: JSON.parse(localData).leads || [], sha: null };
        }
      } catch {}
      return { leads: [], sha: null };
    }
    
    const data = await response.json();
    const decoded = Buffer.from(data.content, 'base64').toString('utf8');
    const content = JSON.parse(decoded);
    
    return { leads: content.leads || [], sha: data.sha };
  } catch (error) {
    console.error('❌ Error fetching leads:', error.message);
    return { leads: [], sha: null };
  }
}

// Deduplicate leads based on key fields
function deduplicateLeads(leads) {
  const crypto = require('crypto');
  const seen = new Map();
  const unique = [];
  
  for (const lead of leads) {
    const sig = [lead.name, lead.phone, lead.email, lead.date, lead.title]
      .map(f => f || '').join('|');
    const hash = crypto.createHash('md5').update(sig).digest('hex');
    
    if (seen.has(hash)) continue;
    seen.set(hash, true);
    unique.push(lead);
  }
  
  return unique;
}

// Merge leads and sort by date
async function mergeLeads(existingLeads, newLeads) {
  const combined = [...(existingLeads || []), ...(newLeads || [])];
  const unique = deduplicateLeads(combined);
  
  unique.sort((a, b) => {
    const dateA = new Date(a.date || '1970-01-01');
    const dateB = new Date(b.date || '1970-01-01');
    return dateB - dateA;
  });
  
  return unique;
}

// Update dashboard_data.json on GitHub
async function updateLeadsOnGitHub(leads, sha) {
  try {
    const content = JSON.stringify({
      lastUpdated: new Date().toISOString(),
      leads: leads
    }, null, 2);
    
    const base64Content = Buffer.from(content).toString('base64');
    
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Livealth-Leads-Pipeline'
      },
      body: JSON.stringify({
        message: `Update leads - ${new Date().toISOString()}`,
        content: base64Content,
        sha: sha || undefined
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message);
    }
    
    console.log(`✅ Updated dashboard_data.json`);
    return true;
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    return false;
  }
}

// Main pipeline function
async function runPipeline() {
  console.log(`\n🚀 Livealth Leads Pipeline (FIXED)`);
  console.log(`⏰ ${new Date().toISOString()}\n`);
  
  // Step 1: Get conversation list
  const convList = await fetchConversationList();
  if (convList.length === 0) {
    console.log('ℹ️ No conversations found');
    return;
  }
  
  // Step 2: Fetch FULL details for each conversation - FIX #2
  console.log(`\n📥 Fetching full details for ${convList.length} conversations...`);
  const fullConversations = [];
  
  // Process in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < convList.length; i += batchSize) {
    const batch = convList.slice(i, i + batchSize);
    const batchPromises = batch.map(c => fetchFullConversation(c.conversation_id));
    const results = await Promise.all(batchPromises);
    fullConversations.push(...results.filter(r => r !== null));
    
    if (i + batchSize < convList.length) {
      await new Promise(r => setTimeout(r, 300)); // Rate limit protection
    }
  }
  
  console.log(`✅ Retrieved ${fullConversations.length} full conversations\n`);
  
  // Step 3: Extract leads with proper data - FIX #3
  const newLeads = fullConversations.map(extractLeadFromConversation).filter(l => l !== null);
  console.log(`🔄 Transformed to ${newLeads.length} leads`);
  
  // Show sample with names
  const namedLeads = newLeads.filter(l => l.name !== 'Unknown');
  if (namedLeads.length > 0) {
    console.log(`\nSample named leads (${namedLeads.length} total):`);
    namedLeads.slice(0, 3).forEach(l => {
      console.log(`  📞 ${l.name} | ${l.phone} | ${l.title}`);
    });
  }
  
  // Step 4: Merge with existing
  const { leads: existing, sha } = await fetchCurrentLeads();
  const merged = await mergeLeads(existing, newLeads);
  
  // Step 5: Update GitHub
  const success = await updateLeadsOnGitHub(merged, sha);
  
  if (success) {
    console.log(`\n🎉 Success! Total leads: ${merged.length}`);
    const unknowns = merged.filter(l => l.name === 'Unknown').length;
    const named = merged.length - unknowns;
    console.log(`   ✅ Named: ${named} (${Math.round(named/merged.length*100)}%)`);
    console.log(`   ❓ Unknown: ${unknowns} (${Math.round(unknowns/merged.length*100)}%)`);
  } else {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runPipeline().catch(e => {
    console.error('❌ Pipeline error:', e);
    process.exit(1);
  });
}

module.exports = { runPipeline, extractLeadFromConversation, fetchFullConversation };
