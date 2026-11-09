import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../page";

const { loginMock, pushMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ login: loginMock }),
}));

vi.mock("next-intl", () => {
  const messages: Record<string, string> = {
    welcomeBack: "Welcome back",
    loginDescription: "Sign in to your dashboard",
    email: "Email",
    emailPlaceholder: "Email address",
    password: "Password",
    passwordPlaceholder: "Password",
    forgotPassword: "Forgot password?",
    staySignedInLabel: "Stay signed in",
    staySignedInHint: "Keep me signed in",
    loginButton: "Log in",
    loggingIn: "Logging in...",
    or: "or",
    passkeySignIn: "Sign in with a passkey",
    passkeyAnyAccount: "Passkey",
    ssoSignIn: "Sign in with enterprise SSO",
    ssoRedirecting: "Redirecting",
    noAccount: "No account?",
    createOne: "Create one",
    chooseVerifyTitle: "Choose how to verify",
    chooseVerifyDesc: "Pick a second factor",
    useAuthenticator: "Use authenticator app",
    useAuthenticatorDesc: "Use your authenticator",
    useEmailCode: "Email me a code",
    useEmailCodeDesc: "Send a code to your email",
    sendingCode: "Sending code",
    useBackupCode: "Use a backup code",
    useBackupCodeDesc: "Use a saved code",
    usePasskey: "Use a passkey",
    usePasskeyDesc: "Use this device",
    waitingForPasskey: "Waiting for passkey",
    trustDeviceLabel: "Trust this device",
    trustDeviceHint: "Skip 2FA for 30 days",
    lostAllMethods: "Lost all methods?",
    backToLogin: "Back to login",
  };
  const t = (key: string, values?: Record<string, unknown>) =>
    (messages[key] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) =>
      String(values?.[name] ?? ""),
    );
  return { useTranslations: () => t };
});

vi.mock("@/components/auth/auth-testimonial", () => ({
  AuthTestimonial: () => null,
}));

vi.mock("@/components/brand/brand-logo", () => ({
  BrandLogo: () => null,
}));

vi.mock("@/components/theme/theme-toggle-button", () => ({
  ThemeToggleButton: () => null,
}));

vi.mock("@/components/security/use-resend-cooldown", () => ({
  FORGOT_PASSWORD_COOLDOWN_KEY: "test-cooldown",
  useResendCooldown: () => ({ cooldownLeft: 0, startCooldown: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  loginMock.mockReset();
  pushMock.mockReset();
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    value: () => undefined,
  });
});

describe("LoginPage verification chooser", () => {
  it("keeps the email-code and passkey pending states independent", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValueOnce({ requires2FA: true, hasPasskeys: true });

    render(<LoginPage />);

    const email = await screen.findByPlaceholderText("Email address");
    const password = screen.getByPlaceholderText("Password");
    await waitFor(() => {
      expect(email).toBeEnabled();
      expect(password).toBeEnabled();
    });

    await user.type(email, "user@example.com");
    await user.type(password, "password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByRole("heading", { name: "Choose how to verify" }),
    ).toBeInTheDocument();

    const emailButton = screen.getByRole("button", { name: /Email me a code/ });
    const passkeyButton = screen.getByRole("button", { name: /Use a passkey/ });
    expect(emailButton).toHaveAttribute("aria-busy", "false");
    expect(passkeyButton).toHaveAttribute("aria-busy", "false");

    // The challenge request stays in flight, so the chosen card must spin while
    // the other method remains idle (rather than both cards spinning together).
    loginMock.mockImplementationOnce(() => new Promise(() => undefined));
    await user.click(emailButton);

    await waitFor(() => {
      expect(emailButton).toHaveAttribute("aria-busy", "true");
      expect(passkeyButton).toHaveAttribute("aria-busy", "false");
    });
  });
});
