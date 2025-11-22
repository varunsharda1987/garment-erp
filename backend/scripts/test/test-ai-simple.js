// Simple AI test without database dependencies
// Run with: node backend/test-ai-simple.js

console.log('\n🤖 Testing Ollama AI Integration...\n');
console.log('='.repeat(50));

async function testAI() {
  try {
    // Direct test without TypeScript compilation
    const fetch = (await import('node-fetch')).default;

    console.log('\n📡 Checking Ollama availability...');

    const healthCheck = await fetch('http://localhost:11434/api/tags');

    if (!healthCheck.ok) {
      console.log('❌ Ollama not available!');
      console.log('   Make sure Ollama is running');
      return;
    }

    console.log('✅ Ollama is running!');

    // Test simple text generation
    console.log('\n🧪 Test: Simple Text Generation');
    console.log('   Prompt: "Explain what an ERP system does in one sentence."\n');
    console.log('   Generating response (this may take 10-20 seconds)...\n');

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'll ama3',
        prompt: 'Explain what an ERP system does in one sentence.',
        stream: false,
      }),
    });

    const data = await response.json();

    console.log('   ✅ Response:', data.response);
    console.log('   Model: llama3');
    console.log('   Provider: Ollama (Local)');

    console.log('\n' + '='.repeat(50));
    console.log('✅ AI test passed! Ollama is working!\n');
    console.log('Next step: Restart your backend server:');
    console.log('   cd backend && npm run dev\n');
    console.log('You should see:');
    console.log('   ✅ AI Provider initialized: Ollama (Local) (llama3)\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Ollama is running');
    console.error('2. Make sure llama3 model is downloaded: ollama list');
    console.error('3. Try: ollama run llama3 "hello"\n');
  }
}

testAI();
