"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const t = {
  welcome: "Welcome Back!",
  subtitle: "Sign in to your Nexus account",
  email: "Email Address",
  password: "Password",
  forgot: "Forgot Password?",
  signIn: "Sign In",
  signingIn: "Signing in…",
  or: "Or continue with",
  google: "Google",
  microsoft: "Microsoft",
  emailError: "Enter your email address.",
  passwordError: "Enter your password.",
  forgotStatus: "Password recovery is not connected in this demo. Contact your administrator.",
  supportStatus: "Contact support is not connected in this demo.",
  providerStatus: "{provider} sign-in is not connected in this demo.",
  showPassword: "Show password",
  hidePassword: "Hide password",
};

const rowEnter = "relative animate-hero-row-enter opacity-0 motion-reduce:animate-none motion-reduce:opacity-100";
const contentEnter = "relative z-[1] animate-content-enter motion-reduce:animate-none";
const focusOutline = "focus-visible:outline focus-visible:outline-[0.1875rem] focus-visible:outline-offset-2 focus-visible:outline-[rgb(21_101_232/0.3)]";

function GoogleMark() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 shrink-0"><path fill="oklch(0.8442 0.1722 84.93)" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z" /><path fill="oklch(0.6535 0.2348 34.04)" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z" /><path fill="oklch(0.6731 0.1624 144.21)" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z" /><path fill="oklch(0.5645 0.1633 253.27)" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z" /></svg>;
}

function MicrosoftMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0"><path fill="oklch(0.6506 0.2059 35.64)" d="M1 1h10v10H1z" /><path fill="oklch(0.7207 0.1907 128.86)" d="M13 1h10v10H13z" /><path fill="oklch(0.6847 0.1559 239.64)" d="M1 13h10v10H1z" /><path fill="oklch(0.829 0.1712 81.04)" d="M13 13h10v10H13z" /></svg>;
}

