-- VidyaMitra AI database schema (reference).
-- The backend creates these tables automatically on first start, so you do NOT need to run this file.
-- It is provided for documentation (ER diagram, report) and for creating the schema manually in MySQL.
-- Syntax below is MySQL 8; it also works in PostgreSQL after replacing AUTO_INCREMENT with SERIAL.

CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'student',   -- student | admin
  plan            VARCHAR(20)  NOT NULL DEFAULT 'free',      -- free | pro
  plan_expires_at DATETIME     NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,     -- set after email OTP verification
  created_at      DATETIME     NOT NULL
);

CREATE TABLE email_otps (                                     -- one-time codes for verification / password reset
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  purpose     VARCHAR(20)  NOT NULL,                         -- verify | reset
  code_hash   VARCHAR(128) NOT NULL,                         -- HMAC-SHA256 of the code; the code itself is never stored
  attempts    INT          NOT NULL DEFAULT 0,               -- wrong attempts (max 5)
  used        BOOLEAN      NOT NULL DEFAULT FALSE,
  expires_at  DATETIME     NOT NULL,                         -- 10 minutes after creation
  created_at  DATETIME     NOT NULL
);

CREATE TABLE documents (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  title       VARCHAR(255) NOT NULL,
  filename    VARCHAR(255) NOT NULL,                         -- stored file name in backend/uploads
  file_type   VARCHAR(10)  NOT NULL,                         -- pdf | txt
  pages       INT          NOT NULL DEFAULT 1,
  word_count  INT          NOT NULL DEFAULT 0,
  summary     TEXT         NOT NULL,
  key_terms   TEXT         NOT NULL,                         -- JSON array
  created_at  DATETIME     NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE chunks (                                         -- searchable passages of each document
  id          INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT  NOT NULL,
  page        INT  NOT NULL,
  position    INT  NOT NULL,
  text        TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE questions (                                      -- every question asked and its answer
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT         NOT NULL,
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  confidence  FLOAT       NOT NULL DEFAULT 0,
  found       BOOLEAN     NOT NULL DEFAULT TRUE,
  mode        VARCHAR(20) NOT NULL DEFAULT 'offline',        -- offline | llm
  sources     TEXT        NOT NULL,                          -- JSON array of citations
  created_at  DATETIME    NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE quizzes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT      NOT NULL,
  document_id INT      NOT NULL,
  questions   TEXT     NOT NULL,                             -- JSON array incl. correct answers
  created_at  DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE quiz_attempts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id     INT      NOT NULL,
  user_id     INT      NOT NULL,
  answers     TEXT     NOT NULL,                             -- JSON {question_id: chosen option}
  score       INT      NOT NULL,
  total       INT      NOT NULL,
  created_at  DATETIME NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  order_id    VARCHAR(100) NOT NULL UNIQUE,
  payment_id  VARCHAR(100) NULL,
  amount      INT          NOT NULL,                         -- in paise (19900 = Rs 199)
  currency    VARCHAR(10)  NOT NULL DEFAULT 'INR',
  status      VARCHAR(20)  NOT NULL DEFAULT 'created',       -- created | paid | failed
  mode        VARCHAR(20)  NOT NULL DEFAULT 'demo',          -- razorpay | demo
  created_at  DATETIME     NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_email_otps_email ON email_otps(email);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_questions_user ON questions(user_id, created_at);
