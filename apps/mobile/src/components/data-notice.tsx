import type { PropsWithChildren } from 'react';
import { AppCard } from './app-card';
import { AppText } from './app-text';

type NoticeTone = 'info' | 'warning' | 'success' | 'danger';

interface DataNoticeProps extends PropsWithChildren {
  title: string;
  tone?: NoticeTone;
}

const toneClasses: Record<NoticeTone, string> = {
  info: 'border-water bg-water-soft',
  warning: 'border-gold bg-gold-soft',
  success: 'border-sage bg-sage-soft',
  danger: 'border-error bg-error-soft',
};

export function DataNotice({
  title,
  tone = 'info',
  children,
}: DataNoticeProps) {
  return (
    <AppCard compact className={`gap-1.5 ${toneClasses[tone]}`}>
      <AppText variant="label">{title}</AppText>
      <AppText muted>{children}</AppText>
    </AppCard>
  );
}
