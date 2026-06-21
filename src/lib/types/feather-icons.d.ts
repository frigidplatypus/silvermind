declare module 'feather-icons' {
  interface FeatherIcon {
    toSvg(options?: { width?: string | number; height?: string | number }): string;
  }
  export const icons: Record<string, FeatherIcon>;
}
