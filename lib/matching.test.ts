import { test, describe } from "node:test";
import assert from "node:assert";
import {
  matchProduct,
  normalizeProductName,
  type CandidateProduct,
} from "./matching.ts";

describe("Deterministic Product Matching", () => {
  const products: CandidateProduct[] = [
    {
      id: "a1111111-1111-1111-1111-111111111111",
      name: "Maggi 2-Minute Noodles",
      name_normalized: "maggi 2 minute noodles",
      size: "70g",
      category: "Packaged Foods",
      price: 14,
      stock: 30,
    },
    {
      id: "b2222222-2222-2222-2222-222222222222",
      name: "Parle-G",
      name_normalized: "parle g",
      size: "80g",
      category: "Biscuits",
      price: 10,
      stock: 50,
    },
    {
      id: "c3333333-3333-3333-3333-333333333333",
      name: "Colgate Strong Teeth",
      name_normalized: "colgate strong teeth",
      size: "100g",
      category: "Personal Care",
      price: 55,
      stock: 20,
    },
    {
      id: "d4444444-4444-4444-4444-444444444444",
      name: "Lays Classic Salted",
      name_normalized: "lays classic salted",
      size: "50g",
      category: "Snacks",
      price: 20,
      stock: 25,
    },
    {
      id: "e5555555-5555-5555-5555-555555555555",
      name: "Tata Salt",
      name_normalized: "tata salt",
      size: "1kg",
      category: "Groceries",
      price: 28,
      stock: 40,
    },
    {
      id: "f6666666-6666-6666-6666-666666666666",
      name: "Bournvita Health Drink",
      name_normalized: "bournvita health drink",
      size: "500g",
      category: "Beverages",
      price: 240,
      stock: 10,
    },
  ];

  test("1. Exact ID matching", () => {
    const res = matchProduct("a1111111-1111-1111-1111-111111111111", products);
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.name, "Maggi 2-Minute Noodles");
    }
  });

  test("2. Exact normalized name matching", () => {
    const res = matchProduct("Tata Salt", products);
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.name, "Tata Salt");
    }
  });

  test("3. 'Maggi' matching 'Maggi 2-Minute Noodles' (contains)", () => {
    const res = matchProduct("Maggi", products);
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.name, "Maggi 2-Minute Noodles");
    }
  });

  test("4. Two Maggi sizes returning ambiguous", () => {
    const multiMaggi: CandidateProduct[] = [
      {
        id: "m1",
        name: "Maggi Noodles",
        name_normalized: "maggi noodles",
        size: "70g",
      },
      {
        id: "m2",
        name: "Maggi Noodles",
        name_normalized: "maggi noodles",
        size: "140g",
      },
    ];
    const res = matchProduct("Maggi", multiMaggi);
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error, "ambiguous");
      assert.strictEqual(res.candidates.length, 2);
    }
  });

  test("5. Two Maggi sizes resolved with size parameter", () => {
    const multiMaggi: CandidateProduct[] = [
      {
        id: "m1",
        name: "Maggi Noodles",
        name_normalized: "maggi noodles",
        size: "70g",
      },
      {
        id: "m2",
        name: "Maggi Noodles",
        name_normalized: "maggi noodles",
        size: "140g",
      },
    ];
    const res = matchProduct("Maggi Noodles", multiMaggi, { size: "140g" });
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.id, "m2");
    }
  });

  test("6. 'Parle G' matching 'Parle-G' with hyphen stripped", () => {
    const res = matchProduct("Parle G", products);
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.name, "Parle-G");
    }
  });

  test("7. Case insensitivity ('COLGATE' matching 'Colgate Strong Teeth')", () => {
    const res = matchProduct("COLGATE", products);
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.name, "Colgate Strong Teeth");
    }
  });

  test("8. Extra whitespace collapsing ('Lays   Classic')", () => {
    const res = matchProduct("Lays   Classic", products);
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.name, "Lays Classic Salted");
    }
  });

  test("9. Attached size stripping in query ('Tata Salt 1kg' matching 'Tata Salt')", () => {
    const res = matchProduct("Tata Salt 1kg", products);
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.name, "Tata Salt");
    }
  });

  test("10. Unmatched product returns not_found", () => {
    const res = matchProduct("Amul Dark Chocolate", products);
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error, "not_found");
    }
  });

  test("11. Fuzzy match with single clear winner ('Bournvitaa')", () => {
    const res = matchProduct("Bournvitaa", products);
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.product.name, "Bournvita Health Drink");
    }
  });

  test("12. Fuzzy query with multiple ambiguous candidates ('Good Day')", () => {
    const goodDayCandidates: CandidateProduct[] = [
      {
        id: "gd1",
        name: "Britannia Good Day Butter",
        name_normalized: "britannia good day butter",
      },
      {
        id: "gd2",
        name: "Britannia Good Day Cashew",
        name_normalized: "britannia good day cashew",
      },
    ];
    const res = matchProduct("Good Day", goodDayCandidates);
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.error, "ambiguous");
    }
  });

  test("Normalization function correctness", () => {
    assert.strictEqual(
      normalizeProductName("Maggi 2-Minute Noodles 70g"),
      "maggi 2 minute noodles",
    );
    assert.strictEqual(normalizeProductName("Parle-G"), "parle g");
    assert.strictEqual(normalizeProductName("Tata Salt (1 kg)"), "tata salt");
  });
});
