# আল হামিদ বস্ত্রালয় — Development Progress

## 🎯 Project Info

- **App:** আল হামিদ বস্ত্রালয় ম্যানেজমেন্ট সিস্টেম
- **Stack:** TanStack Start + React 19 + Drizzle + Supabase (Postgres) + Tailwind v4
- **GitHub:** https://github.com/Majharul-Islam-Mahi/alhamid-bastraloy
- **Local path:** C:\Users\Hamid\OneDrive\Desktop\Al Hamid Bostraloy.Ai
- **Dev server:** `npm run dev` → http://localhost:8080
- **Last updated:** 2026-10-08
- **Current version:** v1.4

---

## 📌 Working Rules (এই Chat এর জন্য)

1. **"OK" না বলা পর্যন্ত নতুন কাজ শুরু করবো না**
2. **সবসময় full code দেবো** — partial / `...` / `// rest` না
3. **User বাংলায় কথা বলবে, AI বাংলায় উত্তর দেবে**
4. **Security issue হলে সাথে সাথে জানাতে হবে**
5. **Secrets কখনো chat-এ দেখানো যাবে না**
6. **একবারে এক command** — Terminal-এ paste করার পর Enter, output দেখে পরেরটা
7. **Code terminal-এ paste করা যাবে না** — শুধু VS Code-এ
8. **Trigger words:**
   - `maher` → Production Deploy
   - `next` → পরের কাজ
   - `update` → Progress file update
   - `test` → QA checklist

---

## ✅ যা যা হয়ে গেছে (DONE)

### Security (v1.0)

- [x] **Rate Limiting** — login/OTP brute force protection
- [x] **Git security fix** — .env removed from tracking
- [x] **Secrets rotated** — Supabase service_role + DB password
- [x] **Session Timeout** — 30 min inactivity auto logout
- [x] **CSRF Middleware** — server functions protected
- [x] **2FA for Destructive** — password reset এ OTP verify
- [x] **Audit Log** — sensitive actions track
- [x] **Error Tracking** — global handlers + UI + `/admin/error-logs`

### Back Button (v1.0)

- [x] **28 pages এ Back button** — সব admin + customer pages

### Base Features (v1.0)

- [x] **Health Check endpoint** — `/api/health`
- [x] **Uptime Monitoring UI** — `/admin/uptime`
- [x] **Report System** — customer → admin (full flow + badge)
- [x] **Low Stock Alert** — threshold configurable, dashboard widget
- [x] **PWA Manifest + SW** — mobile install ready
- [x] **Icons** — 4 PNG icons (816×816)
- [x] **Homepage SSR fix** — `ssr: false`
- [x] **Pending Memo** — একাধিক draft memo
- [x] **Paona Add button** — retail customer serial (`R001`)
- [x] **Footer** — copyright on all pages
- [x] **404/Error Page** — Bengali error pages
- [x] **Login History** — `/admin/audit-logs` এ login entries

### Chat System (v1.1 → v1.3)

- [x] **Chat Backend** — `chat_messages` table + `chat.functions.ts` (11 functions)
- [x] **Customer ↔ Admin chat** — text only
- [x] **Admin conversation list** — unread badges + search
- [x] **New Chat initiate** — admin → customer
- [x] **Sound notification** — Web Audio API (browser-based)
- [x] **Chat unread badge** — SiteHeader + AdminLayout + Dashboard
- [x] **Rate limiting** — 30 msg/5min customer, 60 msg/5min admin
- [x] **WhatsApp-style UI** — coffee theme, cream beige BG, bubble tails
- [x] **3-Tick Status** — ✓ sent / ✓✓ delivered / ✓✓✓ seen (cyan)
- [x] **Message Info Panel** — tap time → Sent/Delivered/Read timeline
- [x] **File/Image Attachment** — 10 MB limit, inline preview, PDF download card
- [x] **Voice Call Entry** — "📞 Voice call · No answer" centered pill
- [x] **Date Divider** — "আজ" / "গতকাল" / full date
- [x] **Online Indicator** — green "● অনলাইন" in header

