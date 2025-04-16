## Boss Batch Push

> [!CAUTION]
> Boss直聘新推出了职位页面
> 
> 本项目未对新的页面进行适配
> 
> 新的项目进行了适配，请迁移至新项目使用
> 
> AI工作猎手 【原有基础上增加了多种AI功能，快速、简单、易用；帮助您快速找到工作！】

## AI工作猎手
 ### [Github AI工作猎手](https://github.com/yangfeng20/ai-job)
 ### [Gitee AI工作猎手](https://gitee.com/yangfeng20/ai-job)

- **`找工作，用AI工作猎手！让AI帮您找工作！`** AI坐席：【DeepSeek+ChatGpt】赋能，ai助理作为您的求职者分身24小时 * 7在线找工作，并结合您的简历信息定制化回复。批量投递，自动发送简历，交换联系方式。hr拒绝挽留。高意向邮件通知，让您不错过每一份工作机会。

### AI坐席
- \- 让AI作为您的求职者分身，帮助您快速找到工作。
- \- 智能回复HR的消息,结合您的简历信息进行定制化回答。
- \- 预设问题支持，根据场景只能匹配您的预设问题，进行智能回答。
- \- AI快捷回复发送简历，交换 wx、联系方式。
- \- HR拒绝挽留，当hr拒绝您时，可触发拒绝挽留。主动发送简历，并发送自定义的挽留语。


### 工作通知
- \- 支持AI坐席与HR的每轮沟通，发送邮件通知。
- \- 高意向职位邮件通知，通过设置的关键字或者对话轮数，发送高意向职位的通知。


### 投递工具
- \- 批量投递简历。自定义单次投递数量。
- \- 发送自定义招呼语，充分展现您的优势。
- \- 自定义筛选过滤，根据您的需求筛选公司，职位，薪资...。


---
## boss 直聘批量投简历

### 使用步骤

