// ==UserScript==
// @name         Boss Batch Push [Boss直聘批量投简历]
// @description  boss直聘批量简历投递
// @namespace    maple
// @version      1.1.5
// @author       maple,Ocyss
// @license      Apache License 2.0
// @run-at       document-start
// @match        https://www.zhipin.com/*
// @include      https://www.zhipin.com
// @require      https://unpkg.com/maple-lib@1.0.3/log.js
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

let logger = Logger.log("info")

class BossBatchExp extends Error {
    constructor(msg) {
        super(msg);
        this.name = "BossBatchExp";
    }
}

class JobNotMatchExp extends BossBatchExp {
    constructor(msg) {
        super(msg);
        this.name = "JobNotMatchExp";
    }
}

class PublishLimitExp extends BossBatchExp {
    constructor(msg) {
        super(msg);
        this.name = "PublishLimitExp";
    }
}

class FetchJobDetailFailExp extends BossBatchExp {
    constructor(msg) {
        super(msg);
        this.name = "FetchJobDetailFailExp";
    }
}

class SendPublishExp extends BossBatchExp {
    constructor(msg) {
        super(msg);
        this.name = "SendPublishExp";
    }
}

class PublishStopExp extends BossBatchExp {
    constructor(msg) {
        super(msg);
        this.name = "PublishStopExp";
    }
}


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

class Tools {


    static job_detail_securityId_Regex = /var _jobInfo = {[^}]*securityId:'(.*?)'/;
    static job_detail_job_content_Regex = /<div class="job-sec-text">(.*?)<\/div>/s;


