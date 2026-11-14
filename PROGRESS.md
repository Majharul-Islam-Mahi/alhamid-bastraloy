# আল হামিদ বস্ত্রালয় — Development Progress

**Last Updated:** 2026-11-14
**Current Version:** v1.6
**Dev Server:** `npm run dev` → http://localhost:8080
**Supabase Project:** koqgvrgoyxdfezaomlzq

---

## ✅ Completed Steps (1-13)

### STEP 1-2: Database & Types
- ✅ 27 tables + RPCs (categories, areas, chat_messages, etc.)
- ✅ `types.ts` regenerated (includes `avatar_path`, `duration_seconds`)

### STEP 3-6: Core Fixes
- ✅ TypeScript strictness fixed (0 errors)
- ✅ Runtime bugs (Session timeout → 8 hours, Vite HMR fixes)
- ✅ Transaction safety (Memo, Collection save with rollback)
- ✅ Security patches (Password reset enumeration fix, RLS)

### STEP 7-10: Performance & UX
- ✅ N+1 query fixes (`partiesDueBatch` - 2 queries instead of 300)
- ✅ Collection History pagination (200-item chunks)
- ✅ Notice Popup auto-dismiss fix
- ✅ BackButton, Stock inline edit, Dashboard threshold fixes
- ✅ Area names corrected (16 areas)

### STEP 11: Voice Messages 🎤
- ✅ DB: `duration_seconds` column + `voice` message_type
- ✅ `ChatVoiceRecorder` (MediaRecorder API, 2-min max, cancel)
- ✅ `ChatBubble` Waveform Player
- ✅ Storage: `chat-files` bucket uploads

### STEP 12: User Avatar System 🎨
- ✅ DB: `profiles.avatar_path` + `avatars` bucket + RLS
- ✅ `UserAvatar` + `AvatarUploader` (HD upload, 10MB, change, remove)
- ✅ Customer self-service avatar in `/account`
- ✅ Admin can change anyone's avatar in `/admin/users`
- ✅ Avatars visible in Chat List & Chat Header

### STEP 12B & 13: WhatsApp Polish ✨
- ✅ **3-State Ticks (Custom SVG)**: 
  - ✓ Single Grey (Sent)
  - ✓✓ Double Grey (Delivered)
  - ✓✓ Double Blue (Seen)
- ✅ **Chat Bubble Avatars**: Small avatar next to incoming messages.
- ✅ **Voice Play = Seen**: Voice message play করলে automatically Blue tick (seen) হয়ে যায়।
- ✅ **Avatar F5 Fix**: Page refresh করলেও অ্যাভাটার হারায় না (useEffect sync)।

---

## 🔜 Pending / Next Steps

- [ ] **Production Deployment (Vercel)** — latest code sync & test
- [ ] **Bulk import old data** — CSV templates + test data (26 years of memos/parties)
- [ ] **Custom Domain setup** (e.g., alhamidbastraloy.com)
- [ ] **OTP Channel Upgrade** — Demo থেকে WhatsApp Business API বা SSL Wireless SMS-এ আপগ্রেড করা।

---

## 📊 Technical Stack

- **Frontend:** React 19 + TanStack Start 1.168 + TanStack Router 1.170
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Styling:** Tailwind v4 + shadcn/ui
- **Icons:** Lucide React + Custom SVG (WhatsApp ticks)

## 🔐 Security

- RLS on all 27 tables
- Server-side middleware (`requireSupabaseAuth`)
- Rate limiting (login, chat, OTP)
- 8-hour inactivity logout
- Audit logs + Error logs

## 💾 Storage Buckets

| Bucket | Public | Purpose |
|---|---|---|
| `shop-images` | ✅ | Owner/shop/gallery photos |
| `customer-docs` | ❌ | NID, trade license |
| `chat-files` | ❌ | Chat images/PDFs/voice |
| `avatars` | ✅ | User profile photos |

## 📞 Shop Info

- **Name:** আল হামিদ বস্ত্রালয়
- **Address:** জে বি রোড, ফেনী
- **Owner:** মাহমুদুল হক
- **Manager:** মাজহারুল ইসলাম (মাহি)