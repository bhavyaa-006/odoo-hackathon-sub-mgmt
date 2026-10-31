export const Skeleton = ({ className = '', rounded = 'rounded-md', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-[#4B6584]/15 ${rounded} ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};

export const CardSkeleton = () => (
  <div className="bg-white rounded-xl border border-[#4B6584]/20 p-6 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="h-8 w-36" />
    <Skeleton className="h-3 w-48" />
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded-xl border border-[#4B6584]/20 overflow-hidden">
    <div className="p-4 border-b border-[#4B6584]/10 bg-[#F5F5F5]/60 flex items-center justify-between">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48 rounded-lg" />
    </div>
    <div className="divide-y divide-[#4B6584]/10 p-2">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="py-3 px-4 flex items-center justify-between gap-4">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={`h-4 ${cIdx === 0 ? 'w-24' : cIdx === 1 ? 'w-36' : 'w-20'}`}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default Skeleton;
