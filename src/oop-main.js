// ==UserScript==
// @name         Boss Batch Push [Boss直聘批量投简历]
// @description  boss直聘批量简历投递
// @namespace    maple
// @version      1.1.4
// @author       maple,Ocyss
// @license      Apache License 2.0
// @run-at       document-start
// @match        https://www.zhipin.com/*
// @include      https://www.zhipin.com
// @require      https://unpkg.com/maple-lib@1.0.2/log.js
// @require      https://cdn.jsdelivr.net/npm/axios@1.1.2/dist/axios.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_cookie
// @grant        GM_registerMenuCommand
// ==/UserScript==

"use strict";

let logger = Logger.log("debug")


class TampermonkeyApi {

    static GmSetValue(key, val) {
        return GM_setValue(key, val);
    }

    static GmGetValue(key, defVal) {
        return GM_getValue(key, defVal);
    }

    static GmAddValueChangeListener(key, func) {
        return GM_addValueChangeListener(key, func);
    }

}

class DOMApi {

    static createTag(tag, name, style) {
        let htmlTag = document.createElement(tag);
        if (name) {
            htmlTag.innerHTML = name;
        }
        if (style) {
            htmlTag.style.cssText = style;
        }
        return htmlTag;
    }

    static createInputTag(descName, valueStr) {
        const inputNameLabel = document.createElement("label");
        inputNameLabel.textContent = descName;
        const inputTag = document.createElement("input");
        inputTag.type = "text";
        inputNameLabel.appendChild(inputTag);
        if (valueStr) {
            inputTag.value = valueStr;
        }

        // 样式
        inputNameLabel.style.cssText = "display: inline-block; width: 20%; font-weight: bold;";
        inputTag.style.cssText = "margin-left: 2px; width: 70%; padding: 5px; border-radius: 5px; border: 1px solid rgb(204, 204, 204); box-sizing: border-box;";
        return inputNameLabel;
    }

    static getInputVal(inputLab) {
        return inputLab.querySelector("input").value
    }

    static eventListener(tag, eventType, func) {
        tag.addEventListener(eventType, func)
    }
}

class IframeObj {

    static READY = 0
    static USE = 1

    static IFRAME_STATUS_KEY = "iframe_status_arr"
    // iframeStatusArr 结构如下
    // mockArr = [
    //     {
    //         key: "url中标记当前job的唯一字符串",
    //         status: "就绪或者使用中",
    //         index: "在iframePool的索引位置",
    //     }
    // ]

    constructor(widthProportion) {
        this.original = DOMApi.createTag("iframe", "", "width:" + widthProportion + "%;");

    }

    use(src, index) {
        let key = IframeObj.getKeyBySrc(src);
        let iframeStatusArr = IframeObj.getStatusObj();
        let exist = false;
        for (let i = 0; i < iframeStatusArr.length; i++) {
            if (iframeStatusArr[i].index === index) {
                iframeStatusArr[i]['key'] = key;
                iframeStatusArr[i]['status'] = IframeObj.USE;
                exist = true;
                break
            }
        }

        if (!exist) {
            iframeStatusArr.push({
                key: key,
                status: IframeObj.USE,
                index: index
            })
        }
        IframeObj.saveStatusArr(iframeStatusArr)
        this.original.src = src
    }

    static release(src) {
        let iframeStatusArr = this.getStatusObj();
        let key = IframeObj.getKeyBySrc(src);
        for (let i = 0; i < iframeStatusArr.length; i++) {
            if (iframeStatusArr[i]['key'] === key) {
                iframeStatusArr[i]['status'] = IframeObj.READY;
                logger.debug("详情页准备释放iframe:", iframeStatusArr[i])
                break;
            }
        }
        this.saveStatusArr(iframeStatusArr)
    }


    isReady() {
        return this.original.src === "" || this.original.src === document.URL;
    }

    static getStatusObj() {
        let iframeStatusObjStr = TampermonkeyApi.GmGetValue(IframeObj.IFRAME_STATUS_KEY, "[]");
        return JSON.parse(iframeStatusObjStr);
    }

    static saveStatusArr(iframeStatusObj) {
        TampermonkeyApi.GmSetValue(IframeObj.IFRAME_STATUS_KEY, JSON.stringify(iframeStatusObj));
    }

    static getKeyBySrc(src) {
        let key = "job_detail/";
        let start = src.indexOf(key);
        let end = src.indexOf(".html");
        return src.substring(start + key.length, end);
    }
}

class IframePool {

