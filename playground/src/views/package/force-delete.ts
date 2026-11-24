import { message, Modal } from 'ant-design-vue';

import { $t } from '#/locales';

/** 后端删除保护冲突（HTTP 409：套餐已有购买/权益/支付记录）。 */
function isDeleteConflict(error: unknown): boolean {
  return (
    (error as { response?: { status?: number } })?.response?.status === 409
  );
}

/**
 * 套餐删除流程：普通删除 → 遇到「已有购买记录」的 409 冲突时，
 * 弹出强制删除确认框，管理员确认后带 force 标记重试。
 * 强制删除会级联移除所有用户的该套餐权益，支付与钱包流水保留用于审计。
 */
export function deletePackageWithForce(options: {
  name: string;
  refresh: () => void;
  remove: (force: boolean) => Promise<unknown>;
}) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [options.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  const notifyDeleted = () => {
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [options.name]),
      key: 'action_process_msg',
    });
    options.refresh();
  };
  options
    .remove(false)
    .then(notifyDeleted)
    .catch((error) => {
      hideLoading();
      if (!isDeleteConflict(error)) {
        return;
      }
      Modal.confirm({
        cancelText: $t('common.cancel'),
        content: $t('system.package.forceDeleteConfirm', [options.name]),
        okButtonProps: { danger: true },
        okText: $t('system.package.forceDeleteAction'),
        async onOk() {
          try {
            await options.remove(true);
            notifyDeleted();
          } catch {
            // 失败原因已由全局错误拦截器提示；关闭弹窗由 antd 默认处理
          }
        },
        title: $t('system.package.forceDeleteTitle'),
      });
    });
}
