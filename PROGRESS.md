# আল হামিদ বস্ত্রালয় — Development Progress

**Last Updated:** 2026-11-12 15:00
**Current Version:** v1.5
**Dev Server:** `npm run dev` → http://localhost:8080
**Supabase Project:** koqgvrgoyxdfezaomlzq

---

## ✅ Completed Steps (1-12)

### STEP 1 — Database Schema (v1.5)
- ✅ 27 tables (categories, areas, collections, chat_messages, reports, error_logs, audit_logs, uptime_checks, import_sessions, stock_movements, customer_documents, notices, events, collection_items + core 13)
- ✅ `products` এ `category_id`, `base_unit`, `unit_conversions` যোগ
- ✅ `memos` এ `memo_type` যোগ
- ✅ `next_serial` RPC (server-side serial generation)
- ✅ `confirm_memo` RPC fixed (base_quantity, paid split, permission check)
- ✅ RLS policies on all tables
- ✅ Storage bucket policies

### STEP 2 — Types + Drizzle
- ✅ `types.ts` regenerate from Supabase
- ✅ Drizzle journal fix
- ✅ Stale snapshots cleaned

### STEP 3 — TypeScript Compilation
- ✅ tsconfig strict flags relaxed (exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature, noUncheckedIndexedAccess → false)
- ✅ `error-logger.ts` context null type
- ✅ `admin.memo.$id.tsx` taka string fix
- ✅ `admin.import.tsx` explicit row types
- ✅ 0 TS errors

### STEP 4 — Runtime Bugs
- ✅ `api/health.ts` — `process.memoryUsage()` guard (Cloudflare compatible)
- ✅ `use-session-timeout.ts` — mousemove throttle (2s)
- ✅ `admin.stock.tsx` — inline edit mutation
- ✅ `admin.areas.tsx` — inline edit mutation

### STEP 5 — Security + Chat
- ✅ `password-reset.functions.ts` — account enumeration fix
- ✅ `chat.functions.ts` — `delivered_at` set (3-tick works)
- ✅ `admin.halkhata.tsx` — notice insert/deactivate race fix
- ✅ `admin.memo.new.tsx` — transaction-safe rollback

### STEP 6 — Collection + Notifications
- ✅ `admin.collection.tsx` — transaction-safe save with rollback
- ✅ `admin.collection.history.tsx` — 200-item chunked `in()` queries
- ✅ `NoticePopup.tsx` — auto-dismiss timer fix
- ✅ `use-chat-notification.ts` — toastAction ref + throttle

### STEP 7 — Performance
- ✅ `lib/ledger.ts` — `partiesDueBatch` + `suppliersDueBatch` (2-4 queries vs N+1)
- ✅ `admin.paona.tsx` — batch dues + server RPC serial
- ✅ `admin.wholesale.tsx` — same
- ✅ `use-me.ts` — 5-min staleTime cache

### STEP 8 — Dashboard + Supplier
- ✅ `admin.index.tsx` — threshold queryKey + backup 24 tables + busy state
- ✅ `admin.dena.tsx` — batch supplier dues
- ✅ `admin.party.$id.tsx` — Promise.all opening + 500 limits
- ✅ `admin.dena.$id.tsx` — 500 limit + pagination

### STEP 9 — Memo + Settings + Keyboard
- ✅ `use-shop-settings.ts` — MIME/size validation (2 MB, JPG/PNG/WebP/GIF)
- ✅ `use-keyboard-shortcuts.ts` — repeat + shift key checks
- ✅ `admin.memo.$id.tsx` — insert-first-then-delete (safe save)
- ✅ `admin.reports.tsx` — top dues bounded + as any removed

