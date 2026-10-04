"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Field, Input, Select } from "@/components/Field";
import { storeCreateSchema } from "@/lib/validation";

type FieldErrors = Partial<
  Record<"store_name" | "vendor_name" | "phone" | "city" | "language" | "form", string>
>;

export function OnboardingForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    const parsed = storeCreateSchema.safeParse({
      store_name: storeName,
      vendor_name: vendorName,
      phone,
      city,
      language,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form") as keyof FieldErrors;
        if (!next[key]) {
          next[key] = issue.message;
        }
      }
      setErrors(next);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as {
        id?: string;
        message?: string;
        fieldErrors?: FieldErrors;
      };
      if (!response.ok || !body.id) {
        setErrors(body.fieldErrors ?? { form: body.message ?? "Couldn't save the store. Try again." });
        return;
      }
      router.push(`/scan/${body.id}`);
    } catch {
      setErrors({ form: "Couldn't save the store. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field label="Store name" error={errors.store_name}>
        <Input
          name="store_name"
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          autoComplete="organization"
        />
      </Field>
      <Field label="Your name" error={errors.vendor_name}>
        <Input
          name="vendor_name"
          value={vendorName}
          onChange={(event) => setVendorName(event.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Phone" error={errors.phone}>
        <Input
          name="phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
        />
      </Field>
      <Field label="City (optional)" error={errors.city}>
        <Input
          name="city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          autoComplete="address-level2"
        />
      </Field>
      <Field label="Language" error={errors.language}>
        <Select
          name="language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as "en" | "hi")}
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
        </Select>
      </Field>
      {errors.form ? (
        <p className="text-[14px] text-ink" role="alert">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving" : "Start scanning"}
      </Button>
    </form>
  );
}
