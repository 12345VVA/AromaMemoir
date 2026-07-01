<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<!-- 新增按钮 -->
			<cl-add-btn />
			<!-- 批量删除 -->
			<cl-multi-delete-btn />
			<cl-flex1 />
			<!-- 关键字搜索 -->
			<cl-search-key placeholder="搜索家庭组名称" />
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table" />
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<!-- 分页 -->
			<cl-pagination />
		</cl-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({
	name: 'family-list'
});

import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-table
const Table = useTable({
	columns: [
		{
			type: 'selection',
			width: 60
		},
		{
			label: 'ID',
			prop: 'id',
			width: 100
		},
		{
			label: '家庭组名称',
			prop: 'name',
			minWidth: 160
		},
		{
			label: '邀请码',
			prop: 'inviteCode',
			minWidth: 140,
			showOverflowTooltip: true
		},
		{
			label: '成员数',
			prop: 'memberCount',
			width: 100
		},
		{
			label: '创建者ID',
			prop: 'ownerId',
			width: 110
		},
		{
			label: '描述',
			prop: 'description',
			minWidth: 180,
			showOverflowTooltip: true
		},
		{
			label: '创建时间',
			prop: 'createTime',
			sortable: 'desc',
			minWidth: 170
		},
		{
			type: 'op',
			buttons: ['edit', 'delete']
		}
	]
});

// cl-upsert
const Upsert = useUpsert({
	items: [
		{
			label: '家庭组名称',
			prop: 'name',
			component: { name: 'el-input' },
			required: true
		},
		{
			label: '描述',
			prop: 'description',
			component: {
				name: 'el-input',
				props: {
					type: 'textarea',
					rows: 3
				}
			}
		},
		{
			label: '邀请码',
			prop: 'inviteCode',
			component: { name: 'el-input' }
		},
		{
			label: '成员数',
			prop: 'memberCount',
			value: 1,
			component: {
				name: 'el-input-number',
				props: { min: 1 }
			}
		},
		{
			label: '创建者ID',
			prop: 'ownerId',
			component: {
				name: 'el-input-number',
				props: { min: 0 }
			}
		}
	]
});

// cl-crud（family 模块 eps 自动生成的 /admin/family/* 服务）
const Crud = useCrud(
	{
		service: (service as any).family.family
	},
	app => {
		app.refresh();
	}
);
</script>
