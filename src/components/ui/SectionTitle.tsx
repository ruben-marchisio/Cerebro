import type { HTMLAttributes } from "react";

type SectionTitleAlignment = "left" | "center";

export type SectionTitleProps = {
  title: string;
  subtitle?: string;
  align?: SectionTitleAlignment;
} & HTMLAttributes<HTMLDivElement>;

const baseStyles = "flex flex-col gap-3";

const alignmentStyles: Record<SectionTitleAlignment, string> = {
  center: "mx-auto max-w-3xl text-center",
  left: "text-left",
};

export default function SectionTitle({
  title,
  subtitle,
  align = "center",
  className,
  ...rest
}: SectionTitleProps) {
  const classes = [baseStyles, alignmentStyles[align], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      <h1 className="text-4xl font-semibold text-slate-100 md:text-5xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="text-base text-slate-400 md:text-lg">{subtitle}</p>
      ) : null}
    </div>
  );
}