    constructor(capacity) {
        this.capacity = capacity
        let computeWidthProportion = this.computeWidthProportion(capacity);
        this.iframeArr = []
        for (let i = 0; i < capacity; i++) {
            this.iframeArr[i] = new IframeObj(computeWidthProportion)
        }

        // 注册 【iframeArr状态变更监听器，用于将iframe对象还回池中，就绪可以使用】
        TampermonkeyApi.GmAddValueChangeListener(IframeObj.IFRAME_STATUS_KEY, (key, oldValue, newValue, isOtherScriptOther) => {
            // 只监听其他脚本的修改，也就是job详情页的修改
            if (!isOtherScriptOther) {
                return;
            }

            logger.debug("监听到详情页准备释放的iframe资源", key, oldValue, newValue, isOtherScriptOther)
            let iframeStatusArr = JSON.parse(newValue);
            for (let i = 0; i < iframeStatusArr.length; i++) {
                if (iframeStatusArr[i].status === IframeObj.READY) {
                    this.iframeArr[iframeStatusArr[i]['index']].original.src = ""
                    logger.debug("iframe资源入池就绪:", this.iframeArr[iframeStatusArr[i].index])
                }
            }
        })
    }


    loopSetSrc(src, clearMark) {
        let key = IframeObj.getKeyBySrc(src);
        logger.debug("设置详情页src:" + key)
        for (let i = 0; i < this.iframeArr.length; i++) {
            let iframeObj = this.iframeArr[i];
            let status = iframeObj.isReady();
            if (status) {
                iframeObj.use(src, i)
                clearInterval(clearMark)
                return;
            }
        }
    }

    computeWidthProportion(capacity) {
        return 1 / capacity * 100;
    }

    joinOperationPanel(operationPanelTag) {
        if (this.iframeArr.length === 0) {
            throw Error("IframePool未初始化")
        }
        for (let i = 0; i < this.iframeArr.length; i++) {
            operationPanelTag.appendChild(this.iframeArr[i].original)
        }
    }

    clearStatusObj() {
        for (let i = 0; i < this.iframeArr.length; i++) {
            this.iframeArr[i].original.src = "";
        }
        TampermonkeyApi.GmSetValue(IframeObj.IFRAME_STATUS_KEY, "[]");
    }

    poolReady() {
        for (let i = 0; i < this.iframeArr.length; i++) {
            if (!this.iframeArr[i].isReady()) {
                return false;
            }
        }

        // 所有的iframe标签都可用
        return true;
    }

}

class OperationPanel {

    constructor(jobListHandler) {
        // button
        this.batchPushBtn = null
        this.activeSwitchBtn = null

        // inputLab
        // 公司名包含输入框lab
        this.cnInInputLab = null
        // 公司名排除输入框lab
        this.cnExInputLab = null
        // job名称包含输入框lab
        this.jnInInputLab = null
        // job内容排除输入框lab
        this.jcExInputLab = null
        // 薪资范围输入框lab
        this.srInInputLab = null
        // 公司规模范围输入框lab
        this.csrInInputLab = null


        this.topTitle = null

        // boss活跃度检测
        this.bossActiveState = true;

        // 文档说明
        this.docTextArr = [
            "!加油，相信自己😶‍🌫️",
            "1.批量投递：点击批量投递开始批量投简历，请先通过上方Boss的筛选功能筛选大致的范围，然后通过脚本的筛选进一步确认投递目标。",
            "2.重置开关：如果你需要自己浏览工作详情页面，请点击该按钮关闭自动投递。如果不关闭，打开工作详情页，会自动投递并关闭页面。",
            "3.保存配置：保持下方脚本筛选项，用于后续直接使用当前配置。",
            "4.过滤不活跃Boss：打开后会自动过滤掉最近未活跃的Boss发布的工作。以免浪费每天的100次机会。",
            "😏",
            "脚本筛选项介绍：",
            "公司名包含：投递工作的公司名一定包含在当前集合中，模糊匹配，多个使用逗号分割。这个一般不用，如果使用了也就代表只投这些公司的岗位。例子：【阿里,华为】",
            "排除公司名：投递工作的公司名一定不在当前集合中，也就是排除当前集合中的公司，模糊匹配，多个使用逗号分割。例子：【xxx外包】",
            "排除工作内容：会自动检测上文(不是,不,无需等关键字),下文(系统,工具),例子：【外包,上门,销售,驾照】，如果写着是'不是外包''销售系统'那也不会被排除",
            "Job名包含：投递工作的名称一定包含在当前集合中，模糊匹配，多个使用逗号分割。例如：【软件,Java,后端,服务端,开发,后台】",
            "薪资范围：投递工作的薪资范围一定在当前区间中，一定是区间，使用-连接范围。例如：【12-20】",
            "公司规模范围：投递工作的公司人员范围一定在当前区间中，一定是区间，使用-连接范围。例如：【500-20000000】",
            "👻",
        ];

        // 相关链接
        this.aboutLink = [
            [
                ["GreasyFork", "https://greasyfork.org/zh-CN/scripts/468125-boss-batch-push-boss%E7%9B%B4%E8%81%98%E6%89%B9%E9%87%8F%E6%8A%95%E7%AE%80%E5%8E%86",],
                ["GitHub", "https://github.com/yangfeng20/boss_batch_push"],
                ["Gitee", "https://gitee.com/yangfeng20/boss_batch_push"],
                ["作者：yangfeng20", "https://github.com/yangfeng20"],
                ["贡献者：Ocyss_04", "https://github.com/Ocyss"],
                ["去GitHub点个star⭐", "https://github.com/yangfeng20/boss_batch_push"],
            ]
        ]

        this.scriptConfig = new ScriptConfig()
        // 最好不要超过3个，现在有操作频繁补充，但是也需要主要，补偿是同时补偿，也有可能在此频繁
        this.iframePoolCapacity = 3
        this.iframePool = new IframePool(this.iframePoolCapacity)
        this.jobListHandler = jobListHandler;
    }


