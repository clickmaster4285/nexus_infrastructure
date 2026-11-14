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
const focusOutline = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[rgb(21_101_232/0.3)]";

function GoogleMark() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 shrink-0"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z" /><path fill="#FF3D00" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z" /><path fill="#4CAF50" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z" /><path fill="#1976D2" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z" /></svg>;
}

function MicrosoftMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0"><path fill="#f25022" d="M1 1h10v10H1z" /><path fill="#7fba00" d="M13 1h10v10H13z" /><path fill="#00a4ef" d="M1 13h10v10H1z" /><path fill="#ffb900" d="M13 13h10v10H13z" /></svg>;
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
      "flex min-h-[46px] items-center gap-[11px] rounded-[11px] border px-3.5 text-[#8194b1] transition-[border-color,box-shadow,background] duration-150",
      hasError
        ? "border-[#df5a69] bg-[#fffafb] focus-within:border-[#df5a69] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgb(223_90_105/0.12)]"
        : "border-[#d4dfef] bg-white/85 focus-within:border-[#5a9af5] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgb(21_101_232/0.11)]",
    );

  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[linear-gradient(135deg,#e9f1ff,#dce8ff)] font-jakarta text-[#183461] max-[980px]:overflow-auto">
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#e8f0ff_url(/media/login-poster.png)] bg-cover bg-[position:70%_bottom] bg-no-repeat" aria-hidden="true">
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

      <section aria-label="Nexus infrastructure monitoring" className="pointer-events-none absolute left-1/2 top-[clamp(20px,3vh,36px)] z-[2] w-max max-w-[min(46vw,640px)] -translate-x-1/2 text-center text-[#0b1a3d] before:pointer-events-none before:absolute before:-inset-y-3 before:-inset-x-7 before:z-[-1] before:bg-[radial-gradient(ellipse_at_50%_50%,rgb(255_255_255/0.8)_0%,rgb(255_255_255/0)_70%)] before:content-[''] max-[899px]:hidden [@media(max-height:960px)_and_(min-width:1280px)]:top-5">
        <div className={cn(rowEnter, "mx-auto flex w-max items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#1f6bff]/20 bg-white/85 px-3.5 py-[5px] text-[12px] font-semibold text-[#0b1a3d] [animation-delay:0ms] backdrop-blur-[10px] max-[1099px]:hidden")}>
          <i aria-hidden="true" className="h-[7px] w-[7px] shrink-0 animate-hero-dot-pulse rounded-full bg-[#19a86b] motion-reduce:animate-none" />
          <span>System Online</span>
          <b aria-hidden="true" className="mx-[1px] h-[14px] w-px bg-[#0b1a3d]/20" />
          <span>All Services Operational</span>
        </div>
        <h1 className={cn(rowEnter, "mt-2.5 whitespace-nowrap text-[clamp(24px,2.2vw,32px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#0b1a3d] [animation-delay:80ms] max-[1099px]:text-[22px]")}>Infrastructure <span className="text-[#1f6bff]">Monitoring</span> System</h1>
        <p className={cn(rowEnter, "mt-1.5 whitespace-nowrap text-[13.5px] font-medium leading-[1.3] text-[#44557a] [animation-delay:160ms] max-xl:hidden [@media(max-height:799px)]:hidden")}>Monitor your infrastructure, ensure uptime, and get real-time insights.</p>
      </section>

      <div className="relative z-[1] grid min-h-svh w-full grid-cols-[minmax(0,1fr)_minmax(0,440px)] items-center gap-[clamp(24px,3.2vw,58px)] pb-7 pl-[clamp(40px,10vw,180px)] pr-[5vw] pt-7 min-[981px]:max-[1120px]:gap-[22px] min-[981px]:max-[1120px]:pl-[5vw] max-[980px]:min-h-svh max-[980px]:grid-cols-[minmax(0,1fr)] max-[980px]:gap-3 max-[980px]:px-[5vw] max-[980px]:pb-7 max-[980px]:pt-14 max-[560px]:gap-2 max-[560px]:pb-[22px] max-[560px]:pt-[52px]">
        <section aria-labelledby="login-title" className="relative col-[2] w-[min(440px,90vw)] max-w-[440px] animate-card-enter justify-self-end overflow-hidden rounded-[20px] border border-white/55 bg-white/85 shadow-[0_8px_32px_rgba(15,23,42,0.10)] backdrop-blur-lg backdrop-saturate-150 supports-[backdrop-filter:blur(16px)]:bg-white/40 dark:border-white/10 dark:bg-slate-900/85 dark:supports-[backdrop-filter:blur(16px)]:bg-slate-900/40 p-7 text-[#183461] motion-reduce:animate-none max-[980px]:col-auto max-[980px]:mx-4 max-[980px]:w-[calc(100%-2rem)] max-[980px]:justify-self-center max-[560px]:rounded-[20px] max-[560px]:p-6">
          <div className={cn(contentEnter, "flex items-center gap-2.5 [animation-delay:80ms]")}>
            <span aria-hidden="true" className="grid h-9 w-9 animate-brand-glow place-items-center rounded-[10px] bg-[linear-gradient(145deg,#19b5ff_3%,#1565e8_54%,#0b2a6b_100%)] bg-clip-text text-[40px] font-extrabold italic leading-none text-transparent [filter:drop-shadow(0_5px_9px_rgb(21_101_232/0.21))] motion-reduce:animate-none">N</span>
            <span className="flex flex-col gap-0.5"><strong className="text-[18px] font-extrabold leading-[1.12] tracking-[0.2em] text-[#0b2a6b]">NEXUS</strong><small className="text-[12px] font-semibold tracking-[0.015em] text-[#7084a4]">Infrastructure Monitor</small></span>
          </div>

          <div className={cn(contentEnter, "mb-3.5 mt-[18px] text-left [animation-delay:150ms]")}>
            <h1 id="login-title" className="text-[28px] font-extrabold leading-[1.18] tracking-[-0.035em] text-slate-900 dark:text-slate-100">{t.welcome}</h1>
            <p className="mt-[5px] text-[14px] font-medium text-[#3b4a6b]">{t.subtitle}</p>
          </div>

          <form className={cn(contentEnter, "grid gap-3 [animation-delay:220ms]")} onSubmit={submit} noValidate>
            <div className="grid gap-[7px]">
              <label htmlFor="nexus-email" className="text-[12px] font-bold text-slate-800 dark:text-slate-200">{t.email}</label>
              <div className={inputShell(Boolean(errors.email))}>
                <Mail size={18} aria-hidden="true" />
                <input id="nexus-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: "" })); }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "nexus-email-error" : undefined} placeholder="you@company.com" className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[14px] text-[#173560] outline-0 [caret-color:#173560] [color-scheme:light] placeholder:text-[#a4b2c6] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_rgb(255_255_255/0.82)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#173560] [&:-webkit-autofill]:[caret-color:#173560] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]" />
              </div>
              {errors.email && <p className="text-[12px] font-semibold text-[#c63c4e]" id="nexus-email-error" role="alert">{errors.email}</p>}
            </div>

            <div className="grid gap-[7px]">
              <label htmlFor="nexus-password" className="text-[12px] font-bold text-slate-800 dark:text-slate-200">{t.password}</label>
              <div className={inputShell(Boolean(errors.password))}>
                <LockKeyhole size={18} aria-hidden="true" />
                <input id="nexus-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: "" })); }} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "nexus-password-error" : undefined} placeholder="Enter your password" className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[14px] text-[#173560] outline-0 [caret-color:#173560] [color-scheme:light] placeholder:text-[#a4b2c6] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_rgb(255_255_255/0.82)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#173560] [&:-webkit-autofill]:[caret-color:#173560] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]" />
                <button type="button" className={cn("-me-[7px] grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] text-[#7286a4] transition-colors hover:bg-[#eef5ff] hover:text-[#1565e8]", focusOutline)} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t.hidePassword : t.showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {errors.password && <p className="text-[12px] font-semibold text-[#c63c4e]" id="nexus-password-error" role="alert">{errors.password}</p>}
            </div>

            <div className="-mt-0.5 flex items-center justify-end gap-3">
              <button type="button" className={cn("cursor-pointer py-[2px] text-[12px] font-bold text-slate-800 hover:text-slate-950 dark:text-slate-100 hover:underline", focusOutline)} onClick={() => setActionStatus(t.forgotStatus)}>{t.forgot}</button>
            </div>

            <button type="submit" disabled={isSubmitting} className={cn("relative mt-0.5 flex min-h-12 w-full animate-button-shine cursor-pointer items-center justify-center gap-[9px] overflow-hidden rounded-[11px] border-0 bg-[linear-gradient(105deg,#1565e8_0%,#1787f6_55%,#19b5ff_100%)] text-[14px] font-extrabold text-white shadow-[0_9px_20px_rgb(21_101_232/0.23)] transition-[transform,box-shadow] duration-150 after:pointer-events-none after:absolute after:inset-0 after:translate-x-[-130%] after:animate-button-glint after:bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.3)_50%,transparent_65%)] after:content-[''] hover:-translate-y-px hover:shadow-[0_12px_24px_rgb(21_101_232/0.28)] active:translate-y-0 disabled:cursor-wait disabled:opacity-[0.88] motion-reduce:animate-none after:motion-reduce:hidden", focusOutline)}>
              {isSubmitting ? <LoaderCircle size={19} className="animate-[spin_700ms_linear_infinite]" aria-hidden="true" /> : <><UserRound size={18} aria-hidden="true" />{t.signIn}<ArrowRight size={18} className="absolute end-[18px]" aria-hidden="true" /></>}
              {isSubmitting && <span>{t.signingIn}</span>}
            </button>
          </form>

          <div className={cn(contentEnter, "mb-2 mt-3 flex items-center gap-3 text-[12px] font-semibold text-[#3b4a6b] [animation-delay:280ms]")}><span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,#d6e0f3)]" />{t.or}<span className="h-px flex-1 bg-[linear-gradient(90deg,#d6e0f3,transparent)]" /></div>

          <div className={cn(contentEnter, "grid grid-cols-2 gap-3 [animation-delay:400ms]")}>
            <button type="button" className={cn("grid min-h-10 cursor-pointer place-items-center rounded-[10px] border border-[#d7e1ef] bg-white/70 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[#b7ccec] hover:bg-white", focusOutline)} aria-label={t.google} title={t.google} onClick={() => providerStatus("Google")}><GoogleMark /></button>
            <button type="button" className={cn("grid min-h-10 cursor-pointer place-items-center rounded-[10px] border border-[#d7e1ef] bg-white/70 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[#b7ccec] hover:bg-white", focusOutline)} aria-label={t.microsoft} title={t.microsoft} onClick={() => providerStatus("Microsoft")}><MicrosoftMark /></button>
          </div>

          <p className="mb-0 mt-2 text-center text-[13px] leading-[1.35] text-[#3b4a6b]">Need help signing in? <button type="button" className="cursor-pointer font-bold text-slate-800 hover:text-slate-950 dark:text-slate-100 hover:underline focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-offset-2 focus-visible:outline-[rgb(21_101_232/0.45)]" onClick={() => setActionStatus(t.supportStatus)}>Contact support</button></p>
          <p className="mb-0 mt-[5px] flex items-center justify-center gap-1.5 text-[12px] leading-[1.3] text-[#3b4a6b]"><LockKeyhole size={13} className="shrink-0" aria-hidden="true" />Encrypted connection. Your data is protected.</p>
          {status && <div className={cn(contentEnter, "mt-2 text-center text-[12px] font-semibold leading-[1.4] text-[#207657] [animation-delay:360ms]")} role="status" aria-live="polite">{status}</div>}
        </section>
      </div>

    </main>
  );
}
