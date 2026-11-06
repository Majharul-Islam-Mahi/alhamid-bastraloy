// src/lib/audit-labels.ts
// Audit action এর Bengali labels ও colors — client ও server উভয় জায়গায় ব্যবহারযোগ্য

export const ACTION_LABEL: Record<string, string> = {
  "user.create": "নতুন ইউজার তৈরি",
  "user.password_reset": "পাসওয়ার্ড পরিবর্তন",
  "user.delete": "ইউজার মুছে ফেলা",
  "party.create": "নতুন পার্টি তৈরি",
  "party.update": "পার্টি আপডেট",
  "party.delete": "পার্টি মুছে ফেলা",
  "memo.confirm": "মেমো কনফার্ম",
  "memo.void": "মেমো বাতিল",
  "product.create": "নতুন পণ্য যোগ",
  "product.update": "পণ্য আপডেট",
  "product.delete": "পণ্য মুছে ফেলা",
  "report.update": "রিপোর্ট আপডেট",
  "settings.update": "সেটিংস আপডেট",
  "backup.download": "ডাটা ব্যাকআপ ডাউনলোড",
  "auth.login": "লগইন",
  "auth.logout": "লগআউট",
  "auth.failed_login": "ব্যর্থ লগইন চেষ্টা",
};

export const ACTION_COLOR: Record<string, string> = {
  "user.create": "text-success",
  "user.password_reset": "text-accent",
  "user.delete": "text-destructive",
  "party.create": "text-success",
  "party.update": "text-accent",
  "party.delete": "text-destructive",
  "memo.confirm": "text-success",
  "memo.void": "text-destructive",
  "product.create": "text-success",
  "product.update": "text-accent",
  "product.delete": "text-destructive",
  "report.update": "text-accent",
  "settings.update": "text-accent",
  "backup.download": "text-primary",
  "auth.login": "text-success",
  "auth.logout": "text-muted-foreground",
  "auth.failed_login": "text-destructive",
};
