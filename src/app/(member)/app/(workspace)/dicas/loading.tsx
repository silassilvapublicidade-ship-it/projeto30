import { Skeleton } from "@/components/ui/feedback";

export default function DicasLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-56" key={index} />
        ))}
      </div>
    </div>
  );
}
