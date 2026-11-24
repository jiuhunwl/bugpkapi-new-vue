export interface ResponsiveGridProps {
  /** 桌面列数（lg: >=1024px），默认 4 */
  columns?: number;
  /** 平板列数（md: >=768px），默认 2 */
  tabletColumns?: number;
  /** 移动列数（<768px），默认 1 */
  mobileColumns?: number;
  /** 栅格间距（px，8px 基准阶梯），默认 16 */
  gap?: number;
  /** 是否显示骨架屏 */
  loading?: boolean;
  /** 空态标记（为空时渲染 #empty 插槽） */
  empty?: boolean;
  /** 默认骨架屏卡片数量 */
  skeletonCount?: number;
}
