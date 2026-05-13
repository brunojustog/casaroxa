import { describe, it, expect } from "vitest";
import { isValidCpf, isValidCnpj, isValidCpfOrCnpj } from "./cpf-cnpj";

describe("isValidCpf", () => {
  it("aceita CPF válido formatado", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("aceita CPF válido sem formatação", () => {
    expect(isValidCpf("11144477735")).toBe(true);
  });

  it("rejeita sequências repetidas", () => {
    expect(isValidCpf("000.000.000-00")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("999.999.999-99")).toBe(false);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(isValidCpf("111.444.777-99")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("12345678901234")).toBe(false);
  });

  it("rejeita vazio", () => {
    expect(isValidCpf("")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJ válido formatado", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("aceita CNPJ válido sem formatação", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("rejeita sequências repetidas", () => {
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });

  it("rejeita dígito verificador errado", () => {
    expect(isValidCnpj("11.222.333/0001-99")).toBe(false);
  });
});

describe("isValidCpfOrCnpj", () => {
  it("aceita CPF válido", () => {
    expect(isValidCpfOrCnpj("11144477735")).toBe(true);
  });

  it("aceita CNPJ válido", () => {
    expect(isValidCpfOrCnpj("11222333000181")).toBe(true);
  });

  it("rejeita tamanho não 11 nem 14", () => {
    expect(isValidCpfOrCnpj("123")).toBe(false);
    expect(isValidCpfOrCnpj("1234567890")).toBe(false);
    expect(isValidCpfOrCnpj("123456789012")).toBe(false);
  });
});
