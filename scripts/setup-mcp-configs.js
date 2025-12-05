// scripts/setup-mcp-configs.js
// One-time script to create master MCP configurations
// Run with: node scripts/setup-mcp-configs.js

const { Composio } = require('@composio/core');
require('dotenv').config({ path: '.env.local' });

/**
 * Creates ONE MCP config per mode (Sales, Marketing, Admin)
 * Each config contains ALL toolkits that users might select
 */

async function setupMCPConfigs() {
  const composio = new Composio({ 
    apiKey: process.env.COMPOSIO_API_KEY 
  });

  console.log('🚀 Starting MCP Configuration Setup...\n');

  // ============================================
  // SALES MODE MCP CONFIG
  // ============================================
  
  console.log('📦 Creating Sales MCP Config...');
  
  const salesToolkits = [
    { toolkit: "hubspot", authConfigId: process.env.AUTH_CONFIG_HUBSPOT || "default" },
    { toolkit: "gmail", authConfigId: process.env.AUTH_CONFIG_GMAIL || "default" },
    { toolkit: "googlecalendar", authConfigId: process.env.AUTH_CONFIG_CALENDAR || "default" },
    { toolkit: "googledrive", authConfigId: process.env.AUTH_CONFIG_DRIVE || "default" },
  ];

  try {
    const salesMCP = await composio.mcp.create("ai-workstation-sales-master", {
      toolkits: salesToolkits,
    });

    console.log('✅ Sales MCP Created!');
    console.log(`   ID: ${salesMCP.id}`);
    console.log(`   Add to .env: MCP_CONFIG_SALES=${salesMCP.id}\n`);
  } catch (error) {
    console.error('❌ Sales MCP creation failed:', error.message);
  }

  // ============================================
  // MARKETING MODE MCP CONFIG
  // ============================================
  
  console.log('📦 Creating Marketing MCP Config...');
  
  const marketingToolkits = [
    { toolkit: "gmail", authConfigId: process.env.AUTH_CONFIG_GMAIL || "default" },
    { toolkit: "slack", authConfigId: process.env.AUTH_CONFIG_SLACK || "default" },
    { toolkit: "googlesheets", authConfigId: process.env.AUTH_CONFIG_SHEETS || "default" },
    { toolkit: "notion", authConfigId: process.env.AUTH_CONFIG_NOTION || "default" },
  ];

  try {
    const marketingMCP = await composio.mcp.create("ai-workstation-marketing-master", {
      toolkits: marketingToolkits,
    });

    console.log('✅ Marketing MCP Created!');
    console.log(`   ID: ${marketingMCP.id}`);
    console.log(`   Add to .env: MCP_CONFIG_MARKETING=${marketingMCP.id}\n`);
  } catch (error) {
    console.error('❌ Marketing MCP creation failed:', error.message);
  }

  // ============================================
  // ADMIN MODE MCP CONFIG
  // ============================================
  
  console.log('📦 Creating Admin MCP Config...');
  
  const adminToolkits = [
    { toolkit: "jira", authConfigId: process.env.AUTH_CONFIG_JIRA || "default" },
    { toolkit: "slack", authConfigId: process.env.AUTH_CONFIG_SLACK || "default" },
    { toolkit: "googledrive", authConfigId: process.env.AUTH_CONFIG_DRIVE || "default" },
    { toolkit: "asana", authConfigId: process.env.AUTH_CONFIG_ASANA || "default" },
  ];

  try {
    const adminMCP = await composio.mcp.create("ai-workstation-admin-master", {
      toolkits: adminToolkits,
    });

    console.log('✅ Admin MCP Created!');
    console.log(`   ID: ${adminMCP.id}`);
    console.log(`   Add to .env: MCP_CONFIG_ADMIN=${adminMCP.id}\n`);
  } catch (error) {
    console.error('❌ Admin MCP creation failed:', error.message);
  }

  // ============================================
  // SUMMARY
  // ============================================
  
  console.log('\n🎉 MCP Configuration Setup Complete!');
  console.log('\n📝 Next Steps:');
  console.log('1. Copy the MCP IDs above to your .env.local file');
  console.log('2. Restart your dev server');
  console.log('3. The system will now generate per-user URLs dynamically!');
}

// Run the setup
setupMCPConfigs()
  .then(() => {
    console.log('\n✅ Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });
