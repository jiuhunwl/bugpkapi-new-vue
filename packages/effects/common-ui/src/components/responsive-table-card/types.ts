export type ResponsiveTableCardBreakpoint = 'md' | 'lg';

export interface ResponsiveTableCardProps {
  /** 卡片化切换断点：md=768px 以下为卡片，lg=1024px 以下为卡片，默认 md */
  breakpoint?: ResponsiveTableCardBreakpoint;
  /** 是否加载中（渲染骨架屏或 #loading 插槽） */
  loading?: boolean;
  /** 是否空态（渲染 #empty 插槽或 emptyText） */
  empty?: boolean;
  /** 空态文案（未提供 #empty 插槽时使用） */
  emptyText?: string;
}
