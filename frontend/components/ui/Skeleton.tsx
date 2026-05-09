export function Skeleton({
  width,
  height,
  variant = "line",
  style,
}: {
  width?: number | string;
  height?: number | string;
  variant?: "line" | "line-lg" | "block";
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${variant}`} style={{ width, height, ...style }} />;
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="stack">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="block" />
      ))}
    </div>
  );
}
