type BrandLogoProps = {
  size?: "sm" | "md";
};

export function BrandLogo({ size = "md" }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* Subtle Ghana flag-inspired 3-bar mark */}
      <span
        aria-hidden="true"
        className="flex h-5 w-1.5 flex-col overflow-hidden rounded-full"
      >
        <span className="flex-1 bg-[#ce1126]" />
        <span className="flex-1 bg-[#fcd116]" />
        <span className="flex-1 bg-[#006b3f]" />
      </span>
      <span
        className={`font-extrabold tracking-tight text-[#0f6b47] ${
          size === "sm" ? "text-sm" : "text-base"
        }`}
      >
        Akwaaba Cargo
      </span>
    </span>
  );
}
