import { cn } from "@/lib/utils";

export function LearnerAvatar({
  name,
  hue = 210,
  size = 32,
  className,
  ring,
}: {
  name: string;
  hue?: number;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        ring && "ring-2 ring-card",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: `linear-gradient(140deg, hsl(${hue} 55% 88%), hsl(${(hue + 40) % 360} 58% 76%))`,
        color: `hsl(${hue} 55% 24%)`,
      }}
    >
      {initials}
    </span>
  );
}
