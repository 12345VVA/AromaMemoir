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
			<cl-table ref="Table">
				<template #column-isActive="{ scope }">
					<el-tag
						v-if="scope.row.isActive"
						type="success"
						size="small"
						effect="dark"
						>启用</el-tag
					>
					<el-tag v-else type="info" size="small" effect="plain">停用</el-tag>
				</template>
			</cl-table>
		</el-row>

		<el-row>
			<cl-flex1 />
			<cl-pagination />
		</el-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" name="challenge-list" setup>
import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{ label: '挑战名称', prop: 'name', component: { name: 'el-input' }, required: true },
		{
			label: '描述',
			prop: 'description',
			component: { name: 'el-input', props: { type: 'textarea', rows: 2 } }
		},
		{ label: '类型', prop: 'type', component: { name: 'el-input' } },
		{
			label: '奖励经验',
			prop: 'exp',
			component: { name: 'el-input-number', props: { min: 0, step: 1 } },
			value: 0
		},
		{
			label: '开始时间',
			prop: 'startTime',
			component: {
				name: 'el-date-picker',
				props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss' }
			}
		},
		{
			label: '结束时间',
			prop: 'endTime',
			component: {
				name: 'el-date-picker',
				props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss' }
			}
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
		{ label: '挑战名称', prop: 'name', minWidth: 140 },
		{ label: '类型', prop: 'type', width: 100 },
		{ label: '奖励经验', prop: 'exp', width: 90 },
		{ label: '开始时间', prop: 'startTime', minWidth: 170 },
		{ label: '结束时间', prop: 'endTime', minWidth: 170 },
		{ label: '是否启用', prop: 'isActive', width: 100 },
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.challenge
	},
	(app) => {
		app.refresh();
	}
);
</script>