1. 浏览器下载油猴：https://www.tampermonkey.net/index.php?ext=iikm
2. 添加新脚本，复制 【oop-self-req-main.js】 中的代码，油猴点击添加新脚本，粘贴到油猴脚本中，保存。
   1. 或者直接在Greasy Fork下载脚本【[Greasy Fork Boss直聘批量投简历](https://greasyfork.org/zh-CN/scripts/468125)】

### 使用说明

1. 批量投递：点击批量投递开始批量投简历，请先通过上方 Boss 的筛选功能筛选大致的范围，然后通过脚本的筛选进一步确认投递目 标。

2. 生成Job词云图：获取当前页面的所有job详情，并进行分词权重分析；生成岗位热点词汇词云图；帮助分析简历匹配度。

3. 保存配置：保持下方脚本筛选项，用于后续直接使用当前配置。

4. 过滤不活跃 Boss：打开后会自动过滤掉最近未活跃的 Boss 发布的工作。以免浪费每天的 100 次机会。

5. 发送自定义招呼语：因为boss不支持将自定义的招呼语设置为默认招呼语。开启表示发送boss默认的招呼语后还会发送自定义招呼语

6. 可以在网站管理中打开通知权限,当停止时会自动发送桌面端通知提醒。

#### 脚本筛选项介绍：

1. 公司名包含：投递工作的公司名一定包含在当前集合中，模糊匹配，多个使用逗号分割。这个一般不用，如果使用了也就代表只投这 些公司的岗位。例子：【阿里,华为】

2. 排除公司名：投递工作的公司名一定不在当前集合中，也就是排除当前集合中的公司，模糊匹配，多个使用逗号分割。例子：【xxx 外包】

3. 排除工作内容：会自动检测上文(不是,不,无需等关键字),下文(系统,工具),例子：【外包,上门,销售,驾照】，如果写着是'不是外包''销售系统'那也不会被排除

4. Job 名包含：投递工作的名称一定包含在当前集合中，模糊匹配，多个使用逗号分割。例如：【软件,Java,后端,服务端,开发,后台】

5. 薪资范围：投递工作的薪资范围一定在当前区间中，一定是区间，使用-连接范围。例如：【12-20】

6. 公司规模范围：投递工作的公司人员范围一定在当前区间中，一定是区间，使用-连接范围。例如：【500-20000000】

7. 自定义招呼语：编辑自定义招呼语，当【发送自定义招呼语】打开时，投递后发送boss默认的招呼语后还会发送自定义招呼语；使用&lt;br&gt; \n 换行；例子：【你好\n我...】

### 效果演示

![示例](/image/img.png)

![示例2](/image/img2.png)

![示例3](/image/img3.png)

### 更新内容

##### 2024-12-03/[yangfeng20](https://github.com/yangfeng20)
- 修复偶现的自定义招呼语重复发送问题，投递次数计算问题（重复投递导致）。
  - boss更新了，列表页面点击投递，也还是会显示立即投递，不会变更为继续沟通了，不清楚是不是boss的bug。
  - 同时接口的字段也修改了，沟通过的字段由【haveContacted】改为了【friendStatus】。
  - 感谢[RickieWen](https://github.com/RickieWen)的辅助调试测试。
  - 如果有问题，请携带详细信息反馈。

##### 2024-08-07/[yangfeng20](https://github.com/yangfeng20)
- 发送自定义招呼语识别问题
  - 07-18的提交，通过window._PAGE.token。在当时是可行的。但现在失效了。

##### 2024-07-21/[chenli1107](https://github.com/chenli1107) and [yangfeng20](https://github.com/yangfeng20)
- 添加过滤条件：工作名排除
- 修复重复投递导致的重复发送自定义招呼语问题

##### 2024-07-18/[iekrwh](https://github.com/Iekrwh)
- token字段更改（boss更新了,解决投递失败问题【请求不合法】）

##### 2024-06-10/yangfeng20

- 修复自定义招呼语重复发送问题（websocket）
- 修复薪资范围匹配问题

##### 2023-09-21/yangfeng20

- 支持发送自定义招呼语

###### 作者闲话
- 虽然本次只是一个发送自定义招呼语的功能，也是付出了大把的时间来开发调试。
- 最初的想法是直接拿到boss的api，自己去发送websocket消息，想了下，如果boss那边有加密或是拦截，那就很麻烦。
- 就还是开一个iframe标签页面去模拟用户点击发送。但是没想到这里也有坑，直接模拟click会被拦截，我看了下；
- 大致原因是因为没有触发输入框的获取焦点事件之类的。其他的我也难得，也没有时间思考了，就直接通过通过标签绑定的vue组件修改了【enableSubmit】的值。这个问题也就解决了。
- 这样，websocket发送出去了，我本以为大功告成了。但是消息页面迟迟没有接收到消息，还是有问题。
- 然后就对比了下脚本操作和正常点击发送按钮的区别，发现脚本操作是发送websocket时【to.uid】无值，导致发送不成功。
- 解决将【bossInfo$.friendId】中的数据赋值给了uid。后期大概率将模拟点击换成自己发送websocket。
- 上述代码见【oop-self-req-main.js sendMsg 1603-1607行】
- 个人的精力真的有限，也欢迎大家贡献pr。以及点个star。这是更新动力。

##### 2023-09-10/Ocyss

- 页面自适应美化
- 词云图模态框
- 大小号切换
- 桌面端通知
- 工作内容过滤修复

#### 2023-09-08/yangfeng20

- 新增生成job热点词云图,知晓工作热点
- 延迟投递，避免频繁【500ms-->800ms】

#### 2023-08-29/yangfeng20

- 使用面向对象风格重构，增加代码可维护性和可读性
- 手动模拟投递请求，真正实现列表无感投递
- 控制日志级别，清晰的控制台
- 默认开启活跃度检查
- 使用投递锁限制投递，避免频繁
- 彻底解决无线等待死锁问题
- 增加投递重试机制

##### 2023-07-12/Ocyss

- 大小号快速切换(独立配置) 外卖/编程两不误
- 修复一直等待的 bug
- 进行 url 拦截，实现无限下一页
- 修复日薪计算偏差
  > 已知 BUG：
  >
  > - 多次刷新，劫持函数无限报错，重新开一个标签页吧～

##### 2023-06-28/Ocyss

- 使用 iframe，无感投递
- 工作内容排除
- 暂停投递功能
- 标题显示当天投递次数
- 说明文档折叠
- 彩色日志

### 存储地址

[github boss_batch_push](https://github.com/yangfeng20/boss_batch_push)
<br>

[gitee boss_batch_push](https://gitee.com/yangfeng20/boss_batch_push)
<br>

[Greasy Fork](https://greasyfork.org/zh-CN/scripts/468125-boss-batch-push-boss%E7%9B%B4%E8%81%98%E6%89%B9%E9%87%8F%E6%8A%95%E7%AE%80%E5%8E%86)



### star 数据

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=yangfeng20/boss_batch_push&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=yangfeng20/boss_batch_push&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=yangfeng20/boss_batch_push&type=Date" />
</picture>