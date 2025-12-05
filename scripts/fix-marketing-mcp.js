// scripts/fix-marketing-mcp.js
// Fix the marketing MCP with shorter name

const { Composio } = require('@composio/core');
require('dotenv').config({ path: '.env.local' });

async function createMarketingMCP() {
  const composio = new Composio({ 
    apiKey: process.env.COMPOSIO_API_KEY 
  });

  console.log('📦 Creating Marketing MCP Config with shorter name...\n');
  
  const marketingToolkits = [
    { toolkit: "gmail", authConfigId: process.env.AUTH_CONFIG_GMAIL || "default" },
    { toolkit: "slack", authConfigId: process.env.AUTH_CONFIG_SLACK || "default" },
    { toolkit: "googlesheets", authConfigId: process.env.AUTH_CONFIG_SHEETS || "default" },
    { toolkit: "notion", authConfigId: process.env.AUTH_CONFIG_NOTION || "default" },
  ];

  try {
    // Shorter name: "ai-ws-marketing" = 17 chars
    const marketingMCP = await composio.mcp.create("ai-ws-marketing", {
      toolkits: marketingToolkits,
    });

    console.log('✅ Marketing MCP Created!');
    console.log(`   ID: ${marketingMCP.id}`);
    console.log(`   Add to .env: MCP_CONFIG_MARKETING=${marketingMCP.id}\n`);
    
    console.log('🎉 All done! Add this ID to your .env.local file');
  } catch (error) {
    console.error('❌ Marketing MCP creation failed:', error.message);
  }
}

createMarketingMCP()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
