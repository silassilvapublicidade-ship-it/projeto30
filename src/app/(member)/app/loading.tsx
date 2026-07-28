import { Skeleton } from "@/components/ui/feedback";

export default function AppLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-4xl gap-5">
        <Skeleton className="h-16 rounded-[1.35rem]" />
        <Skeleton className="h-72 rounded-[2rem]" />
        <Skeleton className="h-28 rounded-[1.35rem]" />
      </div>
    </main>
  );
}
