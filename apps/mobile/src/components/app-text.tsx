import type { ComponentProps } from 'react';
import { Text } from 'react-native';

type TextVariant =
  | 'hero'
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'caption'
  | 'number';

interface AppTextProps extends ComponentProps<typeof Text> {
  variant?: TextVariant;
  muted?: boolean;
}

const variantClasses: Record<TextVariant, string> = {
  hero: 'text-[52px] font-bold leading-[56px]',
  display: 'text-[42px] font-bold leading-[46px]',
  title: 'text-[32px] font-bold leading-9',
  heading: 'text-[22px] font-semibold leading-7',
  body: 'text-base leading-6',
  label: 'text-sm font-semibold leading-5',
  caption: 'text-xs font-medium leading-4',
  number: 'text-[30px] font-semibold tabular-nums',
};

export function AppText({
  variant = 'body',
  muted = false,
  className = '',
  ...props
}: AppTextProps) {
  return (
    <Text
      className={`${variantClasses[variant]} ${
        muted ? 'text-muted' : 'text-ink'
      } ${className}`}
      {...props}
    />
  );
}
