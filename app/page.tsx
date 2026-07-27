import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-ink text-white flex flex-col">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Left — pitch */}
        <section className="flex flex-col justify-center px-6 sm:px-14 py-14 sm:py-16 max-w-xl">
          <div className="flex items-center gap-3 mb-8 sm:mb-10">
            <span className="clapper-stripe h-8 w-8 rounded-md" />
            <span className="font-display text-xl font-extrabold tracking-tight">
              Cinema Paiyan
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[0.98] sm:leading-[0.95] tracking-tight">
            Every campaign
            <br />
            beat, on the
            <br />
            <span className="text-amber">calendar.</span>
          </h1>

          <p className="text-white/60 text-base sm:text-lg mt-5 sm:mt-6 leading-relaxed">
            Plan each film&apos;s release timeline in one clean grid — teasers,
            single drops, press, release day. Every dated event syncs straight to
            your Google Calendar, with reminders before each one.
          </p>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
            className="mt-10"
          >
            <button
              type="submit"
              className="inline-flex items-center gap-3 bg-white text-ink rounded-xl px-6 py-3.5 font-medium hover:bg-amber transition-colors"
            >
              <GoogleIcon />
              Sign in with Google
            </button>
          </form>

          <p className="text-white/35 text-sm mt-5 max-w-sm">
            Signing in connects your Google Calendar in the same step — no
            separate setup, no password to manage.
          </p>
        </section>

        {/* Right — a mock timeline (the signature) */}
        <section className="hidden lg:flex items-center justify-center bg-ink-soft border-l border-ink-line p-12">
          <div className="w-full max-w-md">
            <div className="text-xs uppercase tracking-widest text-white/30 mb-4">
              KS 10 — release timeline
            </div>
            <ol className="relative border-l border-ink-line ml-2">
              {[
                { m: "AUG", d: "04", t: "Title teaser", c: "#E8A317" },
                { m: "AUG", d: "15", t: "First single — release", c: "#12A594" },
                { m: "SEP", d: "23", t: "Trailer launch event", c: "#8B5CF6" },
                { m: "OCT", d: "01", t: "Press show", c: "#3E63DD" },
                { m: "OCT", d: "03", t: "In cinemas", c: "#E5484D" },
              ].map((e, i) => (
                <li key={i} className="relative pl-6 pb-6 last:pb-0">
                  <span
                    className="absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ring-ink-soft"
                    style={{ backgroundColor: e.c }}
                  />
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-1">
                      <span className="text-[10px] font-semibold text-amber">
                        {e.m}
                      </span>
                      <span className="font-display font-bold">{e.d}</span>
                    </span>
                    <span className="text-white/80">{e.t}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
