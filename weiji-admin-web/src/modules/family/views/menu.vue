<template>
	<cl-crud ref="Crud">
		<el-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key placeholder="搜索菜谱名" />
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
	name: 'family-menu'
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
			label: '星期几',
			prop: 'dayOfWeek',
			component: {
				name: 'el-select',
				options: [
					{ label: '周一', value: 1 },
					{ label: '周二', value: 2 },
					{ label: '周三', value: 3 },
					{ label: '周四', value: 4 },
					{ label: '周五', value: 5 },
					{ label: '周六', value: 6 },
					{ label: '周日', value: 7 }
				]
			},
			required: true
		},
		{
			label: '餐次',
			prop: 'mealType',
			component: {
				name: 'el-select',
				options: [
					{ label: '早餐', value: 'breakfast' },
					{ label: '午餐', value: 'lunch' },
					{ label: '晚餐', value: 'dinner' }
				]
			},
			required: true
		},
		{
			label: '菜谱ID',
			prop: 'recipeId',
			component: { name: 'el-input-number', props: { min: 0 } }
		},
		{ label: '菜谱名', prop: 'recipeName', component: { name: 'el-input' }, required: true },
		{
			label: '点赞用户ID',
			prop: 'likes',
			component: {
				name: 'el-input',
				props: { type: 'textarea', rows: 2, placeholder: '请输入逗号分隔的ID，如：1,2,3' }
			}
		},
		{
			label: '踩用户ID',
			prop: 'dislikes',
			component: {
				name: 'el-input',
				props: { type: 'textarea', rows: 2, placeholder: '请输入逗号分隔的ID，如：1,2,3' }
			}
		}
	]
});

// cl-table 配置
const Table = useTable({
	columns: [
		{ type: 'selection' },
		{ label: 'ID', prop: 'id', width: 80 },
		{ label: '家庭组ID', prop: 'familyId', width: 100 },
		{ label: '星期几', prop: 'dayOfWeek', width: 80 },
		{ label: '餐次', prop: 'mealType', width: 90 },
		{ label: '菜谱ID', prop: 'recipeId', width: 100 },
		{ label: '菜谱名', prop: 'recipeName', minWidth: 140 },
		{ label: '点赞用户ID', prop: 'likes', minWidth: 140, showOverflowTooltip: true },
		{ label: '踩用户ID', prop: 'dislikes', minWidth: 140, showOverflowTooltip: true },
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.family.menu
	},
	(app) => {
		app.refresh();
	}
);
</script>