    init() {
        this.renderOperationPanel();
        this.registerEvent();
    }


    /**
     * 渲染操作面板
     */
    renderOperationPanel() {

        logger.debug("操作面板开始初始化")
        // 1.创建操作按钮并添加到按钮容器中【以下绑定事件处理函数均采用箭头函数作为中转，避免this执行事件对象】
        let btnCssText = "display: inline-block; border-radius: 5px; background-color: rgb(64, 158, 255); color: rgb(255, 255, 255); text-decoration: none; padding: 10px;cursor: pointer";

        // 批量投递按钮
        let batchPushBtn = DOMApi.createTag("button", "批量投递", btnCssText);
        this.batchPushBtn = batchPushBtn
        DOMApi.eventListener(batchPushBtn, "click", () => {
            this.batchPushBtnHandler()
        })

        // 重置开关按钮
        let resetBtn = DOMApi.createTag("button", "重置开关", btnCssText);
        DOMApi.eventListener(resetBtn, "click", () => {
            this.resetBtnHandler()
        })

        // 保存配置按钮
        let storeConfigBtn = DOMApi.createTag("button", "保存配置", btnCssText);
        DOMApi.eventListener(storeConfigBtn, "click", () => {
            this.storeConfigBtnHandler()
        })

        // 过滤不活跃boss按钮
        let activeSwitchBtn = DOMApi.createTag("button", "保存配置", btnCssText);
        this.activeSwitchBtn = activeSwitchBtn
        DOMApi.eventListener(activeSwitchBtn, "click", () => {
            this.activeSwitchBtnHandler(!this.bossActiveState)
        })
        // 默认开启活跃校验
        this.activeSwitchBtnHandler(this.bossActiveState)

        // 将所有button添加到butDiv容器中
        let btnContainerDiv = DOMApi.createTag("div", "", "display: flex; justify-content: space-evenly;");
        btnContainerDiv.appendChild(batchPushBtn);
        btnContainerDiv.appendChild(resetBtn);
        btnContainerDiv.appendChild(storeConfigBtn);
        btnContainerDiv.appendChild(activeSwitchBtn);

        // 2.创建筛选条件输入框并添加到input容器中
        let companyNameIncludeInput = DOMApi.createInputTag("公司名包含", this.scriptConfig.getCompanyNameInclude());
        let companyNameExcludeInput = DOMApi.createInputTag("公司名排除", this.scriptConfig.getCompanyNameExclude());
        let jobNameIncludeInput = DOMApi.createInputTag("工作名包含", this.scriptConfig.getJobNameInclude());
        let jobContentExcludeInput = DOMApi.createInputTag("工作内容排除", this.scriptConfig.getJobContentExclude());
        let salaryRangeInput = DOMApi.createInputTag("薪资范围", this.scriptConfig.getSalaryRange());
        let companyScaleRangeInput = DOMApi.createInputTag("公司规模范围", this.scriptConfig.getCompanyScaleRange());

        let inputContainerDiv = DOMApi.createTag("div", "", "margin:50px;");
        inputContainerDiv.appendChild(companyNameIncludeInput)
        inputContainerDiv.appendChild(companyNameExcludeInput)
        inputContainerDiv.appendChild(jobNameIncludeInput)
        inputContainerDiv.appendChild(jobContentExcludeInput)
        inputContainerDiv.appendChild(salaryRangeInput)
        inputContainerDiv.appendChild(companyScaleRangeInput)

        this.cnInInputLab = companyNameIncludeInput
        this.cnExInputLab = companyNameExcludeInput
        this.jnInInputLab = jobNameIncludeInput
        this.jcExInputLab = jobContentExcludeInput
        this.srInInputLab = salaryRangeInput
        this.csrInInputLab = companyScaleRangeInput

        // 操作面板结构：
        let operationPanel = DOMApi.createTag("div");
        // 说明文档
        // 链接关于
        // 操作按钮
        // 筛选输入框
        // iframe【详情页投递内部页】
        operationPanel.appendChild(this.buildDocDiv())
        operationPanel.appendChild(this.hrTag())
        operationPanel.appendChild(this.buildAbout())
        operationPanel.appendChild(this.hrTag())
        operationPanel.appendChild(btnContainerDiv)
        operationPanel.appendChild(this.hrTag())
        operationPanel.appendChild(inputContainerDiv)
        // 将iframePool 添加到容器中
        this.iframePool.joinOperationPanel(operationPanel)

        // 找到页面锚点并将操作面板添加入页面
        let timingCutPageTask = setInterval(() => {
            logger.debug("等待页面加载，添加操作面板")
            // 页面锚点
            let jobListPageAnchor = document.querySelector(".job-list-wrapper");
            if (!jobListPageAnchor) {
                return;
            }

            jobListPageAnchor.insertBefore(operationPanel, jobListPageAnchor.firstElementChild);
            clearInterval(timingCutPageTask);
            logger.debug("初始化【操作面板】成功")
        }, 1000);
    }


