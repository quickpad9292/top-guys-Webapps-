# Cognithan

Bold, fast note-taking built with **Next.js 16**, **Supabase** and **Tiptap**.

## Features

- **Block editor**: headings, to-dos, lists, quotes, code, highlights, links, images; type `/` for blocks, select text for formatting
- **Folders & colour tags**, pinning, archive, instant full-text search, autosave
- **Real-time co-editing** (Yjs over private Supabase Realtime channels) with live presence
- **Sharing**: invite people by email as *editor* or *viewer*, or publish a revocable read-only link (`/s/<token>`)
- **AI** (Claude): summarize, rewrite, auto-tag, and "ask your notes". Off until `ANTHROPIC_API_KEY` is set
- **⌘K command palette** and keyboard shortcuts
- **Image uploads** (paste / drag / `/image`) to Supabase Storage
- **Export** to Markdown or PDF (print)
- **Installable PWA**, responsive down to phone width, light & dark mode

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| ⌘/Ctrl + K | Command palette (search notes, run actions) |
| ⌘/Ctrl + Alt + N | New note |
| ⌘/Ctrl + \ | Toggle sidebar (mobile) |
| ⌘/Ctrl + S | Save now |
| ⌘/Ctrl + J | AI assistant |
| ⌘/Ctrl + Shift + P | Pin / unpin note |
| `/` in the editor | Insert a block |

## Setup

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

Environment variables:

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | already set in Vercel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + `.env.local` | already set in Vercel |
| `ANTHROPIC_API_KEY` | Vercel only (secret) | optional, enables AI |

### Supabase

The schema lives in `supabase/migrations/` and has already been applied to the `cognithan` project:
tables with row-level security, a `private` schema for access helpers, the `invite_collaborator` and
`get_shared_note` RPCs, Realtime channel authorization, and the `note-images` storage bucket.

In the Supabase dashboard → **Authentication → URL Configuration**, set:

- **Site URL**: your production URL (e.g. `https://cognithan.vercel.app`)
- **Redirect URLs**: `https://*.vercel.app/**` and `http://localhost:3000/**`

Supabase's built-in email sender only delivers to your own team's addresses and is heavily rate-limited.
For real users, add custom SMTP (Authentication → Emails → SMTP settings) or turn off "Confirm email".

## Project structure

```
src/
  proxy.ts                     session refresh + auth redirects (Next 16 "proxy", formerly middleware)
  app/
    page.tsx                   landing page
    (auth)/                    login, signup, forgot / update password
    auth/callback/route.ts     email-link + OAuth code exchange
    notes/                     app shell + note editor routes
    s/[token]/                 public read-only shared note
    api/ai/route.ts            Claude-powered AI actions
    manifest.ts, icons/        PWA
  components/app/              store, sidebar, note list, command palette
  components/editor/           Tiptap editor, slash menu, share dialog, AI panel, export
  lib/collab.ts                Yjs ↔ Supabase Realtime provider
supabase/migrations/           database schema
```