### Stock Management (v1.1 → v1.2)

- [x] **Category + Subcategory** — tree structure (parent → child)
- [x] **Unit Conversion** — per product (থান, গজ, ডজন)
- [x] **Stock History Modal** — in/out movements + manual restock
- [x] **Low stock threshold** — per-browser localStorage
- [x] **Migrate Tool** — old products এ category distribution
- [x] **Bulk Category Assign Modal** — multiple products একসাথে

### Customer Documents (v1.1)

- [x] **NID front/back upload** — Supabase Storage `customer-docs`
- [x] **Trade license, TIN, Other** — 5 doc types
- [x] **Signed URLs** — 1-hour expiry (privacy)
- [x] **Staff-only access** — RLS + server checks
- [x] **5 MB limit per file** — JPG/PNG/WebP/PDF

### Bulk Import (v1.1)

- [x] **CSV Import** — parties, memos, day_entries, supplier, hawlat
- [x] **Template download** — with sample data
- [x] **Import sessions** — track history + rollback support
- [x] **Chunked inserts** — 100 rows per batch
- [x] **Error reporting** — per-row error list

### Reports (v1.1 → v1.2)

- [x] **Supplier Report** — top 10 ক্রয় + top 10 দেনা + summary
- [x] **Collection Report** — top 10 কালেকশনকারী + এলাকা-ভিত্তিক
- [x] **Monthly P&L** — শেষ ১২ মাসের লাভ-ক্ষতি (আয় vs খরচ + bar chart + CSV)
- [x] **Dead Stock Report** — যেসব পণ্য অনেক দিন বিক্রি হয়নি (৩০/৬০/৯০/১৮০ দিন)
- [x] **6+ CSV exports** — সব section এ

### UI/UX Polish (v1.2 → v1.4)

- [x] **Party memo list** — pending/confirmed split (memo.index pattern)
- [x] **Customer account memo list** — pending alert + M badge cards
- [x] **WhatsApp-style chat banner** — green when unread, big avatar, arrow indicator
- [x] **Reports page** — সব section একসাথে (P&L, Dead Stock, Supplier, Collection)

### WhatsApp Memo Share (v1.2)

- [x] **One-click share** — memo page থেকে
- [x] **Bengali formatted text preview**
- [x] **WhatsApp / SMS / Copy** buttons
- [x] **Auto 88 prefix** for BD numbers
- [x] **Mobile-missing warning**

### Route Rename Fix (v1.4)

- [x] **account.messages.tsx → account_.messages.tsx** — sibling route (was child route not rendering)
- [x] **account.memo.$id.tsx → account_.memo.$id.tsx** — same fix
- [x] **account.tsx full rewrite** — WhatsApp chat banner + memo polish
- [x] **ssr: false** added to both message routes

### Postponed / Rejected

- [ ] **Security Headers** — production deploy এ যোগ করতে হবে
- [ ] **Login History UI (dedicated)** — optional
- ❌ **E2E Encryption** — REJECTED (business model-এ কাজ করবে না — admin কে সব message দেখতে হবে)
- ❌ **Auto-greeting (morning/admin)** — REJECTED (user এর চাহিদা ছিল না)

---

## 📋 Project Structure

### Config files

