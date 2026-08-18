# Private Two-Person Real-Time Chat Web Application

A secure, modern, responsive, and private real-time messaging application built specifically for **two authorized users**.

Optimized for **iPhone Safari** (safe area insets, keyboard-friendly input, 100dvh, PWA installable) and **Laptop Chrome/Edge** (sidebar thread, desktop shortcuts, live typing indicators, image attachments, read receipts).

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite / Next.js compatible architecture, Tailwind CSS, Lucide React, Motion.
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Supabase Realtime Channels, Storage, and Row Level Security).
- **Hosting / Deployment**: Ready for Vercel + Supabase.

---

## ✨ Key Features

1. **Strict Two-Person Privacy**:
   - Database-level Row Level Security (RLS) ensuring only the two participants can query or send messages.
   - `noindex, nofollow` headers to protect from search engine indexing.
2. **Supabase Real-Time Communication**:
   - Instant message delivery via PostgreSQL database replication channels.
   - Real-time debounced **typing indicators** (`typing... ❤️`).
   - Live **online / offline presence** tracking.
3. **Read Receipts**:
   - Sent (`✓`) and Read (`✓✓`) visual status indicators.
   - Recipient automatically updates read status upon viewing.
4. **Attachments & Photos**:
   - Client-side image compression before upload.
   - Supabase Storage bucket (`chat_attachments`) integration.
   - Interactive full-screen Image Lightbox with zoom and download.
5. **Emoji Reactions & Picker**:
   - Curated categorized emoji drawer (Love & Hearts, Smiles, Food/Gestures).
6. **Mobile First & PWA**:
   - Designed for iOS Safari bottom navigation bar and home screen installation.
7. **Interactive 2-User Simulation Mode**:
   - Built-in live cross-tab / split-view testing lab allowing instant two-way testing without needing two separate physical devices during development!

---

## 🚀 Quick Start & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Populate your Supabase Project keys:
```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"

# Vite equivalents
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"
```

> **Note**: If you run the app without Supabase credentials, it automatically activates the **Sandbox Simulator mode** with built-in test profiles (Alex & Sam) so you can test all features immediately!

### 3. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗄️ Supabase Setup & SQL Migration

1. Create a project at [https://supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy the complete SQL script from `supabase/schema.sql` and click **Run**.
4. Create the two authorized users in **Authentication -> Users**:
   - User 1: `alex@private.chat`
   - User 2: `sam@private.chat`
5. Enable Realtime on the `messages` and `profiles` tables under **Database -> Replication**.

---

## 🔒 Security & Row Level Security (RLS) Summary

All security is enforced on the PostgreSQL database level:
- **`profiles`**: Selectable by authenticated users; updates restricted to `auth.uid() = id`.
- **`conversations`**: Only viewable if user ID exists in `conversation_members`.
- **`messages`**: Users can only query messages from conversations they are a member of. Users can only insert messages with `sender_id = auth.uid()`.
- **`chat_attachments` (Storage)**: Storage objects restricted to authenticated participants.

---

## 📱 iPhone Safari PWA Installation

1. Open the hosted chat URL in **Safari** on iOS.
2. Tap the **Share button** (square with upward arrow).
3. Select **"Add to Home Screen"**.
4. Launch from your home screen for full-screen view without browser address bars!
