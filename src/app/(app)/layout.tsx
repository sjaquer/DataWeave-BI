export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background">
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
