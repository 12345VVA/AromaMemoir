<template>
	<cl-crud ref="Crud">
		<el-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key placeholder="搜索商品名" />
		</el-row>
		<el-row>
			<cl-table ref="Table" />
		</el-row>
		<el-row>
			<cl-flex1 />
			<cl-pagination />
		</el-row>
		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({ name: 'family-shopping' });

import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-upsert
const Upsert = useUpsert({
	items: [
		{
			prop: 'familyId',
			label: '家庭组ID',
			component: { name: 'el-input-number' },
			required: true
		},
		{
			prop: 'name',
			label: '商品名',
			component: { name: 'el-input' },
			required: true
		},
		{
			prop: 'category',
			label: '分类',
			component: {
				name: 'el-select',
				options: [
					{ label: '蔬菜', value: '蔬菜' },
					{ label: '水果', value: '水果' },
					{ label: '肉类', value: '肉类' },
					{ label: '海鲜', value: '海鲜' },
					{ label: '调味品', value: '调味品' },
					{ label: '零食', value: '零食' },
					{ label: '其他', value: '其他' }
				]
			}
		},
		{
			prop: 'quantity',
			label: '数量',
			component: { name: 'el-input' }
		},
		{
			prop: 'checked',
			label: '勾选状态',
			value: false,
			component: { name: 'el-switch' }
		},
		{
			prop: 'checkedBy',
			label: '勾选人ID',
			component: { name: 'el-input-number' }
		},
		{
			prop: 'checkedAt',
			label: '勾选时间',
			component: {
				name: 'el-date-picker',
				props: {
					type: 'datetime',
					valueFormat: 'YYYY-MM-DD HH:mm:ss'
				}
			}
		},
		{
			prop: 'sort',
			label: '排序',
			value: 0,
			component: { name: 'el-input-number' }
		}
	]
});

// cl-table
const Table = useTable({
	columns: [
		{ type: 'selection' },
		{ label: 'ID', prop: 'id' },
		{ label: '家庭组ID', prop: 'familyId' },
		{ label: '商品名', prop: 'name', minWidth: 140 },
		{ label: '分类', prop: 'category', width: 100 },
		{ label: '数量', prop: 'quantity', width: 100 },
		{ label: '勾选状态', prop: 'checked', width: 90 },
		{ label: '勾选人ID', prop: 'checkedBy' },
		{ label: '勾选时间', prop: 'checkedAt', minWidth: 170 },
		{ label: '排序', prop: 'sort', width: 80 },
		{ label: '创建时间', prop: 'createTime', sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud
const Crud = useCrud({ service: service.family.shopping }, (app) => {
	app.refresh();
});
</script>