    registerEvent() {
        TampermonkeyApi.GmAddValueChangeListener(ScriptConfig.PUSH_COUNT, this.publishCountChangeEventHandler.bind(this))
    }


    /*-------------------------------------------------构建复合DOM元素--------------------------------------------------*/

    hrTag() {
        // 水平分割线
        return DOMApi.createTag("hr", "", "margin-bottom: 20px;margin-top: 20px;width:90%;margin-left: 5%;margin-right: 5%;");
    }

    buildDocDiv() {
        const docDiv = DOMApi.createTag("div", "", "background-color: rgb(242, 242, 242); padding: 5px; width: 100%;")
        let txtDiv = DOMApi.createTag("div");
        const title = DOMApi.createTag("h3", "操作说明(点击折叠)", "")
        docDiv.appendChild(title)
        docDiv.appendChild(txtDiv)
        for (let i = 0; i < this.docTextArr.length; i++) {
            const textTag = document.createElement("p");
            textTag.style.color = "#666";
            textTag.innerHTML = this.docTextArr[i];
            txtDiv.appendChild(textTag)
        }

        // 点击title，内部元素折叠
        DOMApi.eventListener(title, "click", () => {
            let divDisplay = txtDiv.style.display;
            if (divDisplay === 'block' || divDisplay === '') {
                txtDiv.style.display = 'none';
            } else {
                txtDiv.style.display = 'block';

            }
        })
        return docDiv;
    }

    buildAbout() {
        let aboutDiv = DOMApi.createTag("div");

        let topTitle = DOMApi.createTag("h2");
        this.topTitle = topTitle;
        topTitle.textContent = `Boos直聘投递助手（${this.scriptConfig.getVal(ScriptConfig.PUSH_COUNT, 0)}次） 脚本对您有所帮助；记得点个star⭐`;
        aboutDiv.appendChild(topTitle)

        this.aboutLink.forEach((linkMap) => {
            let about = DOMApi.createTag("p", "", "padding-top: 12px;");
            linkMap.forEach((item) => {
                const a = document.createElement("a");
                a.innerText = item[0];
                a.href = item[1];
                a.target = "_blank";
                a.style.margin = "0 20px 0 0";
                about.appendChild(a);
            });
            aboutDiv.appendChild(about);
        });

        return aboutDiv;
    }


    /*-------------------------------------------------操作面板事件处理--------------------------------------------------*/


    batchPushBtnHandler() {
        this.jobListHandler.batchPushHandler()

    }

    resetBtnHandler() {
        this.scriptConfig.setVal(ScriptConfig.SCRIPT_ENABLE, false)
        this.scriptConfig.setVal(ScriptConfig.PUSH_LIMIT, false)
        logger.debug("重置脚本开关成功")
        window.alert("重置脚本开关成功");
    }

    readInputConfig() {
        this.scriptConfig.setCompanyNameInclude(DOMApi.getInputVal(this.cnInInputLab))
        this.scriptConfig.setCompanyNameExclude(DOMApi.getInputVal(this.cnExInputLab))
        this.scriptConfig.setJobNameInclude(DOMApi.getInputVal(this.jnInInputLab))
        this.scriptConfig.setJobContentExclude(DOMApi.getInputVal(this.jcExInputLab))
        this.scriptConfig.setSalaryRange(DOMApi.getInputVal(this.srInInputLab))
        this.scriptConfig.setCompanyScaleRange(DOMApi.getInputVal(this.csrInInputLab))
    }

    storeConfigBtnHandler() {
        // 先修改配置对象内存中的值，然后更新到本地储存中
        this.readInputConfig()
        logger.debug("config", this.scriptConfig)
        this.scriptConfig.storeConfig()
    }

    activeSwitchBtnHandler(isOpen) {
        this.bossActiveState = isOpen;
        if (this.bossActiveState) {
            this.activeSwitchBtn.innerText = "过滤不活跃Boss:已开启";
            this.activeSwitchBtn.style.backgroundColor = "#67c23a";
        } else {
            this.activeSwitchBtn.innerText = "过滤不活跃Boss:已关闭";
            this.activeSwitchBtn.style.backgroundColor = "#f56c6c";
        }
        this.scriptConfig.setVal(ScriptConfig.ACTIVE_ENABLE, isOpen)
    }

