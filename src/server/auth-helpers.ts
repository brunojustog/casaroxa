import { auth } from "./auth";

export class UnauthorizedError extends Error {
  constructor(message = "Não autorizado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

/**
 * Garante que o usuário está logado para operações em server actions.
 * Lança UnauthorizedError se não estiver — o handler da action converte em
 * resposta de erro amigável.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Helper para padronizar tratamento de erro em server actions. */
export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UnauthorizedError || e instanceof BusinessError) {
      return { ok: false, error: e.message };
    }
    console.error("[action]", e);
    return { ok: false, error: "Erro inesperado. Tente novamente." };
  }
}
