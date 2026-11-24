# VidyaMitra AI: Retrieval-Augmented Study Assistant with Automated Quiz Generation

**Domain:** Artificial Intelligence, Machine Learning and Generative AI

Students upload their lecture notes (PDF or TXT). The system reads and indexes them, then:

- answers questions **only from the student's own notes**, with the **document and page** each answer came from and a **confidence score**
- clearly says **"not found in your notes"** when a question is outside the uploaded material, instead of making up an answer
- produces an **AI summary** and **key terms** for every document
- generates **multiple-choice quizzes** from any document, scores them and explains every answer
- includes registration with **email OTP verification**, **forgot password** by OTP, role-based dashboards, Free/Pro plans with a **payment gateway** (Razorpay or a built-in demo mode) and an **admin panel** with analytics

The answer engine runs **fully offline** (TF-IDF retrieval with scikit-learn), so the project works on any college lab machine with no API keys. An optional LLM (OpenAI, or a free local Ollama model) can be switched on for generative answers.

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend | Python, FastAPI, SQLAlchemy, JWT authentication |
| AI / NLP | scikit-learn (TF-IDF vector retrieval, extractive QA, centroid summarisation), pypdf |
| Database | SQLite by default (zero setup); MySQL or PostgreSQL supported |
| Payments | Razorpay Orders API + signature verification, or demo mode |
| Email OTP | SMTP (e.g. Gmail), or demo mode that shows the code on screen |

---

## 1. Prerequisites

Install these once:

| Software | Version | Check with |
|---|---|---|
| Python | 3.10, 3.11, 3.12 or 3.13 | `python --version` (Windows may need `py --version`) |
| Node.js | 18 or newer (20 LTS recommended) | `node --version` |

Windows: when installing Python, tick **"Add Python to PATH"**.

## 2. Folder structure

```
vidyamitra-ai/
├── backend/            FastAPI server (API, AI engine, database)
│   ├── app/            source code (routers = API endpoints, services = AI/NLP logic)
│   ├── uploads/        uploaded files are stored here
│   ├── seed.py         creates demo accounts and loads sample notes
│   ├── requirements.txt
│   └── .env.example    settings template
├── frontend/           React web application
├── database/
│   └── schema.sql      table definitions (reference; tables are created automatically)
└── sample_data/        sample lecture-note PDFs for the demo
```

## 3. Backend setup (Terminal 1)

**Windows (Command Prompt or PowerShell)**

```bat
cd vidyamitra-ai\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

**macOS / Linux**

```bash
cd vidyamitra-ai/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

What each step does:

1. `python -m venv venv` creates an isolated Python environment for the project.
2. `activate` switches into it (your prompt will show `(venv)`).
3. `pip install` installs the backend libraries (about 1–3 minutes).
4. `.env` holds the settings; the defaults work as they are.
5. `python seed.py` creates the database, two demo accounts and loads two sample notes. You should see:
   ```
   Created admin   account: admin@vidyamitra.ai / Admin@123
   Created student account: student@vidyamitra.ai / Student@123
   Loaded sample notes: Operating Systems: CPU Scheduling (3 pages, 22 chunks)
   Loaded sample notes: DBMS: Normalization (3 pages, 16 chunks)
   ```
6. `uvicorn` starts the API server. Keep this terminal open.

**Check:** open http://localhost:8000/api/health. It should show `{"status":"ok","answer_engine":"offline","email":"demo"}`.
Interactive API documentation is at http://localhost:8000/docs.

## 4. Frontend setup (Terminal 2)

Open a **second** terminal:

```bash
cd vidyamitra-ai/frontend
npm install
npm run dev
```

`npm install` takes 1–2 minutes the first time. Then open **http://localhost:5173** in your browser.

## 5. Log in

| Role | Email | Password |
|---|---|---|
| Student | student@vidyamitra.ai | Student@123 |
| Admin | admin@vidyamitra.ai | Admin@123 |

The login page has one-click buttons that fill these in. Demo accounts are already verified.