    publishCountChangeEventHandler(key, oldValue, newValue, isOtherScriptOther) {
        this.topTitle.textContent = `Boos直聘投递助手（${newValue}次） 脚本对您有所帮助；记得点个star⭐`;
        logger.debug("投递次数变更事件", {key, oldValue, newValue, isOtherScriptOther})
    }

    /*-------------------------------------------------other method--------------------------------------------------*/

    changeBatchPublishBtn(start) {
        if (start) {
            this.batchPushBtn.innerHTML = "停止投递"
            this.batchPushBtn.style.backgroundColor = "#c6102c";
        } else {
            this.batchPushBtn.innerHTML = "批量投递"
            this.batchPushBtn.style.backgroundColor = "#409eff";
        }
    }

}

class ScriptConfig extends TampermonkeyApi {

    static LOCAL_CONFIG = "config";
    static PUSH_COUNT = "pushCount:" + ScriptConfig.getCurDay();
    static SCRIPT_ENABLE = "script_enable";
    static ACTIVE_ENABLE = "activeEnable";
    static PUSH_LIMIT = "push_limit";

    // 公司名包含输入框lab
    static cnInKey = "companyNameInclude"
    // 公司名排除输入框lab
    static cnExKey = "companyNameExclude"
    // job名称包含输入框lab
    static jnInKey = "jobNameInclude"
    // job内容排除输入框lab
    static jcExKey = "jobContentExclude"
    // 薪资范围输入框lab
    static srInKey = "salaryRange"
    // 公司规模范围输入框lab
    static csrInKey = "companyScaleRange"


    constructor() {
        super();
        this.configObj = {}

        this.loaderConfig()
    }

    static getCurDay() {
        // 创建 Date 对象获取当前时间
        const currentDate = new Date();

        // 获取年、月、日、小时、分钟和秒
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');

        // 格式化时间字符串
        return `${year}-${month}-${day}`;
    }

    static pushCountIncr() {
        let number = TampermonkeyApi.GmGetValue(ScriptConfig.PUSH_COUNT, 0);
        TampermonkeyApi.GmSetValue(ScriptConfig.PUSH_COUNT, ++number)
    }

    getVal(key, defVal) {
        return TampermonkeyApi.GmGetValue(key, defVal)
    }

    setVal(key, val) {
        TampermonkeyApi.GmSetValue(key, val)
    }

    getArrConfig(key, isArr) {
        let arr = this.configObj[key];
        if (isArr) {
            return arr;
        }
        if (!arr) {
            return "";
        }
        return arr.join(",");
    }

    getStrConfig(key) {
        let str = this.configObj[key];
        if (!str) {
            return "";
        }
        return str;
    }

    getCompanyNameInclude(isArr) {
        return this.getArrConfig(ScriptConfig.cnInKey, isArr);
    }


    getCompanyNameExclude(isArr) {
        return this.getArrConfig(ScriptConfig.cnExKey, isArr);
    }

    getJobContentExclude(isArr) {
        return this.getArrConfig(ScriptConfig.jcExKey, isArr);
    }

    getJobNameInclude(isArr) {
        return this.getArrConfig(ScriptConfig.jnInKey, isArr);
    }


    getSalaryRange() {
        return this.getStrConfig(ScriptConfig.srInKey);
    }

    getCompanyScaleRange() {
        return this.getStrConfig(ScriptConfig.csrInKey);
    }


    setCompanyNameInclude(val) {
        return this.configObj[ScriptConfig.cnInKey] = val.split(",");
    }

    setCompanyNameExclude(val) {
        this.configObj[ScriptConfig.cnExKey] = val.split(",");
    }

    setJobNameInclude(val) {
        this.configObj[ScriptConfig.jnInKey] = val.split(",");
    }

    setJobContentExclude(val) {
        this.configObj[ScriptConfig.jcExKey] = val.split(",");
    }


    setSalaryRange(val) {
        this.configObj[ScriptConfig.srInKey] = val;
    }

    setCompanyScaleRange(val) {
        this.configObj[ScriptConfig.csrInKey] = val;
    }

    /**
     * 存储配置到本地存储中
     */
    storeConfig() {
        let configStr = JSON.stringify(this.configObj);
        TampermonkeyApi.GmSetValue(ScriptConfig.LOCAL_CONFIG, configStr);
        logger.info("存储配置到本地储存", configStr)
    }

    /**
     * 从本地存储中加载配置
     */
    loaderConfig() {
        let localConfig = TampermonkeyApi.GmGetValue(ScriptConfig.LOCAL_CONFIG, "");
        if (!localConfig) {
            logger.warn("未加载到本地配置")
            return;
        }

        this.configObj = JSON.parse(localConfig);
        logger.info("成功加载本地配置", this.configObj)
    }


}

class BossListDOMApi {

    static getRandomNumber() {
        return Math.floor(Math.random() * (150 - 100 + 1)) + 100;
    }

    getJobList() {
        return document.querySelectorAll(".job-card-wrapper");
    }

