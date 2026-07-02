<template>
	<cl-crud ref="Crud">
		<el-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key placeholder="搜索邀请码" />
		</el-row>

		<el-row>
			<cl-table ref="Table" />
		</el-row>

		<el-row>
			<cl-flex1 />
			<cl-pagination />
		</el-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({
	name: 'family-invitation'
});

import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{ label: '邀请码', prop: 'code', component: { name: 'el-input' }, required: true },
		{
			label: '家庭组ID',
			prop: 'familyId',
			component: { name: 'el-input-number', props: { min: 0 } },
			required: true
		},
		{
			label: '创建者ID',
			prop: 'creatorId',
			component: { name: 'el-input-number', props: { min: 0 } },
			required: true
		},
		{
			label: '过期时间',
			prop: 'expiresAt',
			component: {
				name: 'el-date-picker',
				props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss' }
			},
			required: true
		},
		{ label: '是否已使用', prop: 'used', value: false, component: { name: 'el-switch' } }
	]
});

// cl-table 配置
const Table = useTable({
	columns: [
		{ type: 'selection' },
		{ label: 'ID', prop: 'id', width: 80 },
		{ label: '邀请码', prop: 'code', minWidth: 160, showOverflowTooltip: true },
		{ label: '家庭组ID', prop: 'familyId', width: 110 },
		{ label: '创建者ID', prop: 'creatorId', width: 110 },
		{ label: '过期时间', prop: 'expiresAt', minWidth: 170 },
		{
			label: '是否已使用',
			prop: 'used',
			width: 90,
			dict: [
				{ label: '未使用', value: false, type: 'info' },
				{ label: '已使用', value: true, type: 'success' }
			]
		},
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.family.invitation
	},
	(app) => {
		app.refresh();
	}
);
</script>
