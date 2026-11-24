<script lang="ts" setup>
import type { RechargePresetActionPermissions } from './data';

import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { RechargeAmountApi } from '#/api/system/payment';

import { computed, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Alert, Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteRechargeAmount, getRechargeAmountList } from '#/api/system/payment';
import { $t } from '#/locales';

import { formatAmount, useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
const deleting = ref(new Set<string>());
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) => isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('payment:preset:create'));
const actionPermissions = computed<RechargePresetActionPermissions>(() => ({ delete: hasCode('payment:preset:delete'), update: hasCode('payment:preset:update') }));
const [FormDrawer, formDrawerApi] = useVbenDrawer({ connectedComponent: Form, destroyOnClose: true });
const [Grid, gridApi] = useVbenVxeGrid({ formOptions: { schema: useGridFormSchema(), submitOnChange: true }, gridOptions: { columns: useColumns(onActionClick, actionPermissions.value), height: 'auto', keepSource: true, proxyConfig: { ajax: { query: ({ page }, values) => getRechargeAmountList({ page: page.currentPage, pageSize: page.pageSize, ...values }) } }, rowConfig: { keyField: 'id' }, toolbarConfig: { custom: true, export: false, refresh: true, search: true, zoom: true } } as VxeTableGridOptions<RechargeAmountApi.RechargeAmount> });
function onActionClick({ code, row }: OnActionClickParams<RechargeAmountApi.RechargeAmount>) { if (code === 'edit' && actionPermissions.value.update) formDrawerApi.setData(row).open(); if (code === 'delete' && actionPermissions.value.delete) confirmDelete(row); }
function confirmDelete(row: RechargeAmountApi.RechargeAmount) { if (!actionPermissions.value.delete) return; const name = formatAmount(row.amount); Modal.confirm({ title: $t('rechargePreset.delete.title'), content: $t('rechargePreset.delete.description', [name]), okText: $t('rechargePreset.delete.action'), okType: 'danger', onOk: async () => { if (deleting.value.has(row.id)) return; deleting.value.add(row.id); try { await deleteRechargeAmount(row.id); message.success($t('rechargePreset.messages.deleted', [name])); await gridApi.query(); } finally { deleting.value.delete(row.id); } } }); }
function onCreate() { if (!canCreate.value) return; formDrawerApi.setData({}).open(); }
</script>
<template><Page auto-content-height><div class="flex h-full min-h-0 flex-col gap-3"><Alert show-icon type="info" :message="$t('rechargePreset.title')" :description="$t('rechargePreset.description')" /><FormDrawer @success="gridApi.query()" /><Grid :table-title="$t('rechargePreset.tableTitle')"><template #toolbar-tools><Button v-if="canCreate" type="primary" @click="onCreate"><Plus class="size-5" />{{ $t('rechargePreset.create') }}</Button></template></Grid></div></Page></template>
