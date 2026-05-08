// Diagnóstico rápido: o usuário admin foi seedado? A senha bate?
// Uso: node --env-file=.env scripts/check-admin.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@casaroxa.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "casa-roxa-2026";

  console.log("DATABASE_URL:", process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":****@"));
  console.log("Email a procurar:", email);
  console.log("Senha esperada:", password);

  try {
    const count = await prisma.user.count();
    console.log("\n✓ Conexão OK. Total de usuários no banco:", count);
  } catch (e) {
    console.error("\n✖ Não consegui conectar ao banco:", e.message);
    process.exit(1);
  }

  const all = await prisma.user.findMany({ select: { email: true, name: true, role: true } });
  console.log("\nUsuários cadastrados:");
  for (const u of all) console.log("  -", u.email, "·", u.name, "·", u.role);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`\n✖ Usuário ${email} NÃO existe no banco. Rode: npm run db:seed`);
    process.exit(1);
  }
  console.log(`\n✓ Usuário ${email} existe (id=${user.id}).`);

  const valid = await bcrypt.compare(password, user.passwordHash);
  console.log(`\nSenha bate? ${valid ? "✓ SIM" : "✖ NÃO"}`);
  if (!valid) {
    console.log("  → Hash atual no banco começa com:", user.passwordHash.slice(0, 20) + "...");
    console.log("  → Talvez o seed foi rodado com SEED_ADMIN_PASSWORD diferente.");
  }
}

main().finally(() => prisma.$disconnect());