**New accounts** must verify their email with a 6-digit code. Without email settings the app runs in **demo mode**: the code is shown on the verify screen and printed in the backend terminal, so registration works on any machine. To send real emails, see section 7.

## 6. Demo walkthrough (about 5 minutes)

1. **Register a new account** → the verify screen shows the 6-digit code (demo mode) → enter it → you're in. Log out, then use **Forgot password?** to reset the password with a new code.
2. **Log in** as the demo student. The dashboard shows documents, questions, quiz scores and the Free-plan usage meter.
3. **My Documents:** two sample notes are already loaded. Open one to see the **AI summary**, **key terms** and stats.
4. **Upload live:** upload `sample_data/Computer_Networks_OSI_Model.pdf`. It is analysed in a few seconds.
5. **Ask AI:** try these questions and point out the confidence badge, highlighted keywords and page citations:
   - *What is the convoy effect?*
   - *What is the difference between TCP and UDP?*
   - *What is a foreign key?*
   - *Which layer do routers work at?*
   - *Who won the cricket world cup?* → correctly answers **"Not found in your notes"** (no made-up answers)
   - Use the **Search in** chips to restrict questions to one document.
6. **Quizzes:** pick a document → **Generate quiz** → answer → **Submit** to see the score ring and explanations with page numbers.
7. **Free-plan limit:** with 3 documents uploaded, a 4th upload is blocked with an upgrade message.
8. **Plans & Billing → Upgrade to Pro → Pay now:** the plan switches to PRO and the payment appears in the history. Now the 4th upload works.
9. **Log out → log in as Admin:** see users, Pro users, revenue, answer rate, charts, the users table (verified status, activate/deactivate) and all payments.

## 7. Optional features

### Single-server mode (for deployment or one-URL demos)

```bash
cd frontend
npm run build
```

Restart the backend. The full app is now served at **http://localhost:8000**, so the frontend dev server is not needed.

### Real email OTP with Gmail

1. Use a Gmail account with **2-Step Verification** turned on (Google Account → Security).
2. Go to Google Account → Security → **App passwords** (or search "App passwords" in your Google Account), create one named "VidyaMitra" and copy the 16-character password.
3. In `backend/.env` set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yourname@gmail.com
   SMTP_PASSWORD=the16charapppassword
   ```
4. Restart the backend. `/api/health` now shows `"email":"smtp"`, and codes arrive by email (check spam the first time).

If the email server can't be reached (for example, a college network that blocks port 587), the app shows the code on screen with a warning instead of getting stuck. Set `OTP_DEMO_FALLBACK=false` to turn this off in production. Other providers (Outlook, Zoho, Brevo, etc.) work the same way with their SMTP host and port.

### Real Razorpay checkout (test mode, no real money)

1. Create a free account at https://dashboard.razorpay.com and switch to **Test Mode**.
2. Settings → API Keys → Generate Test Key.
3. In `backend/.env` set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, then restart the backend.
4. Upgrade again: the real Razorpay popup opens. Use Razorpay's test card or UPI details from their documentation.

### Generative answers with an LLM

In `backend/.env`:

- **OpenAI:** set `LLM_API_KEY=<your key>` (model `gpt-4o-mini` by default).
- **Free local model with Ollama:** install Ollama, run `ollama pull llama3.1`, then set
  `LLM_API_KEY=ollama`, `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_MODEL=llama3.1`.

Restart the backend. Answers are then written by the LLM, still grounded in the retrieved passages and cited. If the LLM is unreachable, the offline engine answers automatically.

### MySQL instead of SQLite

1. Create the database: `CREATE DATABASE vidyamitra;`
2. `pip install PyMySQL`
3. In `backend/.env`: `DATABASE_URL=mysql+pymysql://root:yourpassword@localhost:3306/vidyamitra`
4. Run `python seed.py` again, then start the backend. Tables are created automatically.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `python` is not recognized (Windows) | Use `py` instead of `python`, or reinstall Python with "Add to PATH" ticked |
| PowerShell blocks `venv\Scripts\activate` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt |
| "Cannot reach the server" in the browser | The backend isn't running. Start it in Terminal 1 and check http://localhost:8000/api/health |
| Port 8000 or 5173 already in use | Close the other program, or run `uvicorn app.main:app --port 8001` and change the port in `frontend/vite.config.js` |
| Login says "Incorrect email or password" for demo accounts | Run `python seed.py` from the `backend` folder |
| OTP email doesn't arrive | Check spam; make sure you used a Gmail **App Password**; check the backend terminal for "Email sending failed" (network or password problem) |
| "Please wait N seconds before requesting a new code" | Resend is limited to once a minute. Use the last code, or wait for the timer |
| "Too many wrong attempts" | Each code allows 5 tries. Click **Resend code** to get a new one |
| Upload says "No readable text found" | The PDF is a scanned image. Use a text-based PDF or a TXT file |
| "You've used all 20 free questions for today" | Expected on the Free plan. Upgrade to Pro, or raise `FREE_DAILY_QUESTIONS` in `.env` |
| Start over with a clean database | Stop the backend, delete `backend/vidyamitra.db`, run `python seed.py`, start again |

