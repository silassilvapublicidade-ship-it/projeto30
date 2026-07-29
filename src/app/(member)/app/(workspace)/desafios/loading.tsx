import { Skeleton } from "@/components/ui/feedback";

export default function DesafiosLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-72" key={index} />
        ))}
      </div>
    </div>
  );
}
