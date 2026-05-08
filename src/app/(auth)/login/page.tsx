import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.callbackUrl ?? "/dashboard");

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-roxa-50 via-white to-slate-100 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-roxa-700 grid place-items-center text-white font-bold text-lg">
            C
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 leading-tight">Casa Roxa</p>
            <p className="text-xs text-slate-500 leading-tight">Gestão</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use suas credenciais para acessar o sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm callbackUrl={params.callbackUrl} initialError={params.error} />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-slate-600">
            ← voltar
          </Link>
        </p>
      </div>
    </main>
  );
}
