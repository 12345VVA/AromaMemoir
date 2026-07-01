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

<script lang="ts" name="achievement-list" setup>
import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{ label: '成就编码', prop: 'code', component: { name: 'el-input' }, required: true },
		{ label: '成就名称', prop: 'name', component: { name: 'el-input' }, required: true },
		{ label: '描述', prop: 'description', component: { name: 'el-input', props: { type: 'textarea', rows: 2 } } },
		{ label: '图标', prop: 'icon', component: { name: 'el-input' } },
		{
			label: '类型',
			prop: 'type',
			component: {
				name: 'el-select',
				options: [
					{ label: '打卡', value: 'checkin' },
					{ label: '记录', value: 'record' },
					{ label: '菜谱', value: 'recipe' },
					{ label: '其他', value: 'other' }
				]
			}
		},
		{
			label: '奖励经验',
			prop: 'exp',
			component: { name: 'el-input-number', props: { min: 0, step: 1 } }
		},
		{
			label: '是否启用',
			prop: 'isActive',
			component: { name: 'el-switch', props: { activeValue: true, inactiveValue: false } },
			value: true
		}
	]
});

// cl-table 配置
const Table = useTable({
	columns: [
		{ type: 'selection' },
		{ label: 'ID', prop: 'id', width: 80 },
		{ label: '编码', prop: 'code', minWidth: 120 },
		{ label: '名称', prop: 'name', minWidth: 140 },
		{ label: '类型', prop: 'type', width: 90 },
		{ label: '奖励经验', prop: 'exp', width: 100 },
		{ label: '启用', prop: 'isActive', width: 80 },
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.achievement
	},
	(app) => {
		app.refresh();
	}
);
</script>
