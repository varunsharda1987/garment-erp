const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function enablePgVector() {
  try {
    console.log('Enabling pgvector extension...');

    // Enable vector extension
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✅ pgvector extension enabled');

    // Create document_embeddings table
    console.log('\nCreating document_embeddings table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_type VARCHAR(50) NOT NULL,
        source_id VARCHAR(255),
        title VARCHAR(500),
        content TEXT NOT NULL,
        content_hash VARCHAR(64),
        embedding vector(768),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ document_embeddings table created');

    // Create indexes
    console.log('\nCreating indexes...');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_embeddings_document_type ON document_embeddings(document_type)');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_embeddings_source_id ON document_embeddings(source_id)');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON document_embeddings(content_hash)');
    console.log('✅ Indexes created');

    // Verify installation
    console.log('\nVerifying installation...');
    const extensions = await prisma.$queryRaw`SELECT * FROM pg_extension WHERE extname = 'vector'`;
    console.log('✅ Vector extension verified:', extensions);

    const tableCheck = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'document_embeddings'
    `;
    console.log('✅ Table verified:', tableCheck);

    console.log('\n🎉 pgvector setup complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('permission denied')) {
      console.error('\n⚠️  You may need superuser privileges to create extensions.');
      console.error('Try running: psql -U postgres -d kashaya_erp -c "CREATE EXTENSION IF NOT EXISTS vector"');
    }
  } finally {
    await prisma.$disconnect();
  }
}

enablePgVector();
