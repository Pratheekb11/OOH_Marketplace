import Icon from "./Icon";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon = "inbox", title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 px-6 py-24 text-center ${className}`}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-highest">
        <Icon name={icon} className="text-3xl text-outline" />
      </span>
      <div className="space-y-2">
        <h3 className="font-headline text-lg font-bold text-on-surface">{title}</h3>
        {description ? <p className="max-w-sm text-sm text-on-surface-variant">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export default EmptyState;
