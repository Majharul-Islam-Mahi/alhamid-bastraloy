# OTP সেটআপ গাইড — আল হামিদ বস্ত্রালয়

এই ডকুমেন্টে তিনটি OTP চ্যানেলের সেটআপ ধাপে ধাপে দেওয়া আছে।
আপনি যেকোনো একটা বেছে নিতে পারেন। শুরুতে **demo** রাখুন, তারপর যেটা কিনতে পারেন সেটা সেট করুন।

---

## 🟢 চ্যানেল ১: Demo Mode (এখনি কাজ করবে)

এই মুহূর্তে কিছুই করতে হবে না। `.env` এ:

```env
OTP_CHANNEL="demo"
```

এই মোডে OTP কোড লগইন স্ক্রিনেই দেখাবে (বড় হরফে)। প্রোডাকশনে যাওয়ার আগে এটা পরিবর্তন করে দিবেন।

---

## 🟢 চ্যানেল ২: WhatsApp Cloud API (Meta) — ফ্রি ১০০০/মাস

### ধাপ ১ — Business Account তৈরি

1. যান: https://business.facebook.com/
2. **Create account** → ব্যবসার নাম: "Al Hamid Bastraloy"
3. নাম, ইমেইল, ফোন দিয়ে verify করুন

### ধাপ ২ — WhatsApp Business API অ্যাক্সেস

1. যান: https://developers.facebook.com/apps/
2. **Create App** → ধরন: **Business**
3. App নাম: "Al Hamid OTP"
4. Dashboard → **Add Product** → **WhatsApp** → **Set Up**

### ধাপ ৩ — Phone Number যোগ

1. WhatsApp → **API Setup** → **Add phone number**
2. একটা ব্যবসায়িক ফোন নাম্বার দিন (আলাদা WhatsApp নাম্বার, আপনার নিজের নাম্বার হতে পারে — তবে ওই নাম্বারে আগে থেকেই WhatsApp থাকলে সেটা delete করে দিতে হবে)
3. Meta একটা verification কোড পাঠাবে — সেটা confirm করুন

### ধাপ ৪ — Phone Number ID ও Token সংগ্রহ

1. API Setup পেজে থাকবেন
2. **Temporary access token** দেখবেন — সেটা কপি করুন (২৪ ঘণ্টার জন্য valid)
3. **Phone number ID** — সেটা কপি করুন
4. **Permanent token** এর জন্য:
   - Business Settings → Users → System Users → **Add**
   - Role: **Admin**
   - **Generate New Token** → App: "Al Hamid OTP" → Permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Token কপি করুন (এই টোকেন আর কখনো পুরোটা দেখা যাবে না — save করে রাখুন)

### ধাপ ৫ — Message Template তৈরি

Meta-র rules অনুযায়ী OTP পাঠাতে একটা pre-approved template লাগে।

1. WhatsApp → **Message Templates** → **Create Template**
2. তথ্য:
   - **Category**: Authentication
   - **Name**: `otp_verification`
   - **Language**: `Bengali (bn)`
   - **Body**:
     ```
     আপনার OTP কোড: {{1}}
     ৫ মিনিটের মধ্যে ব্যবহার করুন।
     — আল হামিদ বস্ত্রালয়
     ```
   - **Button**: Copy Code (recommended)
3. Submit → Meta review করে (সাধারণত কয়েক ঘণ্টা থেকে ২৪ ঘণ্টা)

### ধাপ ৬ — `.env` এ বসান

```env
OTP_CHANNEL="whatsapp"
WHATSAPP_TOKEN="EAAG... (permanent token)"
WHATSAPP_PHONE_ID="1234567890"
WHATSAPP_TEMPLATE_NAME="otp_verification"
WHATSAPP_TEMPLATE_LANG="bn"
```

### ধাপ ৭ — Restart ও Test

```sh
npm run dev
```

