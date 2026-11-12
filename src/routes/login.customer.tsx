import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/shop/LoginPage";

export const Route = createFileRoute("/login/customer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "কাস্টমার লগইন — আল হামিদ বস্ত্রালয়" },
      { name: "description", content: "সিরিয়াল, মোবাইল ও পাসওয়ার্ড দিয়ে নিজের হিসাব দেখুন।" },
      { property: "og:title", content: "কাস্টমার লগইন — আল হামিদ বস্ত্রালয়" },
      { property: "og:description", content: "কাস্টমারদের নিজস্ব হিসাব দেখার লগইন।" },
    ],
  }),
  component: () => <LoginPage mode="customer" />,
});