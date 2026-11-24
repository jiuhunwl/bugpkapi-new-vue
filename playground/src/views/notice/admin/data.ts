import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { NoticeApi } from '#/api/notice';

import { $t } from '#/locales';

export interface NoticeActionPermissions {
  delete: boolean;
  popup: boolean;
  status: boolean;
  top: boolean;
  update: boolean;
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', componentProps: { placeholder: $t('noticeAdmin.searchPlaceholder') }, fieldName: 'keyword', label: $t('noticeAdmin.fields.keyword') },
    { component: 'Select', componentProps: { allowClear: true, options: [{ label: $t('noticeAdmin.published'), value: 1 }, { label: $t('noticeAdmin.hidden'), value: 0 }] }, fieldName: 'status', label: $t('noticeAdmin.fields.status') },
    { component: 'Select', componentProps: { allowClear: true, options: [{ label: $t('noticeAdmin.top'), value: 1 }, { label: $t('noticeAdmin.normal'), value: 0 }] }, fieldName: 'isTop', label: $t('noticeAdmin.fields.top') },
    { component: 'Select', componentProps: { allowClear: true, options: [{ label: $t('noticeAdmin.popup'), value: 1 }, { label: $t('noticeAdmin.noPopup'), value: 0 }] }, fieldName: 'isPopup', label: $t('noticeAdmin.fields.popup') },
    { component: 'Select', componentProps: { allowClear: true, options: [{ label: $t('noticeAdmin.homeTicker'), value: 1 }, { label: $t('noticeAdmin.noHomeTicker'), value: 0 }] }, fieldName: 'isHomeTicker', label: $t('noticeAdmin.fields.homeTicker') },
  ];
}

export function useFormSchema(
  imageUploader?: (options: any) => Promise<any>,
): VbenFormSchema[] {
  return [
    { component: 'Input', componentProps: { maxlength: 300, showCount: true }, fieldName: 'title', label: $t('noticeAdmin.fields.title'), rules: 'required' },
    { component: 'Switch', componentProps: { checkedChildren: $t('noticeAdmin.published'), class: 'w-auto', unCheckedChildren: $t('noticeAdmin.hidden') }, defaultValue: true, fieldName: 'status', label: $t('noticeAdmin.fields.status') },
    { component: 'Switch', componentProps: { checkedChildren: $t('noticeAdmin.top'), class: 'w-auto', unCheckedChildren: $t('noticeAdmin.normal') }, defaultValue: false, fieldName: 'isTop', label: $t('noticeAdmin.fields.top') },
    { component: 'Switch', componentProps: { checkedChildren: $t('noticeAdmin.popup'), class: 'w-auto', unCheckedChildren: $t('noticeAdmin.noPopup') }, defaultValue: false, fieldName: 'isPopup', label: $t('noticeAdmin.fields.popup') },
    { component: 'Switch', componentProps: { checkedChildren: $t('noticeAdmin.homeTicker'), class: 'w-auto', unCheckedChildren: $t('noticeAdmin.noHomeTicker') }, defaultValue: false, fieldName: 'isHomeTicker', help: $t('noticeAdmin.homeTickerHelp'), label: $t('noticeAdmin.fields.homeTicker') },
    { component: 'DatePicker', componentProps: { allowEmpty: true, class: 'w-full', placeholder: $t('noticeAdmin.expireTimePlaceholder'), showTime: true, valueFormat: 'YYYY-MM-DD HH:mm:ss' }, fieldName: 'expireTime', help: $t('noticeAdmin.expireTimeHelp'), label: $t('noticeAdmin.fields.expireTime') },
    { component: 'RichEditor', componentProps: { imageUploader, placeholder: $t('noticeAdmin.contentPlaceholder') }, fieldName: 'contentHtml', formItemClass: 'col-span-2 items-baseline notice-rich-editor-item', label: $t('noticeAdmin.fields.content'), rules: 'required' },
  ];
}

/**
 * 列设计（vben 惯例：窄列 + 操作折叠）：
 * - 三个投放开关（置顶/弹窗/滚动位）合并为一列标签；
 * - 摘要移出表格（预览抽屉里看全文），时间截到分钟；
 * - 操作列 maxCount=2：预览/编辑外露，其余进「更多」下拉，
 *   总宽压到 ~910px，常规宽度不再出现横向滚动。
 */
export function useColumns<T = NoticeApi.NoticeItem>(onActionClick: OnActionClickFn<T>, permissions: NoticeActionPermissions): VxeTableGridColumns {
  return [
    { field: 'title', minWidth: 200, title: $t('noticeAdmin.fields.title') },
    { field: 'placement', slots: { default: 'placement' }, title: $t('noticeAdmin.fields.placement'), width: 180 },
    { field: 'status', slots: { default: 'status' }, title: $t('noticeAdmin.fields.status'), width: 80 },
    { field: 'publishTime', formatter: ({ cellValue }) => (cellValue ? String(cellValue).slice(0, 16) : '—'), title: $t('noticeAdmin.fields.publishTime'), width: 145 },
    { field: 'expireTime', formatter: ({ cellValue }) => (cellValue ? String(cellValue).slice(0, 16) : $t('noticeAdmin.expireTimeNone')), title: $t('noticeAdmin.fields.expireTime'), width: 145 },
    { align: 'center', cellRender: { attrs: { maxCount: 2, nameField: 'title', nameTitle: $t('noticeAdmin.entityName'), onClick: onActionClick }, name: 'CellOperation', options: [{ code: 'preview', show: true, text: $t('noticeAdmin.actions.preview') }, { code: 'edit', show: permissions.update, text: $t('noticeAdmin.actions.edit') }, { code: 'top', show: permissions.top, text: $t('noticeAdmin.actions.toggleTop') }, { code: 'popup', show: permissions.popup, text: $t('noticeAdmin.actions.togglePopup') }, { code: 'status', show: permissions.status, text: $t('noticeAdmin.actions.toggleStatus') }, { code: 'delete', danger: true, show: permissions.delete, text: $t('noticeAdmin.actions.delete') }] }, field: 'operation', fixed: 'right', title: $t('noticeAdmin.fields.actions'), width: 150 },
  ];
}
