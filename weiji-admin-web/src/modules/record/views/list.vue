<template>
	<cl-crud ref="Crud">
		<el-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key />
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

<script lang="ts" name="record-list" setup>
import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{ label: '菜品名', prop: 'dishName', component: { name: 'el-input' }, required: true },
		{ label: '烹饪方式', prop: 'cookingMethod', component: { name: 'el-input' } },
		{
			label: '评分',
			prop: 'rating',
			component: { name: 'el-input-number', props: { min: 0, max: 5, step: 1 } }
		},
		{
			label: '餐次',
			prop: 'mealType',
			component: {
				name: 'el-select',
				options: [
					{ label: '早餐', value: 'breakfast' },
					{ label: '午餐', value: 'lunch' },
					{ label: '晚餐', value: 'dinner' },
					{ label: '零食', value: 'snack' }
				]
			}
		},
		{ label: '记录日期', prop: 'recordDate', component: { name: 'el-date-picker', props: { type: 'date', valueFormat: 'YYYY-MM-DD' } } },
		{
			label: '来源',
			prop: 'source',
			component: {
				name: 'el-select',
				options: [
					{ label: '手动', value: 'manual' },
					{ label: 'AI', value: 'ai' }
				]
			}
		},
		{ label: '图片URL', prop: 'imageUrl', component: { name: 'el-input' } },
		{ label: '美化图URL', prop: 'beautifiedUrl', component: { name: 'el-input' } },
		{ label: '备注', prop: 'note', component: { name: 'el-input', props: { type: 'textarea', rows: 2 } } }
	]
});

// cl-table 配置
const Table = useTable({
	columns: [
		{ type: 'selection' },
		{ label: 'ID', prop: 'id', width: 80 },
		{ label: '菜品名', prop: 'dishName', minWidth: 140 },
		{ label: '烹饪方式', prop: 'cookingMethod', minWidth: 100 },
		{ label: '评分', prop: 'rating', width: 80 },
		{ label: '餐次', prop: 'mealType', width: 90 },
		{ label: '记录日期', prop: 'recordDate', minWidth: 120 },
		{ label: '来源', prop: 'source', width: 80 },
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.record
	},
	(app) => {
		app.refresh();
	}
);
</script>
