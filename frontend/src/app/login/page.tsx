"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { MonitorIcon } from "@/components/ui/monitor-icon";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { AnimatedBackground } from "@/components/ui/animated-background";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) await register(email, password, displayName);
      else await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <AnimatedBackground />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="relative z-10 w-full max-w-[340px]"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease }}
          className="mb-6 text-center"
        >
          <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-accent">
            <MonitorIcon className="h-4 w-4 text-accentFg" />
          </div>
          <h1 className="text-base font-semibold text-fg">Monitor</h1>
          <p className="mt-0.5 text-xs text-fgMuted">Application health monitoring</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease }}
          className="rounded-lg border border-border bg-surface/80 p-5 backdrop-blur-sm"
        >
          <h2 className="text-[13px] font-semibold text-fg">{isRegister ? "Create account" : "Sign in"}</h2>
          <p className="mt-0.5 text-xs text-fgMuted">{isRegister ? "Set up your profile." : "Enter your credentials."}</p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {isRegister && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.2 }}>
                <TextField label="Display name" name="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoComplete="name" />
              </motion.div>
            )}
            <TextField label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <TextField label="Password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={isRegister ? "new-password" : "current-password"} />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md bg-danger/10 px-2.5 py-2 text-xs text-danger"
                role="alert"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" variant="primary" size="md" className="w-full" loading={loading}>
              {loading ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 border-t border-border pt-4 text-center">
            <button type="button" onClick={() => { setIsRegister(!isRegister); setError(""); }} className="text-xs font-medium text-accent hover:underline">
              {isRegister ? "Already have an account? Sign in" : "Need an account? Register"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
