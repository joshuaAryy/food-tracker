import type { ComponentProps } from 'react';
import { Text } from 'react-native';

type TextVariant =
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
  display: 'text-[34px] font-semibold leading-10 tracking-[-0.8px]',
  title: 'text-[28px] font-semibold leading-8 tracking-[-0.5px]',
  heading: 'text-lg font-semibold leading-6',
  body: 'text-base leading-6',
  label: 'text-sm font-semibold leading-5',
  caption: 'text-xs font-medium leading-4',
  number: 'text-[28px] font-semibold tabular-nums tracking-[-0.5px]',
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
