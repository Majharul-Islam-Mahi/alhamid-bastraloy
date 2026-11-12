import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/shop/LoginPage";

export const Route = createFileRoute("/login/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "অ্যাডমিন লগইন — আল হামিদ বস্ত্রালয়" },
      { name: "description", content: "মালিক ও এডমিনদের জন্য নিরাপদ দুই ধাপের লগইন।" },
    ],
  }),
  component: () => <LoginPage mode="staff" />,
});