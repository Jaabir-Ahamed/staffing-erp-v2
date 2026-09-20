import { LoginForm } from "@/src/features/auth/ui/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-md border border-border p-6">
        <div>
          <h1 className="type-page">StaffHub</h1>
          <p className="type-meta mt-1">
            Sign in with the account an admin created for you. There is no public registration.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
