import { Skeleton } from "@/components/ui/feedback";

export default function DicasLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton className="aspect-[4/5] w-full" key={index} />
        ))}
      </div>
    </div>
  );
}
