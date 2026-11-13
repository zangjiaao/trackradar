-- Only public author metadata from OPC feeds; no profile crawling or history expansion.
CREATE TABLE opc_authors (
  id TEXT PRIMARY KEY,
  username TEXT,
  name TEXT,
  bio TEXT,
  location TEXT,
  verified INTEGER CHECK (verified IN (0, 1))
);
ALTER TABLE case_candidates ADD COLUMN author_id TEXT REFERENCES opc_authors(id);
CREATE INDEX idx_case_candidates_author ON case_candidates(author_id, stage, lead_id);
