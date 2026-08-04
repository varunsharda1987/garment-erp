-- pgvector Extension Setup for RAG
-- Run this SQL manually on your PostgreSQL database (local and Railway)

-- Enable pgvector extension (Railway PostgreSQL supports this)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_embeddings table for RAG
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(255),
  title VARCHAR(500),
  content TEXT NOT NULL,
  content_hash VARCHAR(64),
  embedding vector(768),  -- 768 dimensions for nomic-embed-text (Ollama), change to 1536 for OpenAI
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_embeddings_document_type ON document_embeddings(document_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_source_id ON document_embeddings(source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON document_embeddings(content_hash);

-- Create vector similarity search index (IVFFlat for approximate nearest neighbor)
-- Note: This index is created after initial data load for better performance
-- CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON document_embeddings
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- For small datasets, use exact search (no special index needed)
-- The <=> operator will do exact cosine distance search

-- To verify the extension is installed:
-- SELECT * FROM pg_extension WHERE extname = 'vector';

-- To check the table:
-- SELECT COUNT(*) FROM document_embeddings;
