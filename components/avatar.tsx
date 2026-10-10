import { initials } from "@/lib/format";

export function Avatar({
  name,
  avatar,
  size
}: {
  name: string;
  avatar?: string | null;
  size?: "md" | "lg";
}) {
  const hue = name ? name.charCodeAt(0) % 5 : 0;
  return (
    <span className={`avatar${size === "lg" ? " lg" : ""}`} data-hue={hue}>
      {avatar ?? initials(name)}
    </span>
  );
}
