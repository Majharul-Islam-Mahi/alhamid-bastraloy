// src/lib/error-page.ts
// SSR-এ ক্র্যাশ হলে সার্ভার থেকে এই HTML পাঠানো হবে।

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>সমস্যা হয়েছে — আল হামিদ বস্ত্রালয়</title>
<style>
  body {
    font-family: system-ui, -apple-system, "Hind Siliguri", sans-serif;
    background: #f5efe6;
    color: #3a2318;
    display: grid;
    place-items: center;
    min-height: 100vh;
    margin: 0;
    padding: 24px;
  }
  .card {
    max-width: 480px;
    background: #fdfaf5;
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 12px 24px -16px rgba(58, 35, 24, 0.4);
    text-align: center;
    border: 1px solid #e5d9c9;
  }
  h1 { font-size: 26px; margin: 0 0 8px; color: #4a2f1e; }
  p { color: #7a6558; margin: 0 0 20px; line-height: 1.6; }
  a {
    display: inline-block;
    background: linear-gradient(135deg, #4a2f1e, #6b4226);
    color: #fdfaf5;
    padding: 10px 22px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
  }
  a:hover { filter: brightness(1.1); }
</style>
</head>
<body>
  <div class="card">
    <h1>দুঃখিত, সমস্যা হয়েছে</h1>
    <p>সার্ভারে একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।</p>
    <a href="/">হোমে ফিরুন</a>
  </div>
</body>
</html>`;
}
