export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <main className="flex flex-col items-center justify-center gap-8 px-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Home
        </h1>
        <p className="max-w-md text-lg leading-8 text-foreground/70">
          Welcome to Job Picks
        </p>
      </main>
    </div>
  );
}
