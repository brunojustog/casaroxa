/**
 * Reseta a senha de um usuário admin direto no banco.
 *
 * Uso (dentro do container):
 *   docker exec -it $(docker ps -qf name=casaroxa_app) \
 *     npx tsx scripts/set-admin-password.ts <email> <nova-senha>
 *
 * Cuidados:
 *   - Não loga a senha em lugar nenhum.
 *   - Se o email não existir, não cria — só falha.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Uso: npx tsx scripts/set-admin-password.ts <email> <nova-senha>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`✗ Usuário com email "${email}" não encontrado.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`✓ Senha atualizada para ${email} (id ${user.id}).`);
}

main()
  .catch((err) => {
    console.error("Erro:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
