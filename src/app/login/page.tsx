"use client";

import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, BarChart3, Cloud, Eye, EyeOff,
  LockKeyhole, Mail, PanelsTopLeft, Server, ShieldCheck, UserRound,
} from "lucide-react";

const AnimatedGlobe = dynamic(() => import("@/components/auth/animated-globe").then((module) => module.AnimatedGlobe), {
  ssr: false,
  loading: () => <div className="login-globe-placeholder absolute" aria-hidden="true" />,
});

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`relative grid place-items-center ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 72" className="absolute inset-0 h-full w-full fill-none" role="presentation">
        <path d="M32 3 58 14v20c0 16-10 27-26 35C16 61 6 50 6 34V14L32 3Z" stroke="url(#brandStroke)" strokeWidth="4" />
        <defs><linearGradient id="brandStroke" x1="5" y1="10" x2="57" y2="60" gradientUnits="userSpaceOnUse"><stop stopColor="#8aeaff" /><stop offset=".5" stopColor="#3289ff" /><stop offset="1" stopColor="#144cff" /></linearGradient></defs>
      </svg>
      <Server className="relative h-[38%] w-[38%] text-[#8beaff] drop-shadow-[0_0_9px_#3a9bff]" strokeWidth={2.5} />
    </span>
  );
}

function InfrastructureScene() {
  return (
    <div className="login-scene absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="login-grid absolute inset-0 opacity-40" />
      <div className="login-scene-glow absolute inset-0" />
      <AnimatedGlobe />
      <div className="login-rack login-rack-left absolute bottom-[12%] left-[-3%] top-[29%] w-[14%]" />
      <div className="login-rack login-rack-right absolute bottom-[12%] right-[-3%] top-[27%] w-[13%]" />
      <div className="login-floor absolute bottom-0 left-0 right-0 h-[27%]" />
      <div className="login-float login-float-one login-stat login-stat-network absolute hidden w-[180px] rounded-xl border border-blue-400/40 bg-[#06183ab8] p-3 shadow-[0_0_28px_#126bff26] backdrop-blur-md sm:block">
        <div className="mb-2 flex items-center gap-2 text-[10px] text-blue-100/75"><Activity size={13} className="text-cyan-300" /> Network Health</div>
        <div className="flex items-end justify-between"><strong className="font-display text-[21px] text-white">99.8%</strong><span className="flex items-center text-[10px] text-emerald-300"><ArrowRight className="-rotate-45" size={12} /> 0.2%</span></div>
        <svg viewBox="0 0 150 25" className="mt-2 h-6 w-full"><path d="M0 21 18 13 31 19 47 5 65 14 78 9 97 17 113 4 127 12 150 2" fill="none" stroke="#42b8ff" strokeWidth="2" /></svg>
      </div>
      <div className="login-float login-float-two login-stat login-stat-devices absolute hidden w-[168px] rounded-xl border border-blue-400/40 bg-[#06183ab8] p-3 shadow-[0_0_28px_#126bff26] backdrop-blur-md md:block">
        <div className="mb-2 flex items-center gap-2 text-[10px] text-blue-100/75"><Server size={13} className="text-blue-300" /> Active Devices</div>
        <div className="flex items-center gap-2"><strong className="font-display text-[21px] text-white">1,248</strong><span className="text-[10px] text-emerald-300">▲ 12%</span></div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-blue-950"><span className="block h-full w-[78%] rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" /></div>
      </div>
      <div className="login-float login-float-three login-stat login-stat-centers absolute hidden w-[150px] rounded-xl border border-blue-400/40 bg-[#06183ab8] p-3 shadow-[0_0_28px_#126bff26] backdrop-blur-md min-[1100px]:block">
        <div className="mb-1 flex items-center gap-2 text-[10px] text-blue-100/75"><PanelsTopLeft size={13} className="text-cyan-300" /> Data Centers</div>
        <strong className="font-display text-[21px] text-white">12</strong><span className="ml-2 text-[10px] text-emerald-300">▲ 2 online</span>
      </div>
      <div className="login-float login-float-four login-stat login-stat-uptime absolute hidden w-[150px] rounded-xl border border-blue-400/40 bg-[#06183ab8] p-3 shadow-[0_0_28px_#126bff26] backdrop-blur-md min-[1100px]:block">
        <div className="mb-1 flex items-center gap-2 text-[10px] text-blue-100/75"><Activity size={13} className="text-blue-300" /> Uptime</div>
        <strong className="font-display text-[21px] text-white">99.9%</strong><span className="ml-2 text-[10px] text-emerald-300">▲ stable</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [notice, setNotice] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recoveryMode) {
      setNotice("Password reset delivery is not connected in this demo. Please contact your administrator.");
      return;
    }
    setNotice("Opening the Nexus demo workspace…");
    window.setTimeout(() => router.push("/executive-overview"), 450);
  }

  return (
    <main className="login-page grid min-h-screen overflow-hidden min-[1100px]:grid-cols-2">
      <section className="login-left relative flex min-h-[530px] flex-col overflow-hidden min-[1100px]:min-h-screen" aria-label="Animated Nexus infrastructure globe">
        <InfrastructureScene />
        <div className="login-vignette absolute inset-0" />
        <header className="relative z-10 flex items-center justify-between py-5 pr-5 sm:pr-9 lg:pr-10 xl:pr-14">
          <a href="/login" className="flex items-center gap-3" aria-label="Nexus Infrastructure Monitor home">
            <BrandMark className="h-12 w-11 shrink-0 sm:h-14 sm:w-12" />
            <span><span className="block font-display text-[17px] font-extrabold leading-tight tracking-tight text-white sm:text-[21px]">NEXUS</span><span className="mt-0.5 block text-[10px] text-blue-100/75 sm:text-[12px]">Infrastructure Monitor</span></span>
          </a>
          <div className="hidden items-center gap-2 rounded-full border border-blue-300/20 bg-[#071633]/65 px-3 py-2 text-[10px] text-blue-100/80 backdrop-blur-md sm:flex"><i className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_#22c55e]" />System Online</div>
        </header>
        <div className="relative z-10 mx-auto mt-auto flex w-full max-w-[610px] items-center justify-between gap-2 border-t border-blue-300/15 py-4 text-[9px] text-blue-100/80 sm:text-[10px] min-[1100px]:mb-2">
          <div className="flex items-center gap-1.5 sm:gap-2"><ShieldCheck size={18} className="shrink-0 text-cyan-300" /><span>Secure<br />Access</span></div><span className="h-8 w-px bg-blue-200/15" />
          <div className="flex items-center gap-1.5 sm:gap-2"><Activity size={18} className="shrink-0 text-cyan-300" /><span>Real-Time<br />Monitoring</span></div><span className="h-8 w-px bg-blue-200/15" />
          <div className="flex items-center gap-1.5 sm:gap-2"><BarChart3 size={18} className="shrink-0 text-cyan-300" /><span>Smart<br />Analytics</span></div><span className="h-8 w-px bg-blue-200/15" />
          <div className="flex items-center gap-1.5 sm:gap-2"><Cloud size={18} className="shrink-0 text-cyan-300" /><span>Scalable<br />Infrastructure</span></div>
        </div>
      </section>

      <section className="login-right relative flex min-h-[680px] items-center justify-center bg-[#f5f7fb] px-5 py-16 text-[#15243b] sm:px-10 min-[1100px]:min-h-screen min-[1100px]:px-12">
        <div className="login-form-wrap w-full max-w-[400px]">
          <div className="mb-7 flex items-center justify-center gap-3">
            <BrandMark className="h-[54px] w-[48px]" />
            <span><b className="block font-display text-[17px] font-extrabold tracking-[.12em] text-[#15243b]">NEXUS</b><span className="block text-[10px] tracking-[.08em] text-[#667891]">INFRASTRUCTURE MONITOR</span></span>
          </div>
          <div className="mb-7 text-center"><h1 className="font-display text-[29px] font-extrabold tracking-tight text-[#15243b]">{recoveryMode ? "Reset Password" : <>Welcome <span className="text-[#287ff0]">Back</span></>}</h1><p className="mt-1 text-[12px] text-[#6d7d94] sm:text-[13px]">{recoveryMode ? "Enter your work email to request a password reset" : "Sign in to your infrastructure"}</p></div>

          <form onSubmit={submit} className="space-y-3.5">
            <label className="login-input-wrap flex h-[60px] items-center overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-[0_2px_8px_rgba(21,36,59,.03)] transition focus-within:border-[#6aa5f7] focus-within:ring-2 focus-within:ring-[#287ff0]/10">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf2ff] text-[#287ff0] ml-2"><UserRound size={18} /></span>
              <span className="min-w-0 flex-1 px-3"><span className="block text-[9px] font-semibold text-[#465b78]">Email</span><input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" aria-label="Email address" suppressHydrationWarning className="mt-0.5 h-5 w-full bg-transparent text-[12px] text-[#15243b] outline-none placeholder:text-[#8a99ad]" /></span>
            </label>
            {!recoveryMode && <label className="login-input-wrap flex h-[60px] items-center overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-[0_2px_8px_rgba(21,36,59,.03)] transition focus-within:border-[#6aa5f7] focus-within:ring-2 focus-within:ring-[#287ff0]/10">
              <span className="ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf2ff] text-[#287ff0]"><LockKeyhole size={18} /></span>
              <span className="min-w-0 flex-1 px-3"><span className="block text-[9px] font-semibold text-[#465b78]">Password</span><input type={showPassword ? "text" : "password"} required autoComplete="current-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" aria-label="Password" className="mt-0.5 h-5 w-full bg-transparent text-[12px] text-[#15243b] outline-none placeholder:text-[#8a99ad]" /></span>
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="mr-3 rounded p-1 text-[#7a8ba3] transition hover:text-[#287ff0]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </label>}

            {!recoveryMode && <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
              <label className="flex cursor-pointer items-center gap-2 text-[#536781]"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-[#287ff0]" />Remember me</label>
              <button type="button" onClick={() => { setRecoveryMode(true); setNotice(""); }} className="font-medium text-[#287ff0] transition hover:text-[#155fbd]">Forgot password?</button>
            </div>}
            {recoveryMode && <button type="button" onClick={() => { setRecoveryMode(false); setNotice(""); }} className="text-[11px] font-medium text-[#287ff0] hover:text-[#155fbd]">← Back to sign in</button>}

            <button type="submit" className="login-submit group flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#3475ed] text-[13px] font-bold text-white shadow-[0_8px_20px_#3475ed35] transition duration-300 hover:-translate-y-0.5 hover:bg-[#2566df] hover:shadow-[0_12px_28px_#3475ed55] active:translate-y-0">
              {recoveryMode ? <Mail size={17} /> : <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}{recoveryMode ? "Send Reset Link" : "Sign In"}
            </button>
            {notice && <p role="status" className="rounded-lg border border-[#cbdcf3] bg-[#edf4ff] px-3 py-2 text-center text-[10px] text-[#3d5e88]">{notice}</p>}
          </form>

          <p className="mt-5 text-center text-[9px] leading-relaxed text-[#8290a4]"><ShieldCheck className="mr-1 inline-block h-3 w-3 align-[-2px] text-[#287ff0]" />Secure demo portal · Authentication is not connected in this prototype</p>
          <p className="mt-9 text-center text-[9px] text-[#9aa6b6]">© 2026 Nexus Infrastructure Monitor</p>
        </div>
      </section>
    </main>
  );
}
