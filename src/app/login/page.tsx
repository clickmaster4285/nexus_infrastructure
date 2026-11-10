"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, UserRound, LoaderCircle } from "lucide-react";
import styles from "./page.module.css";

const t = {
  welcome: "Welcome Back!",
  subtitle: "Sign in to your Nexus account",
  email: "Email Address",
  password: "Password",
  remember: "Remember Me",
  forgot: "Forgot Password?",
  signIn: "Sign In",
  signingIn: "Signing in…",
  or: "Or continue with",
  google: "Google",
  microsoft: "Microsoft",
  emailError: "Enter a valid email address.",
  passwordError: "Password must be at least 8 characters.",
  forgotStatus: "Password recovery is not connected in this demo. Contact your administrator.",
  supportStatus: "Contact support is not connected in this demo.",
  providerStatus: "{provider} sign-in is not connected in this demo.",
  invalidEmail: "Enter your email address.",
  showPassword: "Show password",
  hidePassword: "Hide password",
};

const rememberedEmailKey = "nexus-remembered-email";

function GoogleMark() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className={styles.providerMark}><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z"/><path fill="#FF3D00" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z"/><path fill="#4CAF50" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2Z"/><path fill="#1976D2" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;
}

function MicrosoftMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.providerMark}><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M13 1h10v10H13z"/><path fill="#00a4ef" d="M1 13h10v10H1z"/><path fill="#ffb900" d="M13 13h10v10H13z"/></svg>;
}

export default function LoginPage() {
  const router = useRouter();
  const illustrationVideoRef = useRef<HTMLVideoElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    router.prefetch("/executive-overview");
    try {
      const savedEmail = window.localStorage.getItem(rememberedEmailKey);
      if (savedEmail) {
        setEmail(savedEmail);
        setRemember(true);
      }
    } catch {
      // Storage may be disabled in private browsing; the form still works without it.
    }
  }, []);

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
    const nextErrors = {
      email: !email.trim() ? t.invalidEmail : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? t.emailError : "",
      password: password.length < 8 ? t.passwordError : "",
    };
    setErrors(nextErrors);
    setStatus("");
    if (nextErrors.email || nextErrors.password) return;

    try {
      if (remember) window.localStorage.setItem(rememberedEmailKey, email.trim());
      else window.localStorage.removeItem(rememberedEmailKey);
    } catch {
      // Remembering is optional and must never block a demo sign-in.
    }

    setIsSubmitting(true);
    router.push("/executive-overview");
  };

  const providerStatus = (provider: string) => setActionStatus(t.providerStatus.replace("{provider}", provider));

  return (
    <main className={styles.page}>
      <div className={styles.illustrationScene} aria-hidden="true">
        <video
          ref={illustrationVideoRef}
          className={styles.illustrationVideo}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/Futuristic%20Cloud%20Monitoring%20Infrastructure%20(1).png"
          tabIndex={-1}
        >
          <source src="/hailuo-03_NEXUS_ADVANCED_ENTERPRISE_INFRASTRUCTURE_MONITORING_ANIMATION_Create_an_extremel-0.mp4" type="video/mp4" />
        </video>
      </div>

      <section className={styles.heroIntro} aria-label="Nexus infrastructure monitoring">
        <div className={`${styles.heroRow} ${styles.heroStatus}`}>
          <i aria-hidden="true" />
          <span>System Online</span>
          <b aria-hidden="true" />
          <span>All Services Operational</span>
        </div>
        <h1 className={`${styles.heroRow} ${styles.heroHeading}`}>Infrastructure <span>Monitoring</span> System</h1>
        <p className={`${styles.heroRow} ${styles.heroDescription}`}>Monitor your infrastructure, ensure uptime, and get real-time insights.</p>
      </section>

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="login-title">
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">N</span>
            <span className={styles.brandCopy}><strong>NEXUS</strong><small>Infrastructure Monitor</small></span>
          </div>

          <div className={styles.heading}>
            <h1 id="login-title">{t.welcome}</h1>
            <p>{t.subtitle}</p>
          </div>

          <form className={styles.form} onSubmit={submit} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="nexus-email">{t.email}</label>
              <div className={`${styles.inputShell} ${errors.email ? styles.invalid : ""}`}>
                <Mail size={18} aria-hidden="true" />
                <input id="nexus-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: "" })); }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "nexus-email-error" : undefined} placeholder="you@company.com" />
              </div>
              {errors.email && <p className={styles.error} id="nexus-email-error" role="alert">{errors.email}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="nexus-password">{t.password}</label>
              <div className={`${styles.inputShell} ${errors.password ? styles.invalid : ""}`}>
                <LockKeyhole size={18} aria-hidden="true" />
                <input id="nexus-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: "" })); }} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "nexus-password-error" : undefined} placeholder="Enter your password" />
                <button type="button" className={styles.iconButton} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t.hidePassword : t.showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {errors.password && <p className={styles.error} id="nexus-password-error" role="alert">{errors.password}</p>}
            </div>

            <div className={styles.formOptions}>
              <label className={styles.remember}><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span className={styles.customCheck} aria-hidden="true"><CheckCircle2 size={13} /></span>{t.remember}</label>
              <button type="button" className={styles.textAction} onClick={() => setActionStatus(t.forgotStatus)}>{t.forgot}</button>
            </div>

            <button type="submit" className={styles.submit} disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle size={19} className={styles.spinner} aria-hidden="true" /> : <><UserRound size={18} aria-hidden="true" />{t.signIn}<ArrowRight size={18} className={styles.submitArrow} aria-hidden="true" /></>}
              {isSubmitting && <span>{t.signingIn}</span>}
            </button>
          </form>

          <div className={styles.orDivider}><span />{t.or}<span /></div>

          <div className={styles.providers}>
            <button type="button" className={styles.providerButton} aria-label={t.google} title={t.google} onClick={() => providerStatus("Google")}><GoogleMark /></button>
            <button type="button" className={styles.providerButton} aria-label={t.microsoft} title={t.microsoft} onClick={() => providerStatus("Microsoft")}><MicrosoftMark /></button>
          </div>

          <p className={styles.supportLine}>Need help signing in? <button type="button" className={styles.supportLink} onClick={() => setActionStatus(t.supportStatus)}>Contact support</button></p>
          <p className={styles.protectionLine}><LockKeyhole size={13} aria-hidden="true" />Encrypted connection. Your data is protected.</p>
          {status && <div className={styles.status} role="status" aria-live="polite" data-visible={Boolean(status)}>{status}</div>}
        </section>
      </div>

    </main>
  );
}
