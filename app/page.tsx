import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <main className="flex flex-col items-center justify-center gap-8 px-8 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-foreground">
          Job Picks
        </h1>
        <p className="max-w-md text-lg leading-8 text-foreground/70">
          Find the perfect job for you
        </p>
        <Link
          href="/home"
          className="h-12 rounded-full bg-foreground px-8 text-background transition-colors hover:opacity-90 flex items-center justify-center"
        >
          Start
        </Link>
      </main>
    </div>
  );
}
