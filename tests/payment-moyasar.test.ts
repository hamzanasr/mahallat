import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { Database } from "@mahallat/shared";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe("Moyasar Payment, Authorization Hold, and Saved Cards (Step 3.2 - INT-001, PAY-001, PAY-023, PAY-003, ORD-002, ORD-004)", () => {
  let customer1Client: SupabaseClient<Database>;
  let customer2Client: SupabaseClient<Database>;
  let customer1Id: string;
  let customer2Id: string;
  let testCityId: string;
  let testMerchantId: string;
  let testStoreId: string;
  let testBranchId: string;
  let testItemId: string;
  let customer1AddressId: string;

  beforeAll(async () => {
    // 1. Create test customer accounts with authentic sessions
    const email1 = `test_pay_cust1_${Date.now()}@mahallat.local`;
    const email2 = `test_pay_cust2_${Date.now()}@mahallat.local`;
    const password = "TestPassword123!";

    const { data: u1 } = await adminClient.auth.admin.createUser({
      email: email1,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "عميل دفع تجريبي 1" },
    });
    customer1Id = u1.user!.id;

    const { data: u2 } = await adminClient.auth.admin.createUser({
      email: email2,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "عميل دفع تجريبي 2" },
    });
    customer2Id = u2.user!.id;

    await adminClient.from("profiles").upsert([
      { id: customer1Id, full_name: "عميل دفع تجريبي 1", preferred_language: "ar" },
      { id: customer2Id, full_name: "عميل دفع تجريبي 2", preferred_language: "ar" },
    ]);

    customer1Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await customer1Client.auth.signInWithPassword({ email: email1, password });

    customer2Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await customer2Client.auth.signInWithPassword({ email: email2, password });

    // 2. Create test city
    const { data: city } = await adminClient
      .from("cities")
      .insert({
        name_ar: "مدينة الدفع ميسر",
        name_en: "Moyasar Payment City",
        boundary: "SRID=4326;MULTIPOLYGON(((39.10 21.40, 39.30 21.40, 39.30 21.60, 39.10 21.60, 39.10 21.40)))",
        is_active: true,
      })
      .select("id")
      .single();
    testCityId = city!.id;

    // 3. Create test address for Customer 1
    const { data: addr } = await adminClient
      .from("customer_addresses")
      .insert({
        customer_id: customer1Id,
        name: "منزل عميل الدفع",
        type: "house",
        city_id: testCityId,
        location: "SRID=4326;POINT(39.18 21.50)",
        latitude: 21.50,
        longitude: 39.18,
        short_national_address: "PAYM1234",
        pin_confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    customer1AddressId = addr!.id;

    // 4. Create test merchant, store, contract, branch, and menu item
    const { data: merchant } = await adminClient
      .from("merchants")
      .insert({
        commercial_name: "شركة مطاعم تجربة الدفع",
        cr_number: "1010" + Math.floor(100000 + Math.random() * 900000),
        vat_number: "3000" + Math.floor(10000000000 + Math.random() * 90000000000),
      })
      .select("id")
      .single();
    testMerchantId = merchant!.id;

    const { data: store } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "مطعم تجربة ميسر",
        name_en: "Moyasar Test Restaurant",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        min_order_halalas: 2000,
        menu_slug: "moyasar-test-" + Date.now(),
        self_pickup_enabled: true,
      })
      .select("id")
      .single();
    testStoreId = store!.id;

    await adminClient.rpc("admin_create_store_contract", {
      p_store_id: testStoreId,
      p_pricing_model: "percentage",
      p_contract_percentage: 10.0,
      p_tier1_fee_halalas: 200,
      p_tier1_order_threshold_halalas: 2500,
      p_tier2_fee_halalas: 500,
      p_contract_per_customer_cap_halalas: 3000,
      p_menu_markup_percentage: 0.0,
      p_payment_gateway_fee_percentage: 2.5,
      p_payment_gateway_fee_fixed_halalas: 100,
    });

    const { data: branch } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testStoreId,
        name_ar: "فرع السداد",
        name_en: "Payment Branch",
        city_id: testCityId,
        address_text: "شارع الكيال، جدة",
        location: "SRID=4326;POINT(39.18 21.50)",
        min_order_halalas: 2000,
        default_prep_time_minutes: 15,
        is_active: false,
      })
      .select("id")
      .single();
    testBranchId = branch!.id;

    // Activate branch with license
    const { data: docType } = await adminClient
      .from("document_types")
      .select("id")
      .eq("code", "baladiya_license")
      .single();

    await adminClient.from("uploaded_documents").insert({
      document_type_id: docType!.id,
      entity_type: "branch",
      entity_id: testBranchId,
      file_url: "https://example.com/license.pdf",
      expiry_date: "2030-01-01",
      is_verified: true,
    });

    await adminClient
      .from("store_branches")
      .update({ is_active: true })
      .eq("id", testBranchId);

    // Section and Item
    const { data: section } = await adminClient
      .from("menu_sections")
      .insert({
        store_id: testStoreId,
        name_ar: "وجبات تجربة الدفع",
        name_en: "Payment Meals",
      })
      .select("id")
      .single();

    const { data: item } = await adminClient
      .from("menu_items")
      .insert({
        section_id: section!.id,
        name_ar: "وجبة تجربة ميسر",
        name_en: "Moyasar Test Meal",
        description_ar: "وجبة تجربة للدفع بالهللة",
        base_price_halalas: 2500, // 25.00 SAR
        calories_value: 500,
        prep_time_minutes: 10,
        is_published: true,
        is_available: true,
      })
      .select("id")
      .single();
    testItemId = item!.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (customer1Id) await adminClient.auth.admin.deleteUser(customer1Id);
    if (customer2Id) await adminClient.auth.admin.deleteUser(customer2Id);
    if (testStoreId) await adminClient.from("stores").delete().eq("id", testStoreId);
    if (testMerchantId) await adminClient.from("merchants").delete().eq("id", testMerchantId);
    if (testCityId) await adminClient.from("cities").delete().eq("id", testCityId);
  });

  // =========================================================================
  // 1. PAY-023: Saved Cards & Tokenization
  // =========================================================================
  it("1. Customer can save payment cards; first card is default, setting new default switches flag, and RLS isolates cards (PAY-023)", async () => {
    // Customer 1 saves first card (mada)
    const { data: card1Id, error: card1Err } = await customer1Client.rpc(
      "save_customer_payment_method",
      {
        p_moyasar_token_id: `tok_mada_${Date.now()}`,
        p_brand: "mada",
        p_last4: "0001",
        p_exp_month: 12,
        p_exp_year: 2028,
        p_cardholder_name: "أحمد بن محمد",
        p_is_default: false, // first card should be auto-promoted to default
      }
    );
    expect(card1Err).toBeNull();
    expect(card1Id).toBeTruthy();

    // Verify card 1 is default
    const { data: card1Data } = await customer1Client
      .from("customer_payment_methods")
      .select("*")
      .eq("id", card1Id!)
      .single();
    expect(card1Data?.is_default).toBe(true);
    expect(card1Data?.brand).toBe("mada");
    expect(card1Data?.last4).toBe("0001");

    // Customer 1 saves second card (visa) marked as default
    const { data: card2Id, error: card2Err } = await customer1Client.rpc(
      "save_customer_payment_method",
      {
        p_moyasar_token_id: `tok_visa_${Date.now()}`,
        p_brand: "visa",
        p_last4: "1111",
        p_exp_month: 6,
        p_exp_year: 2027,
        p_cardholder_name: "أحمد بن محمد",
        p_is_default: true,
      }
    );
    expect(card2Err).toBeNull();

    // Trigger check: card 2 should now be default, and card 1 should no longer be default
    const { data: allCust1Cards } = await customer1Client
      .from("customer_payment_methods")
      .select("id, is_default, brand")
      .order("is_default", { ascending: false });

    expect(allCust1Cards).toHaveLength(2);
    expect(allCust1Cards?.[0].id).toBe(card2Id);
    expect(allCust1Cards?.[0].is_default).toBe(true);
    expect(allCust1Cards?.[1].id).toBe(card1Id);
    expect(allCust1Cards?.[1].is_default).toBe(false);

    // RLS: Customer 2 cannot see Customer 1's cards
    const { data: cust2ViewOfCards } = await customer2Client
      .from("customer_payment_methods")
      .select("*");
    expect(cust2ViewOfCards).toHaveLength(0);

    // Customer 2 cannot delete Customer 1's card
    const { error: cust2DeleteErr } = await customer2Client.rpc("delete_customer_payment_method", {
      p_payment_method_id: card1Id!,
    });
    expect(cust2DeleteErr).toBeTruthy();
    expect(cust2DeleteErr?.message).toContain("NOT_FOUND");
  });

  // =========================================================================
  // 2. PAY-001 & ORD-002: Order Payment Authorization & 60-Second Window
  // =========================================================================
  it("2. Payment authorization holds funds in halalas, activates 60s cancellation window, advances order to 'created', and ensures idempotency (PAY-001, ORD-002)", async () => {
    // Create order (starts in pending_payment)
    const idempotencyKey = `idem_pay_test_${Date.now()}`;
    const { data: createRes, error: createErr } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
      p_idempotency_key: idempotencyKey,
    });
    console.log("DEBUG createRes:", JSON.stringify(createRes), "createErr:", JSON.stringify(createErr));
    expect(createErr).toBeNull();
    const orderId = (createRes as any).order_id;
    const orderTotal = (createRes as any).total_halalas;
    expect(orderTotal).toBeGreaterThan(0);

    // Verify initial status is pending_payment and payment_status is unpaid
    const { data: initialOrder, error: initialOrderErr } = await customer1Client
      .from("orders")
      .select("status, payment_status")
      .eq("id", orderId)
      .single();
    expect(initialOrderErr).toBeNull();
    expect(initialOrder?.status).toBe("pending_payment");
    expect(initialOrder?.payment_status).toBe("unpaid");

    // Attempting authorization with incorrect total must be strictly rejected (PRICE_MISMATCH)
    const { error: mismatchErr } = await customer1Client.rpc(
      "record_order_payment_authorization",
      {
        p_order_id: orderId,
        p_gateway_reference: "pay_moyasar_mismatch",
        p_amount_halalas: orderTotal + 100, // Altered by 1 SAR
        p_brand: "mada",
        p_last4: "0001",
      }
    );
    expect(mismatchErr).toBeTruthy();
    expect(mismatchErr?.message).toContain("PRICE_MISMATCH");

    // Authorize with exact halalas total (PAY-001, ORD-002)
    const gatewayRef = `pay_moyasar_${Date.now()}`;
    const { data: authResult, error: authErr } = await customer1Client.rpc(
      "record_order_payment_authorization",
      {
        p_order_id: orderId,
        p_gateway_reference: gatewayRef,
        p_amount_halalas: orderTotal,
        p_brand: "mada",
        p_last4: "0001",
        p_metadata: { test: true },
      }
    );
    expect(authErr).toBeNull();
    expect((authResult as any).success).toBe(true);
    expect((authResult as any).status).toBe("cooling_off");
    expect((authResult as any).payment_status).toBe("authorized");

    // Verify order in database
    const { data: updatedOrder } = await customer1Client
      .from("orders")
      .select("status, payment_status, authorized_at, free_cancellation_until, payment_gateway_ref")
      .eq("id", orderId)
      .single();

    expect(updatedOrder?.status).toBe("cooling_off");
    expect(updatedOrder?.payment_status).toBe("authorized");
    expect(updatedOrder?.payment_gateway_ref).toBe(gatewayRef);
    expect(updatedOrder?.authorized_at).toBeTruthy();
    expect(updatedOrder?.free_cancellation_until).toBeTruthy();

    // Verify that free_cancellation_until is approximately 60 seconds after authorized_at
    const authTime = new Date(updatedOrder!.authorized_at!).getTime();
    const cancelWindow = new Date(updatedOrder!.free_cancellation_until!).getTime();
    const diffSeconds = Math.round((cancelWindow - authTime) / 1000);
    expect(diffSeconds).toBe(60);

    // Verify idempotency: calling again with same gatewayRef returns success without error
    const { data: idempotentRes, error: idemErr } = await customer1Client.rpc(
      "record_order_payment_authorization",
      {
        p_order_id: orderId,
        p_gateway_reference: gatewayRef,
        p_amount_halalas: orderTotal,
        p_brand: "mada",
        p_last4: "0001",
      }
    );
    expect(idemErr).toBeNull();
    expect((idempotentRes as any).success).toBe(true);
  });

  // =========================================================================
  // 3. PAY-005: Financial Ledger Immutability
  // =========================================================================
  it("3. Payment transactions ledger is strictly immutable (trigger blocks UPDATE & DELETE) (PAY-005)", async () => {
    // Fetch a transaction row
    const { data: tx } = await adminClient
      .from("payment_transactions")
      .select("id, amount_halalas")
      .limit(1)
      .single();
    expect(tx).toBeTruthy();

    // Attempting direct UPDATE must fail with PAY-005 trigger exception
    const { error: updateErr } = await adminClient
      .from("payment_transactions")
      .update({ amount_halalas: 99999 })
      .eq("id", tx!.id);
    expect(updateErr).toBeTruthy();
    expect(updateErr?.message).toContain("PAY-005");

    // Attempting direct DELETE must fail with PAY-005 trigger exception
    const { error: deleteErr } = await adminClient
      .from("payment_transactions")
      .delete()
      .eq("id", tx!.id);
    expect(deleteErr).toBeTruthy();
    expect(deleteErr?.message).toContain("PAY-005");
  });

  // =========================================================================
  // 4. ORD-002, ORD-004 & PAY-003: Cancellation Within 60s Voids Authorization
  // =========================================================================
  it("4. Customer cancellation within 60s window marks payment as voided and records void transaction (ORD-002, ORD-004, PAY-003)", async () => {
    // Create and authorize another order
    const { data: createRes, error: createErr } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
      p_idempotency_key: `idem_void_test_${Date.now()}`,
    });
    expect(createErr).toBeNull();
    const orderId = (createRes as any).order_id;
    const orderTotal = (createRes as any).total_halalas;

    await customer1Client.rpc("record_order_payment_authorization", {
      p_order_id: orderId,
      p_gateway_reference: `pay_void_auth_${Date.now()}`,
      p_amount_halalas: orderTotal,
      p_brand: "mada",
      p_last4: "0001",
    });

    // Customer cancels order within 60s
    const { data: cancelRes, error: cancelErr } = await customer1Client.rpc(
      "cancel_customer_order",
      {
        p_order_id: orderId,
        p_reason: "تراجع عن الطلب خلال مهلة الـ 60 ثانية",
      }
    );
    expect(cancelErr).toBeNull();
    expect((cancelRes as any).success).toBe(true);
    expect((cancelRes as any).status).toBe("cancelled");
    expect((cancelRes as any).payment_status).toBe("voided");
    expect((cancelRes as any).within_60s).toBe(true);

    // Verify order state
    const { data: voidedOrder } = await customer1Client
      .from("orders")
      .select("status, payment_status, voided_at")
      .eq("id", orderId)
      .single();
    expect(voidedOrder?.status).toBe("cancelled");
    expect(voidedOrder?.payment_status).toBe("voided");
    expect(voidedOrder?.voided_at).toBeTruthy();

    // Verify void transaction in immutable ledger
    const { data: voidTx } = await adminClient
      .from("payment_transactions")
      .select("*")
      .eq("order_id", orderId)
      .eq("transaction_type", "void")
      .single();
    expect(voidTx).toBeTruthy();
    expect(voidTx?.status).toBe("success");
    expect(voidTx?.amount_halalas).toBe(orderTotal);
  });

  // =========================================================================
  // 5. ORD-004: Customer Cancellation Blocked Once Preparation Starts
  // =========================================================================
  it("5. Customer cancellation is strictly blocked once preparation starts (ORD-004)", async () => {
    // Create and authorize order
    const { data: createRes, error: createErr } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
      p_idempotency_key: `idem_prep_cancel_${Date.now()}`,
    });
    expect(createErr).toBeNull();
    const orderId = (createRes as any).order_id;
    const orderTotal = (createRes as any).total_halalas;

    await customer1Client.rpc("record_order_payment_authorization", {
      p_order_id: orderId,
      p_gateway_reference: `pay_prep_auth_${Date.now()}`,
      p_amount_halalas: orderTotal,
      p_brand: "mada",
      p_last4: "0001",
    });

    // Advance to preparing via admin/merchant
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "preparing",
      p_reason: "بدء التجهيز",
      p_changed_by_role: "merchant",
    });

    // Attempt customer cancellation must fail
    const { error: cancelErr } = await customer1Client.rpc("cancel_customer_order", {
      p_order_id: orderId,
      p_reason: "أريد إلغاء الطلب بعد التجهيز",
    });
    expect(cancelErr).toBeTruthy();
    expect(cancelErr?.message).toContain("CANNOT_CANCEL_AFTER_PREPARATION");
  });
});
