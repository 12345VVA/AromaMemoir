<template>
	<cl-crud ref="Crud">
		<el-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key prop="name" placeholder="搜索菜谱名" />
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
import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

defineOptions({ name: 'family-recipes' });

const { service } = useCool();

// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{ label: '菜谱名', prop: 'name', component: { name: 'el-input' }, required: true },
		{
			label: '分类',
			prop: 'category',
			component: {
				name: 'el-select',
				options: [
					{ label: '家常菜', value: '家常菜' },
					{ label: '面食', value: '面食' },
					{ label: '烘焙', value: '烘焙' },
					{ label: '汤品', value: '汤品' },
					{ label: '凉菜', value: '凉菜' },
					{ label: '其他', value: '其他' }
				]
			}
		},
		{
			label: '难度',
			prop: 'difficulty',
			component: {
				name: 'el-select',
				options: [
					{ label: '简单', value: 'easy' },
					{ label: '中等', value: 'medium' },
					{ label: '困难', value: 'hard' }
				]
			}
		},
		{
			label: '烹饪时长(分钟)',
			prop: 'cookTime',
			component: { name: 'el-input-number', props: { min: 0, step: 1 } }
		},
		{
			label: '可见性',
			prop: 'visibility',
			component: {
				name: 'el-radio-group',
				options: [
					{ label: '家庭共享', value: 'family' },
					{ label: '我的私厨', value: 'private' }
				]
			}
		},
		{ label: '封面URL', prop: 'coverUrl', component: { name: 'el-input' } },
		{ label: '食材', prop: 'ingredients', component: { name: 'el-input', props: { type: 'textarea', rows: 3 } } },
		{ label: '步骤', prop: 'steps', component: { name: 'el-input', props: { type: 'textarea', rows: 4 } } },
		{
			label: '家庭组ID',
			prop: 'familyId',
			component: { name: 'el-input-number', props: { min: 0, step: 1 } }
		},
		{
			label: '作者ID',
			prop: 'authorId',
			component: { name: 'el-input-number', props: { min: 0, step: 1 } }
		}
	]
});

// cl-table 配置
const Table = useTable({
	columns: [
		{ type: 'selection' },
		{ label: 'ID', prop: 'id', width: 80 },
		{ label: '菜谱名', prop: 'name', minWidth: 140 },
		{ label: '分类', prop: 'category', width: 100 },
		{ label: '难度', prop: 'difficulty', width: 90 },
		{ label: '烹饪时长', prop: 'cookTime', width: 100 },
		{ label: '可见性', prop: 'visibility', width: 100 },
		{ label: '封面URL', prop: 'coverUrl', minWidth: 160, showOverflowTooltip: true },
		{ label: '作者ID', prop: 'authorId', width: 100 },
		{ label: '家庭组ID', prop: 'familyId', width: 100 },
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.family.recipe
	},
	(app) => {
		app.refresh();
	}
);
</script>
