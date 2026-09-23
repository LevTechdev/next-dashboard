import "server-only";

import { prisma } from "@/lib/db";

/**
 * Sign-in recognition for the new-sign-in alert.
 *
 * A sign-in is "recognized" only when BOTH the device profile (parsed OS +
 * browser pair) and the IP address already appear in the user's recent
 * session history. Anything new — a device, an IP, or both — triggers the
 * account-protection email. The check errs toward alerting: unknown IP data
 * (proxies/VPN rotations) keeps the alert on.
 */
export const RECOGNITION_WINDOW_DAYS = 90;

export interface RecognitionInput {
  ip: string;
  browser: string;
  device: string;
}

export type RecognitionOutcome = "known" | "new_device" | "new_ip" | "new_device_and_ip";

export interface RecognitionResult {
  shouldAlert: boolean;
  outcome: RecognitionOutcome;
}

/**
 * Compare the current sign-in context against the user's session history.
 * Pure query — no writes, so the login path can call it before the session
 * row for THIS sign-in lands.
 */
export async function recognizeSessionContext(
  userId: string,
  input: RecognitionInput,
): Promise<RecognitionResult> {
  const since = new Date(Date.now() - RECOGNITION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [sameDevice, sameIp] = await Promise.all([
    prisma.session.findFirst({
      where: { userId, createdAt: { gte: since }, device: input.device, browser: input.browser },
      select: { id: true },
    }),
    prisma.session.findFirst({
      where: { userId, createdAt: { gte: since }, ip: input.ip },
      select: { id: true },
    }),
  ]);

  const deviceKnown = sameDevice != null;
  const ipKnown = sameIp != null;

  const outcome: RecognitionOutcome =
    deviceKnown && ipKnown
      ? "known"
      : !deviceKnown && !ipKnown
        ? "new_device_and_ip"
        : !deviceKnown
          ? "new_device"
          : "new_ip";

  return { shouldAlert: outcome !== "known", outcome };
}

/**
 * Localized one-line explanation of why the alert fired, used inside the
 * NewSignInEmail body (the email templates carry their own per-locale label
 * maps, matching that pattern here).
 */
export function recognitionExplanation(outcome: RecognitionOutcome, locale = "en"): string {
  const MESSAGES: Record<string, Record<RecognitionOutcome, string>> = {
    en: {
      known: "This device and IP address are already recognized for your account.",
      new_device: "This is the first time this device has signed in to your account.",
      new_ip: "This sign-in came from an IP address your account hasn't used before.",
      new_device_and_ip: "This device and network location are both new to your account.",
    },
    id: {
      known: "Perangkat dan alamat IP ini sudah dikenali untuk akun Anda.",
      new_device: "Ini pertama kalinya perangkat ini masuk ke akun Anda.",
      new_ip: "Login ini berasal dari alamat IP yang belum pernah dipakai akun Anda.",
      new_device_and_ip: "Perangkat dan lokasi jaringan ini sama-sama baru bagi akun Anda.",
    },
    ja: {
      known: "このデバイスとIPアドレスはアカウントで確認済みです。",
      new_device: "このデバイスからのサインインは初めてです。",
      new_ip: "アカウントで使ったことのないIPアドレスからのサインインです。",
      new_device_and_ip: "このデバイスとネットワーク位置はどちらも初めてです。",
    },
    zh: {
      known: "此设备和IP地址已在您的账号中确认过。",
      new_device: "这是该设备首次登录您的账号。",
      new_ip: "此次登录来自您的账号从未使用过的IP地址。",
      new_device_and_ip: "此设备和网络位置对您的账号来说都是新的。",
    },
  };
  return (MESSAGES[locale] ?? MESSAGES.en)[outcome];
}
