#!/usr/bin/env node
const express = require('express');
const path = require('path');
const app = express();
const PORT = 8080;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to update leads (GitHub update)
app.post('/api/update-leads', express.json(), async (req, res) => {
    try {
        const { leads } = req.body;
        
        // GitHub configuration
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            return res.status(500).json({ error: 'Server misconfigured: Missing GITHUB_TOKEN environment variable' });
        }
        
        const repoOwner = 'kamatanuj';
        const repoName = 'livealth-crm';
        const filePath = 'public/dashboard_data.json';
        
        // Get current file to get its SHA
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!response.ok) {
            return res.status(500).json({ error: 'Failed to get file from GitHub' });
        }
        
        const fileData = await response.json();
        const sha = fileData.sha;
        
        // Update file content
        const content = JSON.stringify({ leads, lastUpdated: new Date().toISOString() }, null, 2);
        const base64Content = Buffer.from(content).toString('base64');
        
        const updateResponse = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Delete lead - auto-update from local server',
                    content: base64Content,
                    sha: sha
                })
            }
        );
        
        if (!updateResponse.ok) {
            const error = await updateResponse.json();
            return res.status(500).json({ error: 'Failed to update file', details: error });
        }
        
        res.json({ success: true, message: 'Leads updated successfully' });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Livealth CRM server running at http://127.0.0.1:${PORT}`);
    console.log(`📁 Serving files from: ${path.join(__dirname, 'public')}`);
});
