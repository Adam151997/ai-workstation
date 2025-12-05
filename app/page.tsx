// app/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Cpu, Zap, Shield, Workflow, ArrowRight, Sparkles } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  // If user is logged in, go straight to workstation
  if (userId) {
    redirect("/workstation");
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-primary)' }}>
      {/* Hero Section */}
      <section className="relative flex items-center justify-center overflow-hidden"
        style={{ minHeight: 'calc(100vh - 64px - 200px)', padding: '4rem 2rem' }}>
        
        {/* Background Gradient */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 50% 0%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 40%),
              radial-gradient(ellipse at 20% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 40%)
            `
          }} />
        
        <div className="relative text-center max-w-[800px] z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-lg border font-display text-[11px] font-semibold tracking-widest"
            style={{ background: 'var(--accent-muted)', borderColor: 'var(--border-accent)', color: 'var(--accent-primary)' }}>
            <Sparkles className="w-3 h-3" />
            <span>POWERED BY AI</span>
          </div>
          
          {/* Title */}
          <h1 className="font-display font-bold tracking-wide mb-6"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', lineHeight: 1.1, color: 'var(--text-primary)' }}>
            AI WORKSTATION
            <span className="block"
              style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              OS
            </span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg mb-10 mx-auto" style={{ color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: 1.7 }}>
            Your production-ready environment for AI Agents. 
            Build, deploy, and scale intelligent workflows with enterprise-grade reliability.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4 mb-12 flex-wrap">
            <Link href="/sign-in" 
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg font-display text-sm font-semibold tracking-wide text-white transition-all hover:-translate-y-0.5"
              style={{ 
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-intense))',
                boxShadow: 'var(--shadow-md), 0 0 20px var(--accent-glow)',
                textDecoration: 'none',
              }}>
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/sign-up"
              className="inline-flex items-center px-7 py-3.5 rounded-lg border font-display text-sm font-semibold tracking-wide transition-all hover:bg-[var(--surface-hover)] hover:border-[var(--accent-primary)]"
              style={{ 
                background: 'transparent',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
              }}>
              Create Account
            </Link>
          </div>

          {/* Stats */}
          <div className="inline-flex items-center gap-8 px-8 py-6 rounded-xl border"
            style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
            <div className="flex flex-col items-center gap-1">
              <span className="font-data text-3xl font-bold" style={{ color: 'var(--accent-primary)' }}>127+</span>
              <span className="font-display text-[11px] font-medium tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>AI Tools</span>
            </div>
            <div className="w-px h-10" style={{ background: 'var(--border-primary)' }} />
            <div className="flex flex-col items-center gap-1">
              <span className="font-data text-3xl font-bold" style={{ color: 'var(--accent-primary)' }}>3</span>
              <span className="font-display text-[11px] font-medium tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>Agent Modes</span>
            </div>
            <div className="w-px h-10" style={{ background: 'var(--border-primary)' }} />
            <div className="flex flex-col items-center gap-1">
              <span className="font-data text-3xl font-bold" style={{ color: 'var(--accent-primary)' }}>∞</span>
              <span className="font-display text-[11px] font-medium tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>Possibilities</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-8 py-16 border-t" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1.5 mb-4 rounded border font-display text-[10px] font-semibold tracking-[0.15em]"
            style={{ background: 'var(--accent-muted)', borderColor: 'var(--border-accent)', color: 'var(--accent-primary)' }}>
            CAPABILITIES
          </span>
          <h2 className="font-display text-3xl font-bold m-0" style={{ color: 'var(--text-primary)' }}>
            Built for Enterprise
          </h2>
        </div>

        <div className="grid gap-6 max-w-[1200px] mx-auto"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          
          {[
            { icon: Cpu, title: 'Multi-Agent Modes', desc: 'Switch between Sales, Marketing, and Admin modes with specialized toolkits for each workflow.' },
            { icon: Workflow, title: 'Visual Workflows', desc: 'Build complex AI automation pipelines with our intuitive drag-and-drop workflow builder.' },
            { icon: Zap, title: 'Real-time Artifacts', desc: 'Generate documents, charts, tables, and presentations instantly with smart AI generation.' },
            { icon: Shield, title: 'Enterprise Security', desc: 'Full audit trail, role-based access, and compliance-ready infrastructure out of the box.' },
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-xl border transition-all hover:-translate-y-0.5 hover:border-[var(--border-accent)]"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-center w-12 h-12 mb-5 rounded-lg border"
                style={{ background: 'var(--accent-muted)', borderColor: 'var(--border-accent)', color: 'var(--accent-primary)' }}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display text-base font-semibold mb-3 m-0" style={{ color: 'var(--text-primary)' }}>
                {feature.title}
              </h3>
              <p className="text-sm m-0" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
