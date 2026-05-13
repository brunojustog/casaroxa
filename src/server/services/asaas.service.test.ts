import { describe, it, expect } from "vitest";
import { mapAsaasStatus } from "./asaas.service";

describe("mapAsaasStatus", () => {
  it("mapeia RECEIVED e RECEIVED_IN_CASH", () => {
    expect(mapAsaasStatus("RECEIVED")).toBe("RECEIVED");
    expect(mapAsaasStatus("RECEIVED_IN_CASH")).toBe("RECEIVED");
  });

  it("mapeia CONFIRMED", () => {
    expect(mapAsaasStatus("CONFIRMED")).toBe("CONFIRMED");
  });

  it("mapeia OVERDUE", () => {
    expect(mapAsaasStatus("OVERDUE")).toBe("OVERDUE");
  });

  it("agrupa REFUND_* em REFUNDED", () => {
    expect(mapAsaasStatus("REFUNDED")).toBe("REFUNDED");
    expect(mapAsaasStatus("REFUND_REQUESTED")).toBe("REFUNDED");
    expect(mapAsaasStatus("REFUND_IN_PROGRESS")).toBe("REFUNDED");
  });

  it("agrupa CHARGEBACK_*, DUNNING_* em FAILED", () => {
    expect(mapAsaasStatus("CHARGEBACK_REQUESTED")).toBe("FAILED");
    expect(mapAsaasStatus("CHARGEBACK_DISPUTE")).toBe("FAILED");
    expect(mapAsaasStatus("AWAITING_CHARGEBACK_REVERSAL")).toBe("FAILED");
    expect(mapAsaasStatus("DUNNING_REQUESTED")).toBe("FAILED");
    expect(mapAsaasStatus("DUNNING_RECEIVED")).toBe("FAILED");
  });

  it("default e PENDING/risk_analysis viram PENDING", () => {
    expect(mapAsaasStatus("PENDING")).toBe("PENDING");
    expect(mapAsaasStatus("AWAITING_RISK_ANALYSIS")).toBe("PENDING");
    expect(mapAsaasStatus("string_qualquer_desconhecida")).toBe("PENDING");
    expect(mapAsaasStatus("")).toBe("PENDING");
  });

  it("é case-insensitive", () => {
    expect(mapAsaasStatus("received")).toBe("RECEIVED");
    expect(mapAsaasStatus("Received")).toBe("RECEIVED");
  });
});