    static getJobTitle(jobTag) {
        let innerText = jobTag.querySelector(".job-title").innerText;
        return innerText.replace("\n", " ");
    }

    getCompanyName(jobTag) {
        return jobTag.querySelector(".company-name").innerText;
    }

    getJobName(jobTag) {
        return jobTag.querySelector(".job-name").innerText;
    }

    getSalaryRange(jobTag) {
        let text = jobTag.querySelector(".salary").innerText;
        if (text.includes(".")) {
            // 1-2K·13薪
            return text.split("·")[0];
        }
        return text;
    }

    getCompanyScaleRange(jobTag) {
        return jobTag.querySelector(".company-tag-list").lastElementChild.innerHTML;
    }

    /**
     * 是否为未沟通
     * @param jobTag
     */
    isNotCommunication(jobTag) {
        const jobStatusStr = jobTag.querySelector(".start-chat-btn").innerText;
        return jobStatusStr.includes("立即沟通");
    }


    static getDetailSrc(jobTag) {
        return jobTag.querySelector(".job-card-left").href;
    }

    nextPage() {
        let nextPageBtn = document.querySelector(".ui-icon-arrow-right");

        if (nextPageBtn.parentElement.className === "disabled") {
            // 没有下一页
            return;

        }
        nextPageBtn.click();
        return true;
    }
}

class BossDetailDOMApi {

    getJobTitle() {
        let divTag = document.querySelector(".name");
        return divTag.querySelector("h1").textContent;
    }

    checkBossActive() {
        const activeEle = document.querySelector(".boss-active-time");
        if (!activeEle) {
            return true;
        }
        const activeText = activeEle.innerText;
        logger.debug("当前JobBoss活跃度：" + activeText)
        return !(activeText.includes("月") || activeText.includes("年"));
    }

    getStartChatBtn() {

        // 立即沟通或者继续沟通按钮
        const handlerButton = document.querySelector(".btn-startchat");
        if (!handlerButton.innerText.includes("立即沟通")) {
            return;
        }

        // 立即沟通才返回
        return handlerButton;
    }

    getStartChatDDialog() {
        // 点击立即沟通后弹出的对话框，可能是沟通限制100次，可能是投递成功
        return document.querySelector(".dialog-container");
    }


    getJobContent() {
        let jobTextDivTag = document.querySelector(".job-sec-text");
        return jobTextDivTag.innerText;
    }

    isOften() {
        let toast = document.querySelector(".toast-con");
        if (toast) {
            return toast.innerHTML.includes("您的操作过于频繁");
        }
    }

    getPublishResultState(dialogTag) {
        let dialogText = dialogTag.innerHTML;
        if (dialogText.includes("人数已达上限")) {
            return JobDetailPageHandler.PUBLISH_LIMIT;
        }
        if (dialogText.includes("已向BOSS发送消息") || dialogText.includes("已发送")) {
            return JobDetailPageHandler.PUBLISH_SUCCESS;
        }
        //工作经历不匹配\n\n您的工作经历与该岗位要求不匹配，得到回复的概率较低，建议您选择其他职位沟通。\n\n个人中心
        if (dialogText.includes("不匹配") && dialogText.includes("个人中心")) {
            return JobDetailPageHandler.PUBLISH_NOT_MATCH;
        }

        logger.debug("弹出框文本内容：" + dialogText)
        return -1;

    }
}


class JobDetailPageHandler extends BossDetailDOMApi {

    static PUBLISH_SUCCESS = 0
    static PUBLISH_LIMIT = 1
    static PUBLISH_NOT_MATCH = 2

    constructor() {
        super()
        this.scriptConfig = new ScriptConfig()
        this.init()
    }


    init() {

        if (!this.scriptConfig.getVal(ScriptConfig.SCRIPT_ENABLE, false)) {
            logger.info("脚本未开启")
            IframeObj.release(document.URL)
            return;
        }

        // if (logger.level === 'debug') {
        //     return;
        // }

        let jobTitle = super.getJobTitle();
        if (this.scriptConfig.getVal(ScriptConfig.ACTIVE_ENABLE, true) && !super.checkBossActive()) {
            logger.info("【详情页】当前job被过滤：【" + jobTitle + "】 原因：不满足活跃度检查")
            IframeObj.release(document.URL)
            return;
        }

        let jobContentExclude = this.scriptConfig.getJobContentExclude(true);
        if (!this.semanticMatch(jobContentExclude, super.getJobContent())) {
            logger.info("【详情页】当前job被过滤：【" + jobTitle + "】 原因：不满足配置工作内容")
            IframeObj.release(document.URL)
            return;
        }

        this.publish()
    }


    publish() {
        let startChatBtn = super.getStartChatBtn();
        if (!startChatBtn) {
            IframeObj.release(document.URL)
            return;
        }

        // 存在沟通按钮则点击
        startChatBtn.click();

        let checkOftenTask = setTimeout(() => {
            clearInterval(checkOftenTask)
            if (super.isOften()) {
                setTimeout(() => {
                    this.publish();
                }, 1000 + BossListDOMApi.getRandomNumber())
            }
        }, 500 + BossListDOMApi.getRandomNumber());

        // 需要等待发送请求且页面刷新
        setTimeout(() => {
            this.handlerDialog()
        }, 3000 + BossListDOMApi.getRandomNumber())
    }


