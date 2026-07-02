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

<script lang="ts" name="gamification-blindguess-list" setup>
import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{
			label: '家庭组ID',
			prop: 'familyId',
			component: { name: 'el-input-number', props: { min: 1 } },
			required: true
		},
		{ label: '轮次名称', prop: 'roundName', component: { name: 'el-input' }, required: true },
		{
			label: '发起人ID',
			prop: 'creatorId',
			component: { name: 'el-input-number', props: { min: 1 } },
			required: true
		},
		{
			label: '状态',
			prop: 'status',
			component: {
				name: 'el-select',
				options: [
					{ label: '进行中', value: 'active' },
					{ label: '已揭晓', value: 'revealed' }
				]
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
		{ label: '轮次名称', prop: 'roundName', minWidth: 140 },
		{ label: '发起人ID', prop: 'creatorId', width: 100 },
		{ label: '状态', prop: 'status', width: 100 },
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.gamification.blindguess
	},
	(app) => {
		app.refresh();
	}
);
</script>
