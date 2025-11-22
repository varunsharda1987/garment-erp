// Test script for AI functionality
// Run with: node backend/test-ai.js

import { AIProviderFactory } from './src/services/ai/providers/AIProviderFactory.js';

async function testAI() {
  console.log('\n🤖 Testing Ollama AI Integration...\n');
  console.log('='.repeat(50));

  try {
    // Get the AI provider
    const ai = AIProviderFactory.getProvider();

    console.log('\n✅ Provider Information:');
    console.log('   Name:', ai.getProviderName());
    console.log('   Model:', ai.getDefaultModel());

    // Test 1: Check if provider is available
    console.log('\n📡 Checking provider availability...');
    const isAvailable = await ai.isAvailable();

    if (!isAvailable) {
      console.log('❌ Provider not available!');
      console.log('   Make sure Ollama is running: ollama serve');
      return;
    }

    console.log('✅ Provider is available and ready!\n');

    // Test 2: Simple text generation
    console.log('🧪 Test 1: Simple Text Generation');
    console.log('   Prompt: "Explain what an ERP system does in one sentence."\n');
    console.log('   Generating response...\n');

    const response = await ai.generateText({
      prompt: 'Explain what an ERP system does in one sentence.',
      maxTokens: 100,
      temperature: 0.7,
    });

    console.log('   Response:', response.text);
    console.log('   Provider:', response.provider);
    console.log('   Model:', response.model);

    // Test 3: ERP-specific query
    console.log('\n🧪 Test 2: ERP-Specific Query');
    console.log('   Prompt: "List 3 benefits of using AI in manufacturing ERP."\n');
    console.log('   Generating response...\n');

    const erpResponse = await ai.generateText({
      systemPrompt: 'You are an ERP expert for garment manufacturing.',
      prompt: 'List 3 benefits of using AI in manufacturing ERP. Keep each benefit to one sentence.',
      maxTokens: 150,
      temperature: 0.7,
    });

    console.log('   Response:', erpResponse.text);

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed! AI is working perfectly!\n');
    console.log('Next steps:');
    console.log('1. Restart your backend: cd backend && npm run dev');
    console.log('2. You should see: ✅ AI Provider initialized: Ollama (Local)');
    console.log('3. Start building AI features in your ERP!\n');

  } catch (error) {
    console.error('\n❌ Error testing AI:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Ollama is installed: ollama --version');
    console.error('2. Make sure llama3 model is pulled: ollama pull llama3');
    console.error('3. Make sure Ollama is running: ollama serve');
    console.error('4. Check your .env file has:');
    console.error('   AI_ENABLED="true"');
    console.error('   AI_PROVIDER="ollama"');
    console.error('   AI_MODEL="llama3"');
    console.error('   AI_BASE_URL="http://localhost:11434"\n');
  }
}

// Run the test
testAI();