export default function LoginPage() {
  const router = useRouter();
  const illustrationVideoRef = useRef<HTMLVideoElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch("/executive-overview");
  }, [router]);

  useEffect(() => {
    const video = illustrationVideoRef.current;
    if (!video) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (document.hidden || motionPreference.matches) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // Keep the poster visible if autoplay is unavailable in this browser.
      });
    };

    document.addEventListener("visibilitychange", syncPlayback);
    motionPreference.addEventListener("change", syncPlayback);
    syncPlayback();

    return () => {
      document.removeEventListener("visibilitychange", syncPlayback);
      motionPreference.removeEventListener("change", syncPlayback);
    };
  }, []);

  const setActionStatus = (message: string) => setStatus(message);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrors({ email: "", password: "" });
    setStatus("");

    setIsSubmitting(true);
    // Any credentials are accepted in this demo — straight to the overview.
    router.push("/executive-overview");
  };

  const providerStatus = (provider: string) => setActionStatus(t.providerStatus.replace("{provider}", provider));

  const inputShell = (hasError: boolean) =>
    cn(
      "flex min-h-[2.875rem] items-center gap-[0.6875rem] rounded-[0.6875rem] border px-3.5 text-[oklch(0.6619_0.0485_258.74)] transition-[border-color,box-shadow,background] duration-150",
      hasError
        ? "border-[oklch(0.6422_0.1661_16.32)] bg-[oklch(0.9892_0.0055_3.33)] focus-within:border-[oklch(0.6422_0.1661_16.32)] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgb(223_90_105/0.12)]"
        : "border-[oklch(0.9001_0.0249_257.65)] bg-white/85 focus-within:border-[oklch(0.6849_0.1503_257.39)] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgb(21_101_232/0.11)]",
    );

  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[linear-gradient(135deg,oklch(0.9562_0.0207_261.77),oklch(0.929_0.0338_263.58))] font-jakarta text-[oklch(0.3295_0.0867_259.49)] max-[61.25rem]:overflow-auto">
      <div className="fixed inset-0 z-0 overflow-hidden bg-[oklch(0.9535_0.0219_263.19)_url(/media/login-poster.png)] bg-cover bg-[position:70%_bottom] bg-no-repeat" aria-hidden="true">
        <video
          ref={illustrationVideoRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[70%_bottom]"
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/login-poster.png"
          tabIndex={-1}
        >
          <source src="/media/login-hero.mp4" type="video/mp4" />
        </video>
      </div>

      <section aria-label="Nexus infrastructure monitoring" className="pointer-events-none absolute left-1/2 top-[clamp(1.25rem,3vh,2.25rem)] z-[2] w-max max-w-[min(46vw,40rem)] -translate-x-1/2 text-center text-[oklch(0.2284_0.0704_264.15)] before:pointer-events-none before:absolute before:-inset-y-3 before:-inset-x-7 before:z-[-1] before:bg-[radial-gradient(ellipse_at_50%_50%,rgb(255_255_255/0.8)_0%,rgb(255_255_255/0)_70%)] before:content-[''] max-[56.1875rem]:hidden [@media(max-height:60rem)_and_(min-width:80rem)]:top-5">
        <div className={cn(rowEnter, "mx-auto flex w-max items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[oklch(0.5767_0.232_261.94)]/20 bg-white/85 px-3.5 py-[0.3125rem] text-[0.75rem] font-semibold text-[oklch(0.2284_0.0704_264.15)] [animation-delay:0ms] backdrop-blur-[0.625rem] max-[68.6875rem]:hidden")}>
          <i aria-hidden="true" className="h-[0.4375rem] w-[0.4375rem] shrink-0 animate-hero-dot-pulse rounded-full bg-[oklch(0.6469_0.1456_157.99)] motion-reduce:animate-none" />
          <span>System Online</span>
          <b aria-hidden="true" className="mx-[0.0625rem] h-[0.875rem] w-px bg-[oklch(0.2284_0.0704_264.15)]/20" />
          <span>All Services Operational</span>
        </div>
        <h1 className={cn(rowEnter, "mt-2.5 whitespace-nowrap text-[clamp(1.5rem,2.2vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-[oklch(0.2284_0.0704_264.15)] [animation-delay:80ms] max-[68.6875rem]:text-[1.375rem]")}>Infrastructure <span className="text-[oklch(0.5767_0.232_261.94)]">Monitoring</span> System</h1>
        <p className={cn(rowEnter, "mt-1.5 whitespace-nowrap text-[0.8438rem] font-medium leading-[1.3] text-[oklch(0.4516_0.0646_265)] [animation-delay:160ms] max-xl:hidden [@media(max-height:49.9375rem)]:hidden")}>Monitor your infrastructure, ensure uptime, and get real-time insights.</p>
      </section>

      <div className="relative z-[1] grid min-h-svh w-full grid-cols-[minmax(0,1fr)_minmax(0,27.5rem)] items-center gap-[clamp(1.5rem,3.2vw,3.625rem)] pb-7 pl-[clamp(2.5rem,10vw,11.25rem)] pr-[5vw] pt-7 min-[61.3125rem]:max-[70rem]:gap-[1.375rem] min-[61.3125rem]:max-[70rem]:pl-[5vw] max-[61.25rem]:min-h-svh max-[61.25rem]:grid-cols-[minmax(0,1fr)] max-[61.25rem]:gap-3 max-[61.25rem]:px-[5vw] max-[61.25rem]:pb-7 max-[61.25rem]:pt-14 max-[35rem]:gap-2 max-[35rem]:pb-[1.375rem] max-[35rem]:pt-[3.25rem]">
        <section aria-labelledby="login-title" className="relative col-[2] w-[min(27.5rem,90vw)] max-w-[27.5rem] animate-card-enter justify-self-end overflow-hidden rounded-[1.25rem] border border-white/55 bg-white/85 shadow-[0_8px_32px_rgba(15,23,42,0.10)] backdrop-blur-lg backdrop-saturate-150 supports-[backdrop-filter:blur(1rem)]:bg-white/40 dark:border-white/10 dark:bg-slate-900/85 dark:supports-[backdrop-filter:blur(1rem)]:bg-slate-900/40 p-7 text-[oklch(0.3295_0.0867_259.49)] motion-reduce:animate-none max-[61.25rem]:col-auto max-[61.25rem]:mx-4 max-[61.25rem]:w-[calc(100%-2rem)] max-[61.25rem]:justify-self-center max-[35rem]:rounded-[1.25rem] max-[35rem]:p-6">
          <div className={cn(contentEnter, "flex items-center gap-2.5 [animation-delay:80ms]")}>
            <span aria-hidden="true" className="grid h-9 w-9 animate-brand-glow place-items-center rounded-[0.625rem] bg-[linear-gradient(145deg,oklch(0.7339_0.1573_237.65)_3%,oklch(0.5443_0.2118_260.56)_54%,oklch(0.3091_0.1193_262.52)_100%)] bg-clip-text text-[2.5rem] font-extrabold italic leading-none text-transparent [filter:drop-shadow(0_5px_9px_rgb(21_101_232/0.21))] motion-reduce:animate-none">N</span>
            <span className="flex flex-col gap-0.5"><strong className="text-[1.125rem] font-extrabold leading-[1.12] tracking-[0.2em] text-[oklch(0.3091_0.1193_262.52)]">NEXUS</strong><small className="text-[0.75rem] font-semibold tracking-[0.015em] text-[oklch(0.6094_0.0542_259.72)]">Infrastructure Monitor</small></span>
          </div>

          <div className={cn(contentEnter, "mb-3.5 mt-[1.125rem] text-left [animation-delay:150ms]")}>
            <h1 id="login-title" className="text-[1.75rem] font-extrabold leading-[1.18] tracking-[-0.035em] text-slate-900 dark:text-slate-100">{t.welcome}</h1>
            <p className="mt-[0.3125rem] text-[0.875rem] font-medium text-[oklch(0.4111_0.0589_265.17)]">{t.subtitle}</p>
          </div>

          <form className={cn(contentEnter, "grid gap-3 [animation-delay:220ms]")} onSubmit={submit} noValidate>
            <div className="grid gap-[0.4375rem]">
              <label htmlFor="nexus-email" className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">{t.email}</label>
              <div className={inputShell(Boolean(errors.email))}>
                <Mail size={18} aria-hidden="true" />
                <input id="nexus-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: "" })); }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "nexus-email-error" : undefined} placeholder="you@company.com" className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[0.875rem] text-[oklch(0.3308_0.0843_257.71)] outline-0 [caret-color:oklch(0.3308_0.0843_257.71)] [color-scheme:light] placeholder:text-[oklch(0.7591_0.0327_257.25)] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_rgb(255_255_255/0.82)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:oklch(0.3308_0.0843_257.71)] [&:-webkit-autofill]:[caret-color:oklch(0.3308_0.0843_257.71)] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]" />
              </div>
              {errors.email && <p className="text-[0.75rem] font-semibold text-[oklch(0.5621_0.1737_17.46)]" id="nexus-email-error" role="alert">{errors.email}</p>}
            </div>

            <div className="grid gap-[0.4375rem]">
              <label htmlFor="nexus-password" className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">{t.password}</label>
              <div className={inputShell(Boolean(errors.password))}>
                <LockKeyhole size={18} aria-hidden="true" />
                <input id="nexus-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: "" })); }} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "nexus-password-error" : undefined} placeholder="Enter your password" className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[0.875rem] text-[oklch(0.3308_0.0843_257.71)] outline-0 [caret-color:oklch(0.3308_0.0843_257.71)] [color-scheme:light] placeholder:text-[oklch(0.7591_0.0327_257.25)] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_rgb(255_255_255/0.82)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:oklch(0.3308_0.0843_257.71)] [&:-webkit-autofill]:[caret-color:oklch(0.3308_0.0843_257.71)] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]" />
                <button type="button" className={cn("-me-[0.4375rem] grid h-[1.875rem] w-[1.875rem] cursor-pointer place-items-center rounded-[0.4375rem] text-[oklch(0.6152_0.0513_258.35)] transition-colors hover:bg-[oklch(0.9678_0.0153_257.2)] hover:text-[oklch(0.5443_0.2118_260.56)]", focusOutline)} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t.hidePassword : t.showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {errors.password && <p className="text-[0.75rem] font-semibold text-[oklch(0.5621_0.1737_17.46)]" id="nexus-password-error" role="alert">{errors.password}</p>}
            </div>

            <div className="-mt-0.5 flex items-center justify-end gap-3">
              <button type="button" className={cn("cursor-pointer py-[0.125rem] text-[0.75rem] font-bold text-slate-800 hover:text-slate-950 dark:text-slate-100 hover:underline", focusOutline)} onClick={() => setActionStatus(t.forgotStatus)}>{t.forgot}</button>
            </div>

            <button type="submit" disabled={isSubmitting} className={cn("relative mt-0.5 flex min-h-12 w-full animate-button-shine cursor-pointer items-center justify-center gap-[0.5625rem] overflow-hidden rounded-[0.6875rem] border-0 bg-[linear-gradient(105deg,oklch(0.5443_0.2118_260.56)_0%,oklch(0.6257_0.1899_253.97)_55%,oklch(0.7339_0.1573_237.65)_100%)] text-[0.875rem] font-extrabold text-white shadow-[0_9px_20px_rgb(21_101_232/0.23)] transition-[transform,box-shadow] duration-150 after:pointer-events-none after:absolute after:inset-0 after:translate-x-[-130%] after:animate-button-glint after:bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.3)_50%,transparent_65%)] after:content-[''] hover:-translate-y-px hover:shadow-[0_12px_24px_rgb(21_101_232/0.28)] active:translate-y-0 disabled:cursor-wait disabled:opacity-[0.88] motion-reduce:animate-none after:motion-reduce:hidden", focusOutline)}>
              {isSubmitting ? <LoaderCircle size={19} className="animate-[spin_700ms_linear_infinite]" aria-hidden="true" /> : <><UserRound size={18} aria-hidden="true" />{t.signIn}<ArrowRight size={18} className="absolute end-[1.125rem]" aria-hidden="true" /></>}
              {isSubmitting && <span>{t.signingIn}</span>}
            </button>
          </form>

          <div className={cn(contentEnter, "mb-2 mt-3 flex items-center gap-3 text-[0.75rem] font-semibold text-[oklch(0.4111_0.0589_265.17)] [animation-delay:280ms]")}><span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,oklch(0.9049_0.0282_263.43))]" />{t.or}<span className="h-px flex-1 bg-[linear-gradient(90deg,oklch(0.9049_0.0282_263.43),transparent)]" /></div>

          <div className={cn(contentEnter, "grid grid-cols-2 gap-3 [animation-delay:400ms]")}>
            <button type="button" className={cn("grid min-h-10 cursor-pointer place-items-center rounded-[0.625rem] border border-[oklch(0.9063_0.022_256.74)] bg-white/70 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[oklch(0.8399_0.0504_258.72)] hover:bg-white", focusOutline)} aria-label={t.google} title={t.google} onClick={() => providerStatus("Google")}><GoogleMark /></button>
            <button type="button" className={cn("grid min-h-10 cursor-pointer place-items-center rounded-[0.625rem] border border-[oklch(0.9063_0.022_256.74)] bg-white/70 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[oklch(0.8399_0.0504_258.72)] hover:bg-white", focusOutline)} aria-label={t.microsoft} title={t.microsoft} onClick={() => providerStatus("Microsoft")}><MicrosoftMark /></button>
          </div>

          <p className="mb-0 mt-2 text-center text-[0.8125rem] leading-[1.35] text-[oklch(0.4111_0.0589_265.17)]">Need help signing in? <button type="button" className="cursor-pointer font-bold text-slate-800 hover:text-slate-950 dark:text-slate-100 hover:underline focus-visible:outline focus-visible:outline-[0.125rem] focus-visible:outline-offset-2 focus-visible:outline-[rgb(21_101_232/0.45)]" onClick={() => setActionStatus(t.supportStatus)}>Contact support</button></p>
          <p className="mb-0 mt-[0.3125rem] flex items-center justify-center gap-1.5 text-[0.75rem] leading-[1.3] text-[oklch(0.4111_0.0589_265.17)]"><LockKeyhole size={13} className="shrink-0" aria-hidden="true" />Encrypted connection. Your data is protected.</p>
          {status && <div className={cn(contentEnter, "mt-2 text-center text-[0.75rem] font-semibold leading-[1.4] text-[oklch(0.507_0.0948_164.53)] [animation-delay:360ms]")} role="status" aria-live="polite">{status}</div>}
        </section>
      </div>

    </main>
  );
}
