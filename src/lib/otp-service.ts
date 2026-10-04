// src/lib/otp-service.ts
// OTP পাঠানোর সার্ভিস — একাধিক চ্যানেল সাপোর্ট করে
//
// চ্যানেল পরিবর্তন করতে .env এ সেট করুন:
//   OTP_CHANNEL="demo"        → শুধু স্ক্রিনে দেখাবে (ডেভেলপমেন্ট)
//   OTP_CHANNEL="console"     → সার্ভার কনসোল লগে দেখাবে
//   OTP_CHANNEL="whatsapp"    → WhatsApp Cloud API (Meta)
//   OTP_CHANNEL="sms_ssl"     → SSL Wireless (বাংলাদেশ)
//   OTP_CHANNEL="sms_bulkbd"  → Bulk SMS BD (বাংলাদেশ)

export type OtpChannel =
  | "demo"
  | "console"
  | "whatsapp"
  | "sms_ssl"
  | "sms_bulkbd";

export type OtpSendResult = {
  ok: boolean;
  channel: OtpChannel;
  /** শুধু demo / console mode-এ থাকে, প্রোডাকশনে হবে না */
  demoCode?: string;
  error?: string;
};

export function currentChannel(): OtpChannel {
  return (process.env["OTP_CHANNEL"] ?? "demo") as OtpChannel;
}

/**
 * একটি mobile নাম্বারে OTP পাঠায়।
 * মোবাইল নাম্বার already normalized (digits only, e.g. "01716782247")।
 */
export async function sendOtp(
  mobile: string,
  code: string,
): Promise<OtpSendResult> {
  const channel = currentChannel();

  switch (channel) {
    case "demo":
      // ডেভেলপমেন্ট: কোড সরাসরি response-এ ফেরত দিই, স্ক্রিনে দেখানো হবে
      return { ok: true, channel, demoCode: code };

    case "console":
      // সার্ভার কনসোলে প্রিন্ট
      console.log(`[OTP] → ${mobile}: ${code}`);
      return { ok: true, channel, demoCode: code };

    case "whatsapp":
      return await sendViaWhatsApp(mobile, code);

    case "sms_ssl":
      return await sendViaSslWireless(mobile, code);

    case "sms_bulkbd":
      return await sendViaBulkSmsBd(mobile, code);

    default:
      return { ok: false, channel, error: "Unknown channel" };
  }
}

// ---------- WhatsApp Cloud API (Meta) ----------
async function sendViaWhatsApp(
  mobile: string,
  code: string,
): Promise<OtpSendResult> {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_ID"];

  if (!token || !phoneId) {
    return {
      ok: false,
      channel: "whatsapp",
      error: "WhatsApp token / phone id missing",
    };
  }

  // বাংলাদেশে mobile নাম্বার আন্তর্জাতিক format-এ পাঠাতে হয় (88 prefix)
  const to = mobile.startsWith("88") ? mobile : `88${mobile}`;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: "otp_verification", // Meta-তে আগেই template বানাতে হবে
            language: { code: "bn" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: code }],
              },
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        channel: "whatsapp",
        error: `WhatsApp API ${res.status}: ${body}`,
      };
    }

    return { ok: true, channel: "whatsapp" };
  } catch (e) {
    return { ok: false, channel: "whatsapp", error: (e as Error).message };
  }
}

// ---------- SSL Wireless (বাংলাদেশ) ----------
async function sendViaSslWireless(
  mobile: string,
  code: string,
): Promise<OtpSendResult> {
  const apiKey = process.env["SSL_WIRELESS_API_KEY"];
  const sid = process.env["SSL_WIRELESS_SID"];
  const senderId = process.env["SSL_WIRELESS_SENDER_ID"] ?? "ALHAMID";

  if (!apiKey || !sid) {
    return {
      ok: false,
      channel: "sms_ssl",
      error: "SSL Wireless credentials missing",
    };
  }

  const message = `আপনার OTP কোড: ${code}। ৫ মিনিটের মধ্যে ব্যবহার করুন। — আল হামিদ বস্ত্রালয়`;

  try {
    const url = new URL("https://smsplus.sslwireless.com/api/v3/send-sms");
    url.searchParams.set("api_token", apiKey);
    url.searchParams.set("sid", sid);
    url.searchParams.set("sms", message);
    url.searchParams.set("msisdn", mobile.startsWith("88") ? mobile : `88${mobile}`);
    url.searchParams.set("csms_id", `otp-${Date.now()}`);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      return { ok: false, channel: "sms_ssl", error: `SSL ${res.status}` };
    }
    return { ok: true, channel: "sms_ssl" };
  } catch (e) {
    return { ok: false, channel: "sms_ssl", error: (e as Error).message };
  }
}

// ---------- Bulk SMS BD ----------
async function sendViaBulkSmsBd(
  mobile: string,
  code: string,
): Promise<OtpSendResult> {
  const apiKey = process.env["BULKSMSBD_API_KEY"];
  const senderId = process.env["BULKSMSBD_SENDER_ID"] ?? "ALHAMID";

  if (!apiKey) {
    return {
      ok: false,
      channel: "sms_bulkbd",
      error: "Bulk SMS BD credentials missing",
    };
  }

  const message = `আপনার OTP কোড: ${code}। ৫ মিনিটের মধ্যে ব্যবহার করুন।`;
  const to = mobile.startsWith("88") ? mobile : `88${mobile}`;

  try {
    const url = new URL("http://bulksmsbd.net/api/smsapi");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("type", "text");
    url.searchParams.set("number", to);
    url.searchParams.set("senderid", senderId);
    url.searchParams.set("message", message);

    const res = await fetch(url.toString());
    if (!res.ok) {
      return { ok: false, channel: "sms_bulkbd", error: `BulkSMS ${res.status}` };
    }
    return { ok: true, channel: "sms_bulkbd" };
  } catch (e) {
    return { ok: false, channel: "sms_bulkbd", error: (e as Error).message };
  }
}