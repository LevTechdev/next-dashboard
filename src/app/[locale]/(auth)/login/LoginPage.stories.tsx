import type { Meta, StoryObj } from "@storybook/react";

/**
 * Login page with email/password form, 2FA verification, and social login options.
 *
 * Features:
 * - Email and password validation
 * - Two-factor authentication (TOTP) support
 * - Google OAuth login
 * - Passkey authentication
 * - SSO/SAML login
 * - Forgot password link
 * - Theme toggle (light/dark)
 * - Responsive split layout with testimonial
 */
const meta: Meta = {
  title: "Pages/Auth/Login",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Login page with multi-step authentication flow. Supports email/password, 2FA verification, and social login providers.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/**
 * Default login view with email/password form.
 * Note: This is a visual preview - actual form submission requires the Next.js runtime.
 */
export const Default: Story = {
  render: () => (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F25C38] dark:bg-zinc-950 p-4 sm:p-8 relative">
      <div className="w-full max-w-[1000px] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-white/20 dark:border-zinc-800">
        {/* Left Side - Form */}
        <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center">
          <div className="w-full max-w-sm mx-auto">
            <div className="text-[#F25C38] mb-6">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
              Welcome back
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
              Log in to your account to continue exploring and utilizing our resources.
            </p>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex h-12 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-[#F25C38] focus:ring-2 focus:ring-[#F25C38]/20 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter password"
                  className="flex h-12 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-[#F25C38] focus:ring-2 focus:ring-[#F25C38]/20 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 text-sm font-medium bg-[#F25C38] hover:bg-[#D94C2B] text-white rounded-xl shadow-lg shadow-orange-500/20 transition-colors"
              >
                Log in
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase font-medium">
                <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400">OR</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button className="flex-1 h-12 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </button>
              <button className="flex-1 h-12 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <svg className="h-5 w-5 text-zinc-700 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              </button>
              <button className="flex-1 h-12 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <svg className="h-5 w-5 text-zinc-700 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-zinc-500 font-medium">
              Don&apos;t have an account?{" "}
              <span className="text-[#F25C38] hover:underline cursor-pointer">Create one</span>
            </p>
          </div>
        </div>

        {/* Right Side - Testimonial */}
        <div className="hidden md:flex md:w-[400px] lg:w-[480px] p-4 pl-0">
          <div className="w-full h-full rounded-2xl overflow-hidden relative bg-gradient-to-br from-orange-200 via-orange-100 to-amber-100 flex items-end p-6">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-400/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-1/4 left-0 w-[300px] h-[300px] bg-rose-400/20 rounded-full blur-[60px] -translate-x-1/2" />
            <div className="relative z-10 w-full backdrop-blur-xl bg-white/80 dark:bg-zinc-900/20 border border-white/40 p-8 rounded-[24px] shadow-2xl">
              <div className="flex gap-2 mb-6">
                <span className="px-4 py-1.5 bg-white/80 text-zinc-800 text-xs font-semibold rounded-full border border-white/20 shadow-sm">
                  Community of designers
                </span>
                <span className="px-4 py-1.5 bg-white/80 text-zinc-800 text-xs font-semibold rounded-full border border-white/20 shadow-sm">
                  Creative resources
                </span>
              </div>
              <p className="text-zinc-900 font-semibold text-lg sm:text-xl mb-8 leading-snug">
                &quot;I was able to reduce the time taken to present high-level designs by 35% using
                the platform.&quot;
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-900 font-bold text-sm">Sara Bright</p>
                  <p className="text-zinc-800/80 text-xs font-medium mt-0.5">Freelancer Designer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

/** 2FA verification view */
export const TwoFactorAuth: Story = {
  render: () => (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F25C38] dark:bg-zinc-950 p-4 sm:p-8 relative">
      <div className="w-full max-w-[1000px] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-white/20 dark:border-zinc-800">
        <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center">
          <div className="w-full max-w-sm mx-auto">
            <div className="text-[#F25C38] mb-6">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
              Two-Factor Auth
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
              Enter the 6-digit code from your authenticator app to continue.
            </p>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Verification Code
                </label>
                <div className="relative flex justify-between gap-2 w-full">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 aspect-square sm:h-14 border rounded-lg flex items-center justify-center text-xl sm:text-2xl font-mono transition-colors ${
                        i === 0
                          ? "border-[#F25C38] ring-1 ring-[#F25C38]"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      {i === 0 ? "1" : ""}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-12 text-sm font-medium bg-[#F25C38] hover:bg-[#D94C2B] text-white rounded-xl shadow-lg shadow-orange-500/20 transition-colors"
              >
                Verify & Login
              </button>

              <button
                type="button"
                className="w-full text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
              >
                ← Back to login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  ),
};