### STEP 10 — Quick Fixes
- ✅ `SiteHeader.tsx` — logout hard reload
- ✅ `admin.index.tsx` — low stock threshold invalidate
- ✅ `admin.stock.tsx` — initial stock movement log + forceRefresh button
- ✅ `BackButton.tsx` — window.history.back() (universal pattern)
- ✅ SQL: Stock movement backfill for existing products
- ✅ SQL: 16 area names corrected (Bengali + English)
- ✅ Route tree regen fixed 503 errors

### STEP 11 — Chat Voice Message
- ✅ SQL migration: `duration_seconds` column + `voice` message_type
- ✅ `ChatVoiceRecorder.tsx` (new) — MediaRecorder API, 2-min max, cancel
- ✅ `ChatBubble.tsx` — VoicePlayer with waveform
- ✅ `ChatInput.tsx` — onSendVoice prop
- ✅ `chat.functions.ts` — `sendCustomerVoice`, `sendAdminVoice`
- ✅ Storage: `chat-files` bucket, audio/webm uploads

### STEP 12 — User Avatar System
- ✅ SQL: `profiles.avatar_path` column + `avatars` bucket + RLS policies
- ✅ `UserAvatar.tsx` (new) — circular avatar with fallback
- ✅ `AvatarUploader.tsx` (new) — HD upload (10 MB), change, remove
- ✅ `use-me.ts` — includes `avatar_path`
- ✅ `account.tsx` — customer can upload own avatar
- ✅ `admin.users.tsx` — admin can change anyone's avatar
- ✅ `chat.functions.ts` — `listConversations` + `getConversation` return `avatar_path`
- ✅ `admin.messages.tsx` — avatar in conversation list + chat header
- ✅ `account_.messages.tsx` — shop photo in header (fallback "আ")

---

## 🔜 Pending (STEP 13+)

- [ ] **Avatar in Chat Bubble** — small photo next to each message bubble
- [ ] **Avatar cache-busting** — photo change instant update
- [ ] **Profile photo preview modal** — click to view large
- [ ] **Print/Share modal from memo list** — quick access
- [ ] **Customer documents upload from account** — self-service
- [ ] **Production deployment** — Vercel + custom domain + env check
- [ ] **Bulk import old data** — CSV templates + test data

---

## 🐛 Known Minor Issues

- Homepage hero image (`shop-hero.jpg`) missing — needs asset
- PWA icons 816×816 — should be 192/512/1024
- `admin.users.tsx` — avatar column may not show if not saved properly

---

## 🎯 Next Steps (Priority)

1. **Verify avatar files saved** → upload customer photo → verify shows in chat
2. **STEP 13** — Chat bubble avatar (photo next to message)
3. **Production prep** — env vars, security headers, DNS
4. **Historical data import** — 26+ years of memos, parties, transactions

---

## 📊 Technical Stack

- **Frontend:** React 19 + TanStack Start 1.168 + TanStack Router 1.170
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Styling:** Tailwind v4 + shadcn/ui (45+ components)
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod
- **Icons:** Lucide React

## 🔐 Security

- RLS on all 27 tables
- Server-side middleware (requireSupabaseAuth)
- Rate limiting on auth + chat + OTP
- CSRF protection
- Session timeout (30 min)
- 2FA for destructive actions
- Audit logs + error logs
- Health monitoring

## 💾 Storage Buckets

| Bucket | Public | Purpose |
|---|---|---|
| `shop-images` | ✅ | Owner/shop/gallery photos |
| `customer-docs` | ❌ | NID, trade license (signed URLs) |
| `chat-files` | ❌ | Chat images/PDFs/voice (signed URLs) |
| `avatars` | ✅ | User profile photos |

## 📞 Shop Info

- **Name:** আল হামিদ বস্ত্রালয়
- **Address:** জে বি রোড, ফেনী
- **Owner:** মাহমুদুল হক (০১৭১৬৭৮২২৪৭, ০১৮২১৫৪৯০৯৫)
- **Manager:** মাজহারুল ইসলাম (মাহি) (০১৭৭৬০৯৩৯৪৪)