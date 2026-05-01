# Project Reproduction Guide & README

This document provides the complete structure and steps to replicate the **AI-Powered Face Recognition Gallery** project.

---

## 📂 1. Project Folder Structure

To create a copy of this project, set up the following directory structure:

```text
user_profile/
├── ai_service/             # Python FastAPI + DeepFace
│   ├── main.py             # Core AI logic (face detection/matching)
│   └── requirements.txt    # Python dependencies
├── backend/                # Express.js + Prisma + Supabase
│   ├── prisma/             # Database schema (schema.prisma)
│   ├── src/                # Controllers, Services, Repositories
│   ├── .env                # Database URLs & Secrets
│   ├── package.json        # Node dependencies
│   └── tsconfig.json       # TS configuration
├── frontend/               # React + Vite + TypeScript
│   ├── src/                # Pages, Components, Services, Styles
│   ├── package.json        # React dependencies
│   └── vite.config.ts      # Vite configuration
└── README.md               # Main project documentation
```

---

## 🔑 2. Environment Variables & Supabase Setup

### Supabase Setup
1. **Database**: Create a new Supabase project at [supabase.com](https://supabase.com).
2. **Storage**: Create a bucket named `gallery`. Set it to **Public**.
3. **Connection**: Go to **Project Settings > Database** to get your connection strings.

### Backend `.env`
Create `backend/.env` with these values:
```env
# Transaction mode (for Prisma client)
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?pgbouncer=true"

# Session mode (for Migrations)
DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# App Settings
PORT=4001
AI_SERVICE_URL="http://localhost:8000"
```

### Supabase Config (`backend/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;
```

---

## 🚀 3. Step-by-Step Setup

### Step A: AI Service (Python)
1. Navigate to `ai_service`.
2. Create virtual environment: `python -m venv venv`.
3. Activate venv: `.\venv\Scripts\activate` (Windows).
4. Install dependencies:
   ```bash
   pip install fastapi uvicorn python-multipart deepface tf-keras opencv-python-headless numpy
   ```
5. Run: `uvicorn main:app --reload --port 8000`.

### Step B: Backend (Node.js)
1. Navigate to `backend`.
2. Install dependencies: `npm install`.
3. Initialize Prisma: `npx prisma generate`.
4. Run migrations: `npx prisma migrate dev --name init`.
5. Start server: `npm run dev` (running on port 4001).

### Step C: Frontend (React)
1. Navigate to `frontend`.
2. Install dependencies: `npm install`.
3. Start dev server: `npm run dev`.

---

## 📄 4. Project README

# AI Face Recognition Gallery

A premium photo management application featuring automatic face detection, person clustering, and shared albums.

## ✨ Features
- **Face Recognition**: Automatically identifies people in uploaded photos using DeepFace.
- **Smart Tagging**: Extracts hashtags and labels from images.
- **People Discovery**: Groups photos by individual faces.
- **Shared Albums**: Create albums and share them via unique links.
- **Supabase Integration**: Robust storage and PostgreSQL database.

## 🛠️ Tech Stack
- **Frontend**: React, TypeScript, Vite, CSS (Glassmorphism).
- **Backend**: Node.js, Express, Prisma ORM.
- **AI Service**: Python, FastAPI, DeepFace (FaceNet model).
- **Database**: Supabase (PostgreSQL).

## 🚦 Getting Started
1. Clone the repository.
2. Set up the Python `ai_service` environment.
3. Configure `.env` in `backend`.
4. Run `npx prisma migrate dev` in the backend folder.
5. Launch all three services (Frontend, Backend, AI).
