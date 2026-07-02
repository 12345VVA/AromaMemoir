<template>
	<cl-crud ref="Crud">
		<el-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key placeholder="搜索用户ID或家庭ID" />
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
	name: 'family-member'
});

import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{
			label: '家庭组ID',
			prop: 'familyId',
			component: { name: 'el-input-number', props: { min: 0 } },
			required: true
		},
		{
			label: '用户ID',
			prop: 'userId',
			component: { name: 'el-input-number', props: { min: 0 } },
			required: true
		},
		{
			label: '角色',
			prop: 'role',
			value: 'member',
			component: {
				name: 'el-select',
				options: [
					{ label: '拥有者', value: 'owner' },
					{ label: '管理员', value: 'admin' },
					{ label: '成员', value: 'member' }
				]
			}
		},
		{
			label: '加入时间',
			prop: 'joinedAt',
			component: {
				name: 'el-date-picker',
				props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss' }
			}
		}
	]
});

// cl-table 配置
const Table = useTable({
	columns: [
		{ type: 'selection' },
		{ label: 'ID', prop: 'id', width: 80 },
		{ label: '家庭组ID', prop: 'familyId', width: 110 },
		{ label: '用户ID', prop: 'userId', width: 110 },
		{ label: '角色', prop: 'role', width: 100 },
		{ label: '加入时间', prop: 'joinedAt', minWidth: 170 },
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.family.member
	},
	(app) => {
		app.refresh();
	}
);
</script>
