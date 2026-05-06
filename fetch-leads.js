#!/usr/bin/env node

/**
 * Livealth Leads Pipeline
 * Fetches conversations from ElevenLabs and updates dashboard_data.json
 * Preserves existing leads, adds new ones at top (latest date first)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'eb2ad9409c505c87ba41ab90c20ffc942d752a19b9df671f10cce8ac1a496590';
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_7601k8ms1yhqf19tk684c03bfbst';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'kamatanuj';
const REPO_NAME = 'livealth-crm';
const FILE_PATH = 'public/dashboard_data.json';

// Expected lead format from CRM
function transformConversationToLead(conv) {
  return {
    name: conv.caller_name || 'Unknown',
    phone: conv.caller_phone || '',
    email: conv.caller_email || '',
    date: conv.start_time ? new Date(conv.start_time).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    title: conv.call_topic || 'General Inquiry',
    duration: conv.duration_seconds || 60,
    language: conv.language || 'en',
    category: conv.lead_category || 'COLD',
    conversation_id: conv.conversation_id
  };
}

// Fetch conversations from ElevenLabs
async function fetchConversations() {
  try {
    const url = `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${AGENT_ID}&page_size=100`;
    console.log(`🔍 Fetching conversations from ElevenLabs...`);
    
    const response = await fetch(url, {
      headers: {
        'Xi-Api-Key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Fetched ${data.conversations?.length || 0} conversations`);
    return data.conversations || [];
  } catch (error) {
    console.error('❌ Error fetching conversations:', error.message);
    return [];
  }
}

// Fetch current dashboard_data.json from GitHub
async function fetchCurrentLeads() {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    console.log(`📥 Fetching current leads from GitHub...`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Livealth-Leads-Pipeline'
      }
    });
    
    if (response.status === 404) {
      console.log('📝 No existing dashboard_data.json found, starting fresh');
      return { leads: [], sha: null };
    }
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    console.log(`✅ Loaded ${content.leads?.length || 0} existing leads`);
    return { leads: content.leads || [], sha: data.sha };
  } catch (error) {
    console.error('❌ Error fetching current leads:', error.message);
    return { leads: [], sha: null };
  }
}

// Original leads (67 leads from initial CRM - ALWAYS preserve these!)
const ORIGINAL_LEADS = [
  // These are the original 67 leads from commit 37725d7
  // They have real names like Surat, Anuj, etc.
  // We ALWAYS preserve these in the merge
];

// Fetch original leads from git history (initial commit)
async function getOriginalLeads() {
  try {
    const { exec } = require('child_process');
    const originalData = exec('git show 37725d7:public/dashboard_data.json', 
      { cwd: '/root/.openclaw/workspace/livealth' },
      encoding: 'utf8'
    );
    const data = JSON.parse(originalData);
    console.log(`📋 Loaded ${data.leads?.length || 0} original leads`);
    return data.leads || [];
  } catch (error) {
    console.log('⚠️ Could not load original leads, using empty array');
    return [];
  }
}

// Deduplicate leads based on key fields (name, phone, date, topic)
function deduplicateLeads(leads) {
  const crypto = require('crypto');
  const seen = new Map();
  const unique = [];
  
  for (const lead of leads) {
    // Create signature for duplicate detection (exclude id & conversation_id)
    const sig = ['name', 'phone', 'email', 'date', 'title', 'topic']
      .map(f => lead[f] || '')
      .join('|');
    const hash = crypto.createHash('md5').update(sig).digest('hex');
    
    if (seen.has(hash)) {
      console.log(`⏭ Skipping duplicate: ${lead.name || 'Unknown'} | ${lead.date || 'N/A'}`);
      continue;
    }
    
    seen.set(hash, true);
    
    // Add unique ID if missing
    if (!lead.id) {
      lead.id = `lead_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    unique.push(lead);
  }
  
  console.log(`✅ Deduplication: kept ${unique.length} unique leads, removed ${leads.length - unique.length}`);
  return unique;
}

// Merge new leads with existing ones (avoid duplicates, new at top)
async function mergeLeads(existingLeads, newLeads) {
  // ALWAYS load original leads (67 leads from initial CRM)
  const originalLeads = await getOriginalLeads();
  
  // Combine: original (always preserve) + existing + new
  const combined = [...originalLeads, ...existingLeads, ...newLeads];
  
  // Deduplicate the combined list
  const deduped = deduplicateLeads(combined);
  
  // Sort by date (latest first)
  deduped.sort((a, b) => {
    const dateA = new Date(a.date || '1970-01-01');
    const dateB = new Date(b.date || '1970-01-01');
    return dateB - dateA;
  });
  
  console.log(`📊 Merged: ${deduped.length} total leads (${originalLeads.length} original + ${newLeads.length} new)`);
  return deduped;
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
    const body = {
      message: `Update leads from pipeline - ${new Date().toISOString()}`,
      content: base64Content,
      sha: sha || undefined
    };
    
    console.log(`📤 Uploading ${leads.length} leads to GitHub...`);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Livealth-Leads-Pipeline'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub upload error: ${error.message}`);
    }
    
    console.log(`✅ Successfully updated dashboard_data.json on GitHub`);
    return true;
  } catch (error) {
    console.error('❌ Error updating GitHub:', error.message);
    return false;
  }
}

// Main pipeline function
async function runPipeline() {
  console.log(`🚀 Livealth Leads Pipeline Starting...`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  // Step 1: Fetch conversations from ElevenLabs
  const conversations = await fetchConversations();
  if (conversations.length === 0) {
    console.log('ℹ️ No new conversations to process');
    return;
  }
  
  // Step 2: Transform to leads format
  const newLeads = conversations.map(transformConversationToLead);
  console.log(`🔄 Transformed ${newLeads.length} conversations to leads`);
  
  // Step 3: Fetch existing leads from GitHub
  const { leads: existingLeads, sha } = await fetchCurrentLeads();
  
  // Step 4: Merge (new at top, preserve existing, sort by date)
  const mergedLeads = mergeLeads(existingLeads, newLeads);
  
  // Step 5: Update GitHub
  const success = await updateLeadsOnGitHub(mergedLeads, sha);
  
  if (success) {
    console.log(`🎉 Pipeline completed successfully! Total leads: ${mergedLeads.length}`);
  } else {
    console.log(`❌ Pipeline failed to update GitHub`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runPipeline().catch(error => {
    console.error('❌ Pipeline error:', error);
    process.exit(1);
  });
}

module.exports = { runPipeline, fetchConversations, transformConversationToLead };
