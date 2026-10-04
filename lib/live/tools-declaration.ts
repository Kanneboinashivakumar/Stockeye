import { type FunctionDeclaration, Type } from "@google/genai";

export const LIVE_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "add_product",
    description:
      "Propose adding a detected product from the shelf into the store catalogue. Price and stock are never assumed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Product name as printed on the pack",
        },
        brand: {
          type: Type.STRING,
          description: "Brand name if distinguishable",
        },
        variant: {
          type: Type.STRING,
          description: "Flavour or variety if stated",
        },
        size: {
          type: Type.STRING,
          description: "Pack size or net weight, e.g. 70g, 500ml",
        },
        category: {
          type: Type.STRING,
          description:
            "Category, e.g. Snacks, Groceries, Beverages, Personal Care",
        },
        price: {
          type: Type.NUMBER,
          description:
            "Selling price in INR (rupees) if spoken by owner, otherwise omit",
        },
        stock: {
          type: Type.INTEGER,
          description:
            "Packets or units count in stock if spoken by owner, otherwise omit",
        },
        confidence: {
          type: Type.NUMBER,
          description: "Visual confidence score between 0 and 1",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_product",
    description:
      "Update fields on a product, such as price, stock, or details spoken by the shopkeeper.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        product_ref: {
          type: Type.STRING,
          description:
            "Product id or spoken name of the product to update",
        },
        price: {
          type: Type.NUMBER,
          description: "Selling price in INR (rupees)",
        },
        stock: {
          type: Type.INTEGER,
          description: "Number of units or packets in stock",
        },
        name: {
          type: Type.STRING,
          description: "Updated product name",
        },
        brand: {
          type: Type.STRING,
          description: "Updated brand name",
        },
        variant: {
          type: Type.STRING,
          description: "Updated variant or flavour",
        },
        size: {
          type: Type.STRING,
          description: "Updated pack size",
        },
        category: {
          type: Type.STRING,
          description: "Updated category",
        },
      },
      required: ["product_ref"],
    },
  },
  {
    name: "confirm_product",
    description: "Confirm that a detected product is accepted by the owner.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        product_ref: {
          type: Type.STRING,
          description: "Product id or spoken name to confirm",
        },
      },
      required: ["product_ref"],
    },
  },
  {
    name: "remove_product",
    description: "Remove a product from the catalogue.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        product_ref: {
          type: Type.STRING,
          description: "Product id or spoken name to remove",
        },
      },
      required: ["product_ref"],
    },
  },
  {
    name: "publish_store",
    description:
      "Publish the store or open review. When the owner asks to publish: first ask if they want to review the catalogue or publish directly. If they say 'already reviewed, just publish' (or 'no, just publish'), set confirm_direct_publish: true. If they want to review items, set action: 'review'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        confirm_direct_publish: {
          type: Type.BOOLEAN,
          description:
            "Set to true only if the owner explicitly confirmed that they already reviewed the items and want to publish directly without reviewing again.",
        },
        action: {
          type: Type.STRING,
          enum: ["publish", "review"],
          description:
            "Set to 'review' if the owner chooses to review the catalogue first.",
        },
      },
    },
  },
];
