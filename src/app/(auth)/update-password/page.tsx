import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Update Password" };

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="update" />
    </Suspense>
  );
}
