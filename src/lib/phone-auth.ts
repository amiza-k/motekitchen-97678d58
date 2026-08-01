// توابع کمکی مشترک برای احراز هویت با ایمیل یا شماره همراه

export const PHONE_REGEX = /^09\d{9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

// دامنه‌ی فقط برای ساخت حساب Supabase Auth وقتی کاربر با شماره ثبت‌نام می‌کند.
// این مقدار هرگز در جدول profiles ذخیره نمی‌شود و به کاربر نشان داده نمی‌شود؛
// فقط داخل auth.users (که مستقیماً در دسترس اپ نیست) باقی می‌ماند.
export const PHONE_AUTH_DOMAIN = "phone.motekitchen.app";

export function toEnglishDigits(input: string) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const pIdx = persian.indexOf(d);
    if (pIdx > -1) return String(pIdx);
    const aIdx = arabic.indexOf(d);
    if (aIdx > -1) return String(aIdx);
    return d;
  });
}

export function phoneToEmail(phone: string) {
  return `${phone}@${PHONE_AUTH_DOMAIN}`;
}

export type IdentifierKind = "email" | "phone" | "other";

export function classifyIdentifier(raw: string): { kind: IdentifierKind; value: string } {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    return EMAIL_REGEX.test(trimmed) ? { kind: "email", value: trimmed } : { kind: "other", value: trimmed };
  }
  const digits = toEnglishDigits(trimmed);
  if (PHONE_REGEX.test(digits)) return { kind: "phone", value: digits };
  return { kind: "other", value: trimmed };
}