import { App, Init, Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { TaskInfoEntity } from '../entity/info';
import * as _ from 'lodash';
import { IMidwayApplication } from '@midwayjs/core';
import { CoolQueueHandle } from '@cool-midway/task';
import { TaskBullService } from './bull';
import { TaskLocalService } from './local';
import { TaskLogEntity } from '../entity/log';
/**
 * 任务
 */
@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class TaskInfoService extends BaseService {
  @InjectEntityModel(TaskInfoEntity)
  taskInfoEntity: Repository<TaskInfoEntity>;

  @InjectEntityModel(TaskLogEntity)
  taskLogEntity: Repository<TaskLogEntity>;

  type: 'local' | 'bull' = 'local';

  @App()
  app: IMidwayApplication;

  @Inject()
  taskBullService: TaskBullService;

  @Inject()
  taskLocalService: TaskLocalService;

  @Init()
  async init() {
    await super.init();
    await this.initType();
    this.setEntity(this.taskInfoEntity);
  }

  /**
   * 初始化任务类型
   */
  async initType() {
    try {
      const check = await this.app
        .getApplicationContext()
        .getAsync(CoolQueueHandle);
      if (check) {
        this.type = 'bull';
      } else {
        this.type = 'local';
      }
    } catch (e) {
      this.type = 'local';
    }
    return this.type;
  }

  /**
   * 停止任务
   * @param id
   */
  async stop(id) {
    if (this.type === 'bull') {
      return await this.taskBullService.stop(id);
    }
    return await this.taskLocalService.stop(id);
  }

  /**
   * 开始任务
   * @param id
   * @param type
   */
  async start(id, type?) {
    if (this.type === 'bull') {
      return await this.taskBullService.start(id);
    }
    return await this.taskLocalService.start(id, type);
  }
  /**
   * 手动执行一次
   * @param id
   */
  async once(id) {
    if (this.type === 'bull') {
      return await this.taskBullService.once(id);
    }
    return await this.taskLocalService.once(id);
  }
  /**
   * 检查任务是否存在
   * @param jobId
   */
  async exist(jobId) {
    if (this.type === 'bull') {
      return await this.taskBullService.exist(jobId);
    }
    return await this.taskLocalService.exist(jobId);
  }
  /**
   * 新增或修改
   * @param params
   */
  async addOrUpdate(params) {
    if (this.type === 'bull') {
      return await this.taskBullService.addOrUpdate(params);
    }
    return await this.taskLocalService.addOrUpdate(params);
  }
  /**
   * 删除
   * @param ids
   */
  async delete(ids) {
    if (this.type === 'bull') {
      return await this.taskBullService.delete(ids);
    }
    return await this.taskLocalService.delete(ids);
  }
  /**
   * 任务日志
   * @param query
   */
  async log(query) {
    const { id, status } = query;
    const find = await this.taskLogEntity
      .createQueryBuilder('a')
      .select(['a.*', 'b.name as taskName'])
      .leftJoin(TaskInfoEntity, 'b', 'a.taskId = b.id')
      .where('a.taskId = :id', { id });
    if (status || status == 0) {
      find.andWhere('a.status = :status', { status });
    }
    return await this.entityRenderPage(find, query);
  }

  /**
   * 初始化任务
   */
  async initTask() {
    if (this.type === 'bull') {
      return await this.taskBullService.initTask();
    }
    return await this.taskLocalService.initTask();
  }

  /**
   * 详情
   * @param id
   * @returns
   */
  async info(id: any): Promise<any> {
    if (this.type === 'bull') {
      return await this.taskBullService.info(id);
    }
    return await this.taskLocalService.info(id);
  }
}
