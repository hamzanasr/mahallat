import { describe, it, expect } from "vitest";
import {
  getTranslations,
  getDirection,
  isRTL,
  formatMoney,
} from "@mahallat/shared";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://eaqmwmdkxqiuioszvjqx.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_BnEmLzPbhBBi_R-LmrXjXQ_zNLv8NEN";

describe("Customer App Foundation (Step 2.1)", () => {
  it("CUS-001: Anonymous/Guest client can access public resources without authentication", async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: sessionData } = await anonClient.auth.getSession();
    expect(sessionData.session).toBeNull(); // Guest by default

    // Can fetch public setting via get_setting RPC
    const { data: pharmacySetting, error: pharmacyError } = await anonClient.rpc(
      "get_setting",
      { p_key: "section_pharmacy_enabled" }
    );
    expect(pharmacyError).toBeNull();
    expect(pharmacySetting).toBe(false); // Pharmacy hidden by default per regulation

    const { data: restaurantsSetting, error: restError } = await anonClient.rpc(
      "get_setting",
      { p_key: "section_restaurants_enabled" }
    );
    expect(restError).toBeNull();
    expect(restaurantsSetting).toBe(true);
  });

  it("CUS-013: Translations provide both Arabic and English with correct text and directions", () => {
    const arTrans = getTranslations("ar");
    const enTrans = getTranslations("en");

    expect(isRTL("ar")).toBe(true);
    expect(getDirection("ar")).toBe("rtl");
    expect(arTrans.customer.tabs.home).toBe("الرئيسية");
    expect(arTrans.customer.tabs.orders).toBe("الطلبات");
    expect(arTrans.customer.tabs.taxi).toBe("Taxi");
    expect(arTrans.customer.tabs.profile).toBe("حسابي");

    expect(isRTL("en")).toBe(false);
    expect(getDirection("en")).toBe("ltr");
    expect(enTrans.customer.tabs.home).toBe("Home");
    expect(enTrans.customer.tabs.orders).toBe("Orders");
    expect(enTrans.customer.tabs.taxi).toBe("Taxi");
    expect(enTrans.customer.tabs.profile).toBe("My Account");
  });

  it("ADM-001 & Money formatting: formatMoney accurately renders halalas in SAR with correct localization", () => {
    expect(formatMoney(4600, "ar")).toBe("46.00 ر.س");
    expect(formatMoney(4600, "en")).toBe("SAR 46.00");
    expect(formatMoney(0, "ar")).toBe("0.00 ر.س");
  });
});
