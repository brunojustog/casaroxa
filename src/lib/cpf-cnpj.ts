/**
 * Validação algorítmica de CPF e CNPJ — checa dígitos verificadores.
 * Bancos e gateways (incluindo Asaas) rejeitam números que passam só
 * pela checagem de tamanho mas têm DV inválido.
 */

function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Aceita formatado ou só dígitos. Retorna true se DV é válido. */
export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  // Rejeita sequências (111.111.111-11 etc) — passam no DV mas são inválidas
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);

  // DV1: soma dos 9 primeiros × pesos 10..2
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  let dv1 = (sum * 10) % 11;
  if (dv1 === 10) dv1 = 0;
  if (dv1 !== digits[9]) return false;

  // DV2: soma dos 10 primeiros × pesos 11..2
  sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i);
  let dv2 = (sum * 10) % 11;
  if (dv2 === 10) dv2 = 0;
  return dv2 === digits[10];
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split("").map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += digits[i] * w1[i];
  let dv1 = sum % 11;
  dv1 = dv1 < 2 ? 0 : 11 - dv1;
  if (dv1 !== digits[12]) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += digits[i] * w2[i];
  let dv2 = sum % 11;
  dv2 = dv2 < 2 ? 0 : 11 - dv2;
  return dv2 === digits[13];
}

export function isValidCpfOrCnpj(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}