- `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- `eslint.config.js`, `drizzle.config.ts`, `.prettierrc`, `components.json`
- `.env` (git-এ নেই), `.gitignore` (fixed)

### Database (Supabase) — alhamid (koqgvrgoyxdfezaomlzq)

**Tables (30+):**

- Core: profiles, user_roles, parties, products, shop_settings
- Khata: day_entries, hawlat_entries, supplier_entries
- Memo: memos, memo_items
- Auth: otp_codes, login_logs
- Admin: areas, collections, collection_items, events, notices
- Security: rate_limits, audit_logs, error_logs, uptime_checks
- Reports: reports
- Chat: chat_messages
- Stock: categories, stock_movements
- Docs: customer_documents
- Import: import_sessions

**Functions:**

- `confirm_memo`, `day_summary`, `has_role`, `is_staff`
- `cleanup_rate_limits`, `cleanup_error_logs`, `cleanup_uptime_checks`
- `reports_set_updated_at`

### Storage Buckets

- `shop-images` — owner/shop/gallery photos
- `customer-docs` — NID, trade license, TIN (private)
- `chat-files` — chat file/image attachments (private)

### Public assets

- `favicon.ico`, `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png`
- `manifest.webmanifest`, `sw.js`, `robots.txt`, `sitemap.xml`

### Routes (৩৫+)

- Root: `__root.tsx`, `_authenticated/route.tsx`
- Public: `index.tsx`, `setup.tsx`, `login.{admin,customer,forgot}.tsx`
- Admin (24): `admin.{index,collection,khata,memo,stock,wholesale,paona,dena,party,users,areas,calendar,calculator,cash,reports,reports-list,audit-logs,error-logs,uptime,settings,halkhata,categories,import,migrate}.tsx`
- Customer: `account.tsx`, `account_.messages.tsx`, `account_.memo.$id.tsx`
- API: `api/health.ts`

### Components (custom)

- Shop: `BackButton`, `Footer`, `SiteHeader`, `LoginForm`, `LoginPage`, `PWAInstallPrompt`
- Admin: `LiveWidgets`, `NoticePopup`, `SalesChart`, `ReportsWidget`, `LowStockWidget`, `DestructiveOtpDialog`, `DocumentSection`, `UnitSettingsModal`, `StockHistoryModal`, `BulkCategoryAssignModal`, `SupplierCollectionReports`, `ProfitLossSection`, `DeadStockSection`, `MemoShareDialog`
- Customer: `NoticeBanner`, `ReportButton`
- Khata: `EntryColumn`, `HawlatPanel`, `StatementHeader`
- Chat: `ChatBubble`, `ChatInput`
- UI: ৪৫+ shadcn

### Hooks

- `use-me.ts`, `use-mobile.ts`, `use-shop-settings.ts`, `use-session-timeout.ts`
- `use-chat-notification.ts`, `use-keyboard-shortcuts.ts`

---

## 🐛 Fixed Bugs (সব সেশনে)

1. ✅ Session timeout double-init
2. ✅ BackButton `router.history.back()` → safer `window.history.back()`
3. ✅ Native `confirm()` replaced with `useConfirm`
4. ✅ `window.location.href` replaced with `navigate`
5. ✅ `__testLogError()` dev-only
6. ✅ `audit-log.server.ts` client import fixed
7. ✅ Party page memo list — uniform card pattern
8. ✅ Reports page — supplier + collection data
9. ✅ Stock page — bulk category assign modal
10. ✅ Account page memo list — pending/confirmed split
11. ✅ **account.messages.tsx → account_.messages.tsx** (child route nesting bug)
12. ✅ **account.memo.$id.tsx → account_.memo.$id.tsx** (same)
13. ✅ **ssr: false** added to messages routes (SSR abort error fixed)

---

## 🔧 Known Issues / Decisions

- **Security Headers:** dev এ Vite HMR conflict, production এ যোগ করতে হবে
- **`inputValidator` → `validator`:** TanStack Start 1.168+ এ deprecated (fixed)
- **Node version:** >= 22.12.0
- **Icons:** 816×816 same image copy (perfect resize না)
- **Server-only files:** `*.server.ts`
- **Homepage:** `ssr: false` (CSR only)
- **Dev server port:** 8080
- **Chat notifications:** Web Audio API (no external file)
- **Supplier/Collection reports:** `as any` cast for categories (Supabase types mismatch)
- **Dead Stock:** 5-minute refetch interval, cutoff via date string comparison
- **WhatsApp share:** `wa.me` link opens app on mobile, browser on desktop
- **Route rename pattern:** `account_.messages.tsx` → URL `/account/messages` (underscore = sibling route)
- **types.ts manually updated:** `chat_messages` has new columns (message_type, call_status, file_path, file_name, file_size, mime_type, delivered_at)

---

## 📞 Shop Information

- **দোকান:** আল হামিদ বস্ত্রালয়
- **মালিক:** মাহমুদুল হক (০১৭১৬৭৮২২৪৭, ০১৮২১৫৪৯০৯৫)
- **ম্যানেজার:** মাজহারুল ইসলাম (মাহি) (০১৭৭৬০৯৩৯৪৪)
- **ঠিকানা:** জে বি রোড, ফেনী

---

## 🎯 Next Steps (কাজ বাকি)

### Priority 3 — Production (Trigger: `maher`)

6. **Vercel deploy + Custom domain**
7. **Security Headers** — production এ যোগ করতে হবে
8. **UptimeRobot setup**
9. **OTP channel** (WhatsApp Business API)

### WhatsApp Business API Setup (চলমান)

- [ ] Meta Business Account (`Al Hamid Bastraloy`)
- [ ] WhatsApp Business API App (`Al Hamid OTP`)
- [ ] Phone verify: `01821549095` (⚠️ personal WhatsApp-এ থাকলে আগে delete)
- [ ] Message Template: `alhamid_otp` (Bengali, Authentication category)
- [ ] Permanent Token generate
- [ ] `.env` update (5 variables)
- [ ] Test OTP

### Priority 4 — Next Version (v1.5 suggestion)

10. **Typing indicator** (chat)
11. **Voice message** (recording UI)
12. **Reply to message**
13. **Search in chat**
14. **Product-wise Profit Margin** (reports)
15. **Customer dashboard analytics** — monthly trends

### Priority 5 — Old Data (still pending)

16. **Historical Memo Storage** — পুরাতন মেমোর ছবি/PDF attach
17. **Old data entry** — 2000-2026 এর ডাটা (bulk import tool আছে, data import হয়নি)

---

## 📅 Version History

| Version | Date | Features |
|---|---|---|
| **v1.0** | 2026-10-05 | Security, memo, khata, stock, customer portal |
| **v1.1** | 2026-10-06 | Chat, Documents, Bulk Import, Migrate, Supplier/Collection reports |
| **v1.2** | 2026-10-07 | Party/Account memo polish, Bulk category modal, P&L, Dead Stock, WhatsApp share |
| **v1.3** | 2026-10-08 | Chat Stage 2 (file/image, WhatsApp UI, 3-tick, Message info, Call entries) |
| **v1.4** | 2026-10-08 | Route rename fix (account_.messages), ssr: false, chat banner polish |
| **v2.0** (planned) | TBD | Production deploy (Vercel + Security Headers + UptimeRobot + WhatsApp OTP) |

---

## 📝 Latest Session Notes (2026-10-08)

### Fixed
- Route nesting bug: `account.messages.tsx` was child of `account.tsx`, needed `<Outlet />`. Fixed by renaming to `account_.messages.tsx` (sibling).
- Same fix for `account.memo.$id.tsx` → `account_.memo.$id.tsx`
- `ssr: false` added to both chat routes (SSR abort error)
- `types.ts` updated with chat_messages new columns

### Rejected
- E2E Encryption (WhatsApp-level) — admin visibility requires server-readable messages
- Auto-greeting (morning/admin) — removed after user feedback

### Pending
- WhatsApp Business API setup (user করছেন)
- Template approval (Meta review এর অপেক্ষায়)

### Important URLs
- Dev: `http://localhost:8080`
- Supabase Dashboard: `https://supabase.com/dashboard/project/koqgvrgoyxdfezaomlzq`
- GitHub: `https://github.com/Majharul-Islam-Mahi/alhamid-bastraloy`
- Meta Business: `https://business.facebook.com`

---

## 🎯 Current Focus (Next Action)

**WhatsApp Business API Setup (OTP)** — user এই মুহূর্তে Meta-তে account খুলছেন।

**পরের step:** Meta account তৈরি হওয়ার পর amake জানাবেন — আমি 다음 step guide করব।