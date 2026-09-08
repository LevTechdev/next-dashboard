import { describe, it, expect } from "vitest";
import {
  INDONESIAN_BANKS,
  getBankByCode,
  getBankByName,
  getBanksByCategory,
  getBanksByRegion,
  searchBanks,
} from "./indonesian-banks";

describe("Indonesian Banking Directory", () => {
  it("contains over 50 registered banks across all sectors", () => {
    expect(INDONESIAN_BANKS.length).toBeGreaterThanOrEqual(50);
  });

  it("covers all 4 primary banking categories", () => {
    const bumn = getBanksByCategory("bumn");
    const swasta = getBanksByCategory("swasta");
    const bpd = getBanksByCategory("bpd");
    const digital = getBanksByCategory("digital");

    expect(bumn.length).toBeGreaterThanOrEqual(5);
    expect(swasta.length).toBeGreaterThanOrEqual(10);
    expect(bpd.length).toBeGreaterThanOrEqual(24);
    expect(digital.length).toBeGreaterThanOrEqual(6);
  });

  it("covers all 4 BPD macro-geographic regions across Indonesia", () => {
    const sumatera = getBanksByRegion("sumatera");
    const jawaBali = getBanksByRegion("jawa_bali");
    const kalSul = getBanksByRegion("kalimantan_sulawesi");
    const timur = getBanksByRegion("indonesia_timur");

    expect(sumatera.length).toBeGreaterThanOrEqual(8);
    expect(jawaBali.length).toBeGreaterThanOrEqual(6);
    expect(kalSul.length).toBeGreaterThanOrEqual(8);
    expect(timur.length).toBeGreaterThanOrEqual(4);
  });

  it("looks up banks by clearing code or short name", () => {
    const bca = getBankByCode("014");
    expect(bca).toBeDefined();
    expect(bca?.shortName).toBe("BCA");
    expect(bca?.biFast).toBe(true);

    const mandiri = getBankByCode("008");
    expect(mandiri).toBeDefined();
    expect(mandiri?.shortName).toBe("Mandiri");

    const bri = getBankByCode("002");
    expect(bri).toBeDefined();
    expect(bri?.shortName).toBe("BRI");

    // Case and shortName lookup
    const bcaByName = getBankByCode("BCA");
    expect(bcaByName?.code).toBe("014");
  });

  it("looks up banks by exact or fuzzy name", () => {
    const jago = getBankByName("Bank Jago");
    expect(jago).toBeDefined();
    expect(jago?.code).toBe("542");
    expect(jago?.category).toBe("digital");

    const seabank = getBankByName("SeaBank");
    expect(seabank).toBeDefined();
    expect(seabank?.code).toBe("535");

    const bjb = getBankByName("BJB");
    expect(bjb).toBeDefined();
    expect(bjb?.code).toBe("110");
    expect(bjb?.region).toBe("jawa_bali");
  });

  it("performs multi-attribute keyword search", () => {
    const bpdResults = searchBanks("BPD");
    expect(bpdResults.length).toBeGreaterThanOrEqual(10);

    const codeResults = searchBanks("014");
    expect(codeResults.some((b) => b.shortName === "BCA")).toBe(true);

    const papuaResults = searchBanks("Papua");
    expect(papuaResults.some((b) => b.code === "132")).toBe(true);
  });
});