## 9. How the AI works (for the report and viva)

1. **Ingestion:** text is extracted page by page (pypdf), cleaned (headings removed, wrapped lines joined), split into sentences and grouped into overlapping 3-sentence **chunks**, each stored with its page number.
2. **Retrieval:** for each question, the chunks and the question are converted to **TF-IDF vectors** (unigrams and bigrams, English stop words removed), and **cosine similarity** ranks the chunks.
3. **Answer extraction:** sentences from the top chunks are scored by similarity to the question, with boosts for definition patterns ("X is a…", "called X") and penalties for sentences that depend on earlier context. The best 1–4 sentences form the answer. For comparison questions, each compared term is covered.
4. **Grounding check:** if the best match is below a threshold, or no question keyword appears in the best passage, the system returns **"not found in your notes"**. This prevents hallucinated answers.
5. **Confidence:** combines keyword coverage of the answer with the retrieval similarity score.
6. **Summary:** centroid-based extractive summarisation picks the sentences closest to the document's overall topic vector, skipping near-duplicates.
7. **Quiz generation:** key terms (TF-IDF-ranked phrases and acronyms) are blanked out of the document's own sentences, and other key terms of the same shape become the distractors.
8. **Optional RAG with an LLM:** the retrieved passages are sent to the LLM with instructions to answer only from them and cite passage numbers.

### Email OTP security

Codes are 6 random digits from a cryptographically secure generator, stored only as an HMAC-SHA256 hash, valid for 10 minutes, limited to 5 wrong attempts, single-use, and can be re-sent at most once a minute. The forgot-password form gives the same reply whether or not an email is registered, so it can't be used to discover accounts.

## 10. API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/register | Create account and send a verification OTP |
| POST | /api/auth/verify-email | Verify the OTP (returns JWT) |
| POST | /api/auth/resend-otp | Send a new OTP (60-second cooldown) |
| POST | /api/auth/login | Log in (returns JWT; unverified accounts are asked to verify) |
| POST | /api/auth/forgot-password, /api/auth/reset-password | Reset a password with an emailed OTP |
| GET | /api/auth/me | Current user |
| GET | /api/dashboard | Student dashboard stats |
| GET, POST | /api/documents | List / upload documents |
| GET, DELETE | /api/documents/{id} | Document detail / delete |
| POST | /api/ask | Ask a question (answer + citations + confidence) |
| GET | /api/ask/history, /api/ask/suggestions | Past questions / suggested questions |
| POST | /api/quizzes | Generate a quiz from a document |
| POST | /api/quizzes/{id}/submit | Submit answers, get score and review |
| GET | /api/quizzes/attempts | Quiz history |
| GET | /api/payments/config | Payment mode and price |
| POST | /api/payments/create-order, /api/payments/verify | Pro upgrade flow |
| GET | /api/admin/stats, /api/admin/users, /api/admin/payments | Admin analytics and management |
| PATCH | /api/admin/users/{id} | Activate / deactivate a user |

Full interactive documentation: http://localhost:8000/docs