    handlerDialog() {
        let dialog = super.getStartChatDDialog();
        if (dialog) {
            let publishResultState = super.getPublishResultState(dialog);
            switch (publishResultState) {
                case JobDetailPageHandler.PUBLISH_LIMIT:
                    this.scriptConfig.setVal(ScriptConfig.PUSH_LIMIT, true);
                    break;
                case JobDetailPageHandler.PUBLISH_SUCCESS:
                    logger.debug("详情页正常投递结束")
                    ScriptConfig.pushCountIncr();
                    break
                case JobDetailPageHandler.PUBLISH_NOT_MATCH:
                    logger.warn("工作经历不匹配，boss限制投递")
                    break
            }
        }
        IframeObj.release(document.URL)
    }


    semanticMatch(configArr, content) {
        for (let i = 0; i < configArr.length; i++) {
            if (!configArr[i]) {
                return true;
            }
            let re = new RegExp("(?<!(不|无).{0,5})" + configArr[i] + "(?!系统|软件|工具|服务)");
            if (re.test(content)) {
                return true;
            }
        }

        return false;
    }
}

class JobListPageHandler extends BossListDOMApi {

    constructor() {
        super();
        this.operationPanel = new OperationPanel(this);
        this.scriptConfig = this.operationPanel.scriptConfig
        this.operationPanel.init()
        this.publishState = false
        this.publistStop = false
        this.matchedCount = 0
    }

    /**
     * 点击批量投递事件处理
     */
    batchPushHandler() {
        // 清理 【iframe池的使用状态】，确保每次点击批量投递，池都是可用的
        this.operationPanel.iframePool.clearStatusObj()
        this.publistStop = false
        this.changeBatchPublishState(!this.publishState);
        if (!this.publishState) {
            return;
        }
        // 每次读取操作面板中用户实时输入的值
        this.operationPanel.readInputConfig()

        this.loopPublish()
    }

    loopPublish() {
        // 过滤当前页满足条件的job并投递
        this.filterCurPageAndPush()

        let nextPageTask = setInterval(() => {
            // 等待iframe池可用
            logger.debug("等待iframe池完全可用-准备投递下一页")
            if (this.operationPanel.iframePool.poolReady()) {
                clearInterval(nextPageTask)
                if (this.publistStop) {
                    logger.info("投递结束，异常结束")
                    return;
                }
                if (!super.nextPage()) {
                    logger.info("投递结束，没有下一页")
                    return;
                }

                // 点击下一页，需要等待页面元素变化，否则将重复拿到当前页的jobList
                setTimeout(() => {
                    this.loopPublish()
                }, 1000)

            }
        }, 10000);
    }

    changeBatchPublishState(publishState) {
        this.publishState = publishState;
        this.operationPanel.changeBatchPublishBtn(publishState)
        this.scriptConfig.setVal(ScriptConfig.SCRIPT_ENABLE, true)
    }

    filterCurPageAndPush() {
        let curPageMatchedCount = 0;
        let jobList = super.getJobList();
        for (let i = 0; i < jobList.length; i++) {
            if (!this.publishState) {
                logger.info("已停止批量投递")
                return;
            }
            let jobTag = jobList[i];
            let jobTitle = BossListDOMApi.getJobTitle(jobTag);
            if (!this.matchJob(jobTag)) {
                continue;
            }
            logger.info("Job列表页条件筛选通过：" + jobTitle)
            curPageMatchedCount++
            // 异步执行投递动作【给iframe标签设置src】并绑定this
            this.asyncHandlerPublish(jobTag, this.publish.bind(this))
        }
        logger.info("本轮投递满足条件的job数量：" + curPageMatchedCount)
        this.matchedCount += curPageMatchedCount
    }

    /**
     * 异步执行立即沟通逻辑
     * 增加扩展点
     * @param jobTag
     * @param callback
     */
    asyncHandlerPublish(jobTag, callback) {
        new Promise((resolve) => {
            this.publishPre(jobTag)
            resolve()
        }).then(() => {
            callback(jobTag)
        }).catch(e => {
            logger.error("异步执行投递出现问题", e)
            this.operationPanel.changeBatchPublishBtn(false)
            this.publistStop = true
        }).finally(() => {

        })
    }

    publishPre(jobTag) {
        logger.debug("投递前检查是否100次限制：" + BossListDOMApi.getJobTitle(jobTag))
        let pushLimit = TampermonkeyApi.GmGetValue(ScriptConfig.PUSH_LIMIT, false);
        if (!pushLimit) {
            return;
        }
        throw Error("投递限制");
    }

