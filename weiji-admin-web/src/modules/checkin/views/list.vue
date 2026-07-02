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
				<template #column-isReplenished="{ scope }">
					<el-tag
						v-if="scope.row.isReplenished"
						type="danger"
						size="small"
						effect="dark"
						>补签</el-tag
					>
					<el-tag v-else type="info" size="small" effect="plain">正常</el-tag>
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

<script lang="ts" name="checkin-list" setup>
import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{
			label: '用户ID',
			prop: 'userId',
			component: { name: 'el-input-number', props: { min: 1, step: 1 } },
			required: true
		},
		{
			label: '打卡日期',
			prop: 'checkDate',
			component: { name: 'el-date-picker', props: { type: 'date', valueFormat: 'YYYY-MM-DD' } },
			required: true
		},
		{
			label: '连续天数',
			prop: 'streak',
			component: { name: 'el-input-number', props: { min: 1, step: 1 } },
			value: 1
		},
		{
			label: '是否补签',
			prop: 'isReplenished',
			component: { name: 'el-switch', props: { activeValue: true, inactiveValue: false } },
			value: false
		}
	]
});

// cl-table 配置
const Table = useTable({
	columns: [
		{ type: 'selection' },
		{ label: 'ID', prop: 'id', width: 80 },
		{ label: '用户ID', prop: 'userId', width: 100 },
		{ label: '打卡日期', prop: 'checkDate', minWidth: 120 },
		{ label: '连续天数', prop: 'streak', width: 100 },
		{ label: '是否补签', prop: 'isReplenished', width: 100 },
		{ label: '创建时间', prop: 'createTime', minWidth: 170, sortable: 'desc' },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});

// cl-crud 配置
const Crud = useCrud(
	{
		service: service.checkin
	},
	(app) => {
		app.refresh();
	}
);
</script>