এখন `/login/admin`-এ লগইন করার সময় আপনার WhatsApp-এ OTP আসবে।

### 💰 খরচ

- মাসে প্রথম ১০০০ conversation ফ্রি
- তারপর প্রতি conversation ~$0.03 (প্রায় ৩.৫ টাকা)

### ⚠️ সমস্যা

- Template approve না হলে OTP আসবে না
- Token মেয়াদ শেষ হলে আবার generate করতে হবে (permanent token নিলে সমস্যা নেই)

---

## 🟢 চ্যানেল ৩: SMS (বাংলাদেশ) — সবচেয়ে নির্ভরযোগ্য

দুইটা জনপ্রিয় প্রোভাইডার:

### Option ৩ক — Bulk SMS BD (সস্তা, সহজ)

1. যান: https://bulksmsbd.net/
2. Sign up (নাম, মোবাইল, ইমেইল)
3. Login → **Dashboard** → **API Key** কপি করুন
4. **Sender ID** এর জন্য:
   - নতুন Sender ID request করুন: "ALHAMID"
   - Approval ৩-৪ ঘণ্টা সময় নেয়
5. `.env` এ বসান:

```env
OTP_CHANNEL="sms_bulkbd"
BULKSMSBD_API_KEY="your-api-key-here"
BULKSMSBD_SENDER_ID="ALHAMID"
```

### খরচ

- প্রায় ০.৩০-০.৩৫ টাকা / SMS
- মাসে ২০০ OTP → ~৭০ টাকা

### Option ৩খ — SSL Wireless (বড়, নির্ভরযোগ্য)

1. যান: https://www.sslwireless.com/
2. Contact → "SMS Plus" অ্যাকাউন্ট খুলতে বলুন
3. Minimum ৫০০০ টাকা deposit করতে হয়
4. SID + API Token পাবেন
5. `.env` এ বসান:

```env
OTP_CHANNEL="sms_ssl"
SSL_WIRELESS_API_KEY="your-api-key"
SSL_WIRELESS_SID="your-sid"
SSL_WIRELESS_SENDER_ID="ALHAMID"
```

### খরচ

- প্রায় ০.৩৫-০.৪০ টাকা / SMS
- মাসে ২০০ OTP → ~৮০ টাকা

---

## 🔄 প্রোভাইডার পরিবর্তন

`.env` এ শুধু `OTP_CHANNEL` পরিবর্তন করে সার্ভার restart করুন। কোডে কিছুই বদলাতে হবে না।

---

## 🛡️ প্রোডাকশনে যাওয়ার আগে চেকলিস্ট

- [ ] `OTP_CHANNEL="demo"` থেকে অন্য কোনো চ্যানেলে পরিবর্তন করা হয়েছে
- [ ] সব credentials `.env` এ সেট আছে
- [ ] `.env` file `.gitignore`-এ আছে (git-এ যাচ্ছে না)
- [ ] একটা test নম্বরে OTP পাঠিয়ে verify করা হয়েছে
- [ ] ৫ মিনিটের timeout কাজ করছে
- [ ] ভুল কোড দিলে error দেখাচ্ছে
- [ ] OTP মেয়াদোত্তীর্ণ হলে error দেখাচ্ছে

---

## ❓ সমস্যা হলে

**WhatsApp-এ OTP আসছে না:**

- Template approve হয়েছে কিনা দেখুন (Meta Business Manager → Message Templates)
- Token মেয়াদোত্তীর্ণ কিনা চেক করুন
- Phone number verified কিনা দেখুন

**SMS আসছে না:**

- Sender ID approve হয়েছে কিনা দেখুন
- API key সঠিক কিনা verify করুন
- প্রোভাইডারের dashboard-এ SMS log দেখুন

**Console-এ error দেখছেন:**

- `.env` file-এর মানে extra space আছে কিনা দেখুন
- Server restart করেছেন কিনা দেখুন (`npm run dev`)