    publish(jobTag) {
        let src = BossListDOMApi.getDetailSrc(jobTag);
        let jobTitle = BossListDOMApi.getJobTitle(jobTag);
        if (!src || this.publistStop) {
            return;
        }
        let count = 0;
        let setSrcTask = setInterval(() => {
            logger.debug("等待池中可用的iframe;准备设置src进入详情页")
            if (++count === Math.ceil(100 / this.operationPanel.iframePool.capacity)) {
                // iframePool中一直没有可用的iframe，丢弃当前job
                logger.warn("池中无可用iframe;超时清理掉的job：" + jobTitle)
                clearInterval(setSrcTask)
            }
            this.operationPanel.iframePool.loopSetSrc(src, setSrcTask)
        }, 3000 + BossListDOMApi.getRandomNumber());
    }


    matchJob(jobTag) {
        let jobTitle = BossListDOMApi.getJobTitle(jobTag);
        let pageCompanyName = super.getCompanyName(jobTag);

        // 不满足配置公司名
        if (!this.fuzzyMatch(this.scriptConfig.getCompanyNameInclude(true),
            pageCompanyName, true)) {
            logger.debug("当前公司名：" + pageCompanyName)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足配置公司名")
            return false;
        }

        // 满足排除公司名
        if (this.fuzzyMatch(this.scriptConfig.getCompanyNameExclude(true),
            pageCompanyName, false)) {
            logger.debug("当前公司名：" + pageCompanyName)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：满足排除公司名")
            return false;
        }

        // 不满足配置工作名
        let pageJobName = super.getJobName(jobTag);
        if (!this.fuzzyMatch(this.scriptConfig.getJobNameInclude(true),
            pageJobName, true)) {
            logger.debug("当前工作名：" + pageJobName)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足配置工作名")
            return false;
        }

        // 不满足新增范围
        let pageSalaryRange = super.getSalaryRange(jobTag);
        let salaryRange = this.scriptConfig.getSalaryRange();
        if (!this.rangeMatch(salaryRange, pageSalaryRange)) {
            logger.debug("当前薪资范围：" + pageSalaryRange)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足薪资范围")
            return false;
        }


        let pageCompanyScaleRange = this.scriptConfig.getCompanyScaleRange();
        if (!this.rangeMatch(pageCompanyScaleRange, super.getCompanyScaleRange(jobTag))) {
            logger.debug("当前公司规模范围：" + pageCompanyScaleRange)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足公司规模范围")
            return false;
        }

        if (!super.isNotCommunication(jobTag)) {
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：已经沟通过")
            return false;
        }


        return true;
    }


    /**
     * 模糊匹配
     * @param arr
     * @param input
     * @param emptyStatus
     * @returns {boolean|*}
     */
    fuzzyMatch(arr, input, emptyStatus) {
        if (arr.length === 0) {
            // 为空时直接返回指定的空状态
            return emptyStatus;
        }
        input = input.toLowerCase();
        let emptyEle = false;
        // 遍历数组中的每个元素
        for (let i = 0; i < arr.length; i++) {
            // 如果当前元素包含指定值，则返回 true
            let arrEleStr = arr[i].toLowerCase();
            if (arrEleStr.length === 0) {
                emptyEle = true;
                continue;
            }
            if (arrEleStr.includes(input) || input.includes(arrEleStr)) {
                return true;
            }
        }

        // 所有元素均为空元素【返回空状态】
        if (emptyEle) {
            return emptyStatus;
        }

        // 如果没有找到匹配的元素，则返回 false
        return false;
    }


    // 范围匹配
    rangeMatch(rangeStr, input, by = 1) {
        if (!rangeStr) {
            return true;
        }
        // 匹配定义范围的正则表达式
        let reg = /^(\d+)(?:-(\d+))?$/;
        let match = rangeStr.match(reg);

        if (match) {
            let start = parseInt(match[1]) * by;
            let end = parseInt(match[2] || match[1]) * by;

            // 如果输入只有一个数字的情况
            if (/^\d+$/.test(input)) {
                let number = parseInt(input);
                return number >= start && number <= end;
            }

            // 如果输入有两个数字的情况
            let inputReg = /^(\d+)(?:-(\d+))?/;
            let inputMatch = input.match(inputReg);
            if (inputMatch) {
                let inputStart = parseInt(inputMatch[1]);
                let inputEnd = parseInt(inputMatch[2] || inputMatch[1]);
                return (
                    (inputStart >= start && inputStart <= end) ||
                    (inputEnd >= start && inputEnd <= end)
                );
            }
        }

        // 其他情况均视为不匹配
        return false;
    }

}


(function () {

    const list_url = "web/geek/job";
    const recommend_url = "web/geek/recommend";
    const detail_url = "job_detail";

    if (document.URL.includes(list_url) || document.URL.includes(recommend_url)) {
        window.addEventListener("load", () => {
            new JobListPageHandler()
        });
    } else if (document.URL.includes(detail_url)) {
        window.addEventListener("load", () => {
            new JobDetailPageHandler()
        });
    }
})();