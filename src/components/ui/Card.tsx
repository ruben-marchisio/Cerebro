import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const baseStyles =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/50 to-slate-950/70 p-6 shadow-xl shadow-slate-950/40 backdrop-blur-sm transition hover:border-white/20 hover:shadow-slate-900/40";

export default function Card({ className, children, ...rest }: CardProps) {
  const classes = [baseStyles, className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