    /**
     * 模糊匹配
     * @param arr
     * @param input
     * @param emptyStatus
     * @returns {boolean|*}
     */
    static fuzzyMatch(arr, input, emptyStatus) {
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
    static rangeMatch(rangeStr, input, by = 1) {
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

    /**
     * 语义匹配
     * @param configArr
     * @param content
     * @returns {boolean}
     */
    static semanticMatch(configArr, content) {
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

    static bossIsActive(activeText) {
        return !(activeText.includes("月") || activeText.includes("年"));
    }

    static getRandomNumber(startMs, endMs) {
        return Math.floor(Math.random() * (endMs - startMs + 1)) + startMs;
    }

    static getCookieValue(key) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [cookieKey, cookieValue] = cookie.trim().split('=');
            if (cookieKey === key) {
                return decodeURIComponent(cookieValue);
            }
        }
        return null;
    }

    static parseURL(url) {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/');
        const jobId = pathSegments[2].replace('.html', '');
        const lid = urlObj.searchParams.get('lid');
        const securityId = urlObj.searchParams.get('securityId');

        return {
            securityId,
            jobId,
            lid
        };
    }

    static htmlParseParams(html) {
        let securityIdMatch = html.match(Tools.job_detail_securityId_Regex);
        let jobContentMatch = html.match(Tools.job_detail_job_content_Regex);


        return {
            securityId: securityIdMatch && securityIdMatch[1],
            jobContent: jobContentMatch && jobContentMatch[1].replaceAll("<br/>", "\n"),
        }
    }

    static queryString(baseURL, queryParams) {
        const queryString = Object.entries(queryParams)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');

        return `${baseURL}?${queryString}`;
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
    // 投递锁是否被占用，可重入；value表示当前正在投递的job
    static PUSH_LOCK = "push_lock";

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

class BossDOMApi {


    static getJobList() {
        return document.querySelectorAll(".job-card-wrapper");
    }

    static getJobTitle(jobTag) {
        let innerText = jobTag.querySelector(".job-title").innerText;
        return innerText.replace("\n", " ");
    }

    static getCompanyName(jobTag) {
        return jobTag.querySelector(".company-name").innerText;
    }

    static getJobName(jobTag) {
        return jobTag.querySelector(".job-name").innerText;
    }

    static getSalaryRange(jobTag) {
        let text = jobTag.querySelector(".salary").innerText;
        if (text.includes(".")) {
            // 1-2K·13薪
            return text.split("·")[0];
        }
        return text;
    }

    static getCompanyScaleRange(jobTag) {
        return jobTag.querySelector(".company-tag-list").lastElementChild.innerHTML;
    }

    /**
     * 是否为未沟通
     * @param jobTag
     */
    static isNotCommunication(jobTag) {
        const jobStatusStr = jobTag.querySelector(".start-chat-btn").innerText;
        return jobStatusStr.includes("立即沟通");
    }

    static getJobDetailUrlParams(jobTag) {
        return jobTag.querySelector(".job-card-left").href.split("?")[1]
    }

    static getDetailSrc(jobTag) {
        return jobTag.querySelector(".job-card-left").href;
    }

    static nextPage() {
        let nextPageBtn = document.querySelector(".ui-icon-arrow-right");

        if (nextPageBtn.parentElement.className === "disabled") {
            // 没有下一页
            return;

        }
        nextPageBtn.click();
        return true;
    }
}


class JobListPageHandler {

    constructor() {
        this.operationPanel = new OperationPanel(this);
        this.scriptConfig = this.operationPanel.scriptConfig
        this.operationPanel.init()
        this.publishState = false
        this.nextPage = false
        this.mock = false
    }

    /**
     * 点击批量投递事件处理
     */
    batchPushHandler() {
        this.changeBatchPublishState(!this.publishState);
        if (!this.publishState) {
            return;
        }
        // 每次投递前清空投递锁，未被占用
        TampermonkeyApi.GmSetValue(ScriptConfig.PUSH_LOCK, "")
        // 每次读取操作面板中用户实时输入的值
        this.operationPanel.readInputConfig()

        this.loopPublish()
    }

    loopPublish() {
        // 过滤当前页满足条件的job并投递
        this.filterCurPageAndPush()

        // 等待处理完当前页的jobList在投递下一页
        let nextPageTask = setInterval(() => {
            if (!this.nextPage) {
                logger.debug("正在等待当前页投递完毕...")
                return;
            }
            clearInterval(nextPageTask)

            if (!this.publishState) {
                logger.info("投递结束")
                this.changeBatchPublishState(false);
                return;
            }
            if (!BossDOMApi.nextPage()) {
                logger.info("投递结束，没有下一页")
                this.changeBatchPublishState(false);
                return;
            }

            // 点击下一页，需要等待页面元素变化，否则将重复拿到当前页的jobList
            setTimeout(() => {
                this.loopPublish()
            }, 1000)
        }, 3000);
    }

    changeBatchPublishState(publishState) {
        this.publishState = publishState;
        this.operationPanel.changeBatchPublishBtn(publishState)
        this.scriptConfig.setVal(ScriptConfig.SCRIPT_ENABLE, true)
    }

    filterCurPageAndPush() {
        this.nextPage = false;
        let notMatchCount = 0;
        let publishResultCount = {
            successCount: 0,
            failCount: 0,
        }
        let jobList = BossDOMApi.getJobList();
        logger.debug("jobList", jobList)

        let process = Array.from(jobList).reduce((promiseChain, jobTag) => {
            let jobTitle = BossDOMApi.getJobTitle(jobTag);
            return promiseChain
                .then(() => this.matchJobPromise(jobTag))
                .then(() => this.reqJobDetail(jobTag))
                .then(jobCardJson => this.jobDetailFilter(jobTag, jobCardJson))
                .then(() => this.sendPublishReq(jobTag))
                .then(publishResult => this.handlerPublishResult(jobTag, publishResult, publishResultCount))
                .catch(error => {
                    // 在catch中return是结束当前元素，不会结束整个promiseChain；
                    // 需要结束整个promiseChain，在catch throw exp,但还会继续执行下一个元素catch中的逻辑
                    switch (true) {
                        case error instanceof JobNotMatchExp:
                            ++notMatchCount;
                            break;

                        case error instanceof FetchJobDetailFailExp:
                            logger.error("job详情页数据获取失败：" + error);
                            break;

                        case error instanceof SendPublishExp:
                            logger.error("投递失败;" + jobTitle + " 原因：" + error.message);
                            publishResultCount.failCount++
                            break;

                        case error instanceof PublishLimitExp:
                            TampermonkeyApi.GmSetValue(ScriptConfig.PUSH_LIMIT, true);
                            logger.error("投递停止; 原因：" + error.message);
                            throw new PublishStopExp(error.message)

                        case error instanceof PublishStopExp:
                            // 结束整个投递链路
                            throw error;
                        default:
                            logger.debug(BossDOMApi.getDetailSrc(jobTag) + "-->未捕获投递异常:", error);
                    }
                })
        }, Promise.resolve()).catch(error => {
            // 这里只是让报错不显示，不需要处理异常

        });


        // 当前页jobList中所有job处理完毕执行
        process.finally(() => {
            logger.info("当前页投递完毕---------------------------------------------------")
            logger.info("不满足条件的job数量：" + notMatchCount)
            logger.info("投递Job成功数量：" + publishResultCount.successCount)
            logger.info("投递Job失败数量：" + publishResultCount.failCount)
            logger.info("当前页投递完毕---------------------------------------------------")
            this.nextPage = true;
        })
    }


    reqJobDetail(jobTag, retries = 3) {
        return new Promise((resolve, reject) => {
            if (retries === 0) {
                return reject(new FetchJobDetailFailExp());
            }

            let params = BossDOMApi.getJobDetailUrlParams(jobTag);
            axios.get("https://www.zhipin.com/wapi/zpgeek/job/card.json?" + params, {timeout: 5000})
                .then(resp => {
                    return resolve(resp.data.zpData.jobCard);
                }).catch(error => {
                logger.debug("获取详情页异常正在重试:", error)
                return this.reqJobDetail(jobTag, retries - 1)
            })
        })
    }

    jobDetailFilter(jobTag, jobCardJson) {
        let jobTitle = BossDOMApi.getJobTitle(jobTag);

        return new Promise((resolve, reject) => {

            // 工作详情活跃度检查
            let activeCheck = TampermonkeyApi.GmGetValue(ScriptConfig.ACTIVE_ENABLE, true);
            let activeTimeDesc = jobCardJson.activeTimeDesc;
            if (activeCheck && !Tools.bossIsActive(activeTimeDesc)) {
                logger.debug("当前boss活跃度：" + activeTimeDesc)
                logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足活跃度检查")
                return reject(new JobNotMatchExp())
            }

            // 工作内容检查
            let jobContentExclude = this.scriptConfig.getJobContentExclude(true);
            if (!Tools.semanticMatch(jobContentExclude, jobCardJson.postDescription)) {
                logger.debug("当前job工作内容：" + jobCardJson.postDescription)
                logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足工作内容")
                return reject(new JobNotMatchExp())
            }

            setTimeout(() => {
                // 获取不同的延时，避免后面投递时一起导致频繁
                return resolve();
            }, Tools.getRandomNumber(100, 200))
        })
    }

    handlerPublishResult(jobTag, result, publishResultCount) {
        return new Promise((resolve, reject) => {
            if (result.message === 'Success' && result.code === 0) {
                // 增加投递数量，触发投递监听，更新页面投递计数
                ScriptConfig.pushCountIncr()
                publishResultCount.successCount++
                logger.info("投递成功：" + BossDOMApi.getJobTitle(jobTag))
                return resolve()
            }

            if (result.message.includes("今日沟通人数已达上限")) {
                return reject(new PublishLimitExp(result.message))
            }

            return reject(new SendPublishExp(result.message))
        })
    }

    sendPublishReq(jobTag, errorMsg, retries = 3) {
        let jobTitle = BossDOMApi.getJobTitle(jobTag);
        if (retries === 3) {
            logger.debug("正在投递：" + jobTitle)
        }
        return new Promise((resolve, reject) => {
            if (retries === 0) {
                return reject(new SendPublishExp(errorMsg));
            }
            if (!this.publishState) {
                return reject(new PublishStopExp("停止投递"))
            }

            // 检查投递限制
            let pushLimit = TampermonkeyApi.GmGetValue(ScriptConfig.PUSH_LIMIT, false);
            if (pushLimit) {
                return reject(new PublishLimitExp("boss投递限制每天100次"))
            }

            if (this.mock) {
                let result = {
                    message: 'Success',
                    code: 0
                }
                return resolve(result)
            }

            let src = BossDOMApi.getDetailSrc(jobTag);
            let paramObj = Tools.parseURL(src);
            let publishUrl = "https://www.zhipin.com/wapi/zpgeek/friend/add.json"
            let url = Tools.queryString(publishUrl, paramObj);

            let pushLockTask = setInterval(() => {
                if (!this.publishState) {
                    clearInterval(pushLockTask)
                    return reject(new PublishStopExp())
                }
                let lock = TampermonkeyApi.GmGetValue(ScriptConfig.PUSH_LOCK, "");
                if (lock && lock !== jobTitle) {
                    return logger.debug("投递锁被其他job占用：" + lock)
                }
                // 停止锁检查并占用投递锁
                clearInterval(pushLockTask)
                TampermonkeyApi.GmSetValue(ScriptConfig.PUSH_LOCK, jobTitle)
                logger.debug("锁定投递锁：" + jobTitle)

                // 投递请求
                axios.post(url, null, {headers: {"Zp_token": Tools.getCookieValue("geek_zp_token")}})
                    .then(resp => {
                        if (resp.data.code === 1 && resp.data?.zpData?.bizData?.chatRemindDialog?.content) {
                            // 某些条件不满足，boss限制投递，无需重试，在结果处理器中处理
                            return resolve({
                                code: 1,
                                message: resp.data?.zpData?.bizData?.chatRemindDialog?.content
                            })
                        }

                        if (resp.data.code !== 0) {
                            throw new SendPublishExp(resp.data.message)
                        }
                        return resolve(resp.data);
                    }).catch(error => {
                    logger.debug("投递异常正在重试:" + jobTitle, error)
                    return resolve(this.sendPublishReq(jobTag, error.message, retries - 1))
                }).finally(() => {
                    // 释放投递锁
                    logger.debug("释放投递锁：" + jobTitle)
                    TampermonkeyApi.GmSetValue(ScriptConfig.PUSH_LOCK, "")
                })
            }, 500);
        })
    }


    matchJobPromise(jobTag) {
        return new Promise(((resolve, reject) => {
            if (!this.matchJob(jobTag)) {
                return reject(new JobNotMatchExp())
            }
            return resolve(jobTag)
        }))
    }

    matchJob(jobTag) {
        let jobTitle = BossDOMApi.getJobTitle(jobTag);
        let pageCompanyName = BossDOMApi.getCompanyName(jobTag);

        // 不满足配置公司名
        if (!Tools.fuzzyMatch(this.scriptConfig.getCompanyNameInclude(true),
            pageCompanyName, true)) {
            logger.debug("当前公司名：" + pageCompanyName)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足配置公司名")
            return false;
        }

        // 满足排除公司名
        if (Tools.fuzzyMatch(this.scriptConfig.getCompanyNameExclude(true),
            pageCompanyName, false)) {
            logger.debug("当前公司名：" + pageCompanyName)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：满足排除公司名")
            return false;
        }

        // 不满足配置工作名
        let pageJobName = BossDOMApi.getJobName(jobTag);
        if (!Tools.fuzzyMatch(this.scriptConfig.getJobNameInclude(true),
            pageJobName, true)) {
            logger.debug("当前工作名：" + pageJobName)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足配置工作名")
            return false;
        }

        // 不满足新增范围
        let pageSalaryRange = BossDOMApi.getSalaryRange(jobTag);
        let salaryRange = this.scriptConfig.getSalaryRange();
        if (!Tools.rangeMatch(salaryRange, pageSalaryRange)) {
            logger.debug("当前薪资范围：" + pageSalaryRange)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足薪资范围")
            return false;
        }


        let pageCompanyScaleRange = this.scriptConfig.getCompanyScaleRange();
        if (!Tools.rangeMatch(pageCompanyScaleRange, BossDOMApi.getCompanyScaleRange(jobTag))) {
            logger.debug("当前公司规模范围：" + pageCompanyScaleRange)
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：不满足公司规模范围")
            return false;
        }

        if (!BossDOMApi.isNotCommunication(jobTag)) {
            logger.info("当前job被过滤：【" + jobTitle + "】 原因：已经沟通过")
            return false;
        }

        return true;
    }
}


(function () {
    const list_url = "web/geek/job";
    const recommend_url = "web/geek/recommend";

    if (document.URL.includes(list_url) || document.URL.includes(recommend_url)) {
        window.addEventListener("load", () => {
            new JobListPageHandler()
        });
    }
})();