import Image from "next/image";

import { APP_CONFIG } from "@/config/app-config";
import { FtgLogo } from "@/components/ftg-logo";

import { LoginForm } from "../../_components/login-form";

export default function LoginV2() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-3 px-6 pt-6">
        <Image
          src="/inuka-logo.png"
          alt="Inuka Pulse Logo"
          width={44}
          height={44}
          className="object-contain rounded-lg"
        />
        <div>
          <h2 className="font-bold text-lg leading-tight">{APP_CONFIG.name}</h2>
          <p className="text-muted-foreground text-xs">Beneficiary Intelligence Platform</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[360px] space-y-8">
          <div className="space-y-1 text-center">
            <h1 className="font-semibold text-2xl tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">Sign in to access the Inuka Foundation dashboard.</p>
          </div>

          <LoginForm />

          {/* Credentials hint — remove before production */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/70">Demo credentials</p>
            <p>Email: <span className="font-mono">admin@inuka.org</span></p>
            <p>Password: <span className="font-mono">sentinel@admin</span></p>
          </div>

          <div className="flex items-center gap-3 border-t pt-4">
            <p className="w-4/5 text-muted-foreground text-xs leading-relaxed">
              Developed by <span className="font-medium text-foreground">FTG</span> — Future • Technology • Growth
            </p>
            <div className="w-1/5 flex justify-end">
              <FtgLogo className="h-5 w-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
