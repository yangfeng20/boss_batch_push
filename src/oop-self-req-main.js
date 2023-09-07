// ==UserScript==
// @name         Boss Batch Push [Boss直聘批量投简历]
// @description  boss直聘批量简历投递
// @namespace    maple
// @version      1.1.7
// @author       maple,Ocyss
// @license      Apache License 2.0
// @run-at       document-start
// @match        https://www.zhipin.com/*
// @connect      www.tl.beer
// @include      https://www.zhipin.com
// @require      https://unpkg.com/maple-lib@1.0.3/log.js
// @require      https://cdn.jsdelivr.net/npm/axios@1.1.2/dist/axios.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/wordcloud2.js/1.2.2/wordcloud2.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addValueChangeListener
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

    static GMXmlHttpRequest(options) {
        return GM_xmlhttpRequest(options)
    }

    static GmAddValueChangeListener(key, func) {
        return GM_addValueChangeListener(key, func);
    }

}

class Tools {


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

        // 词云图canvas
        this.worldCloudCanvas = null


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

        this.worldCloudCanvas = DOMApi.createTag("canvas", "", "height: 300px;")
        this.worldCloudCanvas.id = "worldCloudCanvas"

        logger.debug("操作面板开始初始化")
        // 1.创建操作按钮并添加到按钮容器中【以下绑定事件处理函数均采用箭头函数作为中转，避免this执行事件对象】
        let btnCssText = "display: inline-block; border-radius: 5px; background-color: rgb(64, 158, 255); color: rgb(255, 255, 255); text-decoration: none; padding: 10px;cursor: pointer";

        // 批量投递按钮
        let batchPushBtn = DOMApi.createTag("button", "批量投递", btnCssText);
        this.batchPushBtn = batchPushBtn
        DOMApi.eventListener(batchPushBtn, "click", () => {
            this.batchPushBtnHandler()
        })

        // 保存配置按钮
        let storeConfigBtn = DOMApi.createTag("button", "保存配置", btnCssText);
        DOMApi.eventListener(storeConfigBtn, "click", () => {
            this.storeConfigBtnHandler()
        })

        // 生成Job词云图按钮
        let generateImgBtn = DOMApi.createTag("button", "生成Job词云图", btnCssText);
        DOMApi.eventListener(generateImgBtn, "click", () => {
            this.generateImgHandler()
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
        btnContainerDiv.appendChild(generateImgBtn);
        btnContainerDiv.appendChild(storeConfigBtn);
        btnContainerDiv.appendChild(activeSwitchBtn);

        // 2.创建筛选条件输入框并添加到input容器中
        this.cnInInputLab = DOMApi.createInputTag("公司名包含", this.scriptConfig.getCompanyNameInclude());
        this.cnExInputLab = DOMApi.createInputTag("公司名排除", this.scriptConfig.getCompanyNameExclude());
        this.jnInInputLab = DOMApi.createInputTag("工作名包含", this.scriptConfig.getJobNameInclude());
        this.jcExInputLab = DOMApi.createInputTag("工作内容排除", this.scriptConfig.getJobContentExclude());
        this.srInInputLab = DOMApi.createInputTag("薪资范围", this.scriptConfig.getSalaryRange());
        this.csrInInputLab = DOMApi.createInputTag("公司规模范围", this.scriptConfig.getCompanyScaleRange());

        let inputContainerDiv = DOMApi.createTag("div", "", "margin:50px;");
        inputContainerDiv.appendChild(this.cnInInputLab)
        inputContainerDiv.appendChild(this.cnExInputLab)
        inputContainerDiv.appendChild(this.jnInInputLab)
        inputContainerDiv.appendChild(this.jcExInputLab)
        inputContainerDiv.appendChild(this.srInInputLab)
        inputContainerDiv.appendChild(this.csrInInputLab)

        // 进度显示
        this.showTable = this.buildShowTable();

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
        operationPanel.appendChild(this.showTable)
        operationPanel.appendChild(this.worldCloudCanvas)

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

    refreshShow(text) {
        this.showTable.innerHTML = "当前操作：" + text
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


    buildShowTable() {
        return DOMApi.createTag('p', '', 'font-size: 20px;color: rgb(64, 158, 255);margin-left: 50px;');
    }


    /*-------------------------------------------------操作面板事件处理--------------------------------------------------*/


    batchPushBtnHandler() {
        this.jobListHandler.batchPushHandler()

    }

    generateImgHandler() {
        let jobList = BossDOMApi.getJobList();
        let allJobContent = ""
        Array.from(jobList).reduce((promiseChain, jobTag) => {
            return promiseChain
                .then(() => this.jobListHandler.reqJobDetail(jobTag))
                .then(jobCardJson => {
                    allJobContent += jobCardJson.postDescription + ""
                })
        }, Promise.resolve())
            .then(() => {
                return JobWordCloud.participle(allJobContent)
            }).then(worldArr => {
            let weightWordArr = JobWordCloud.buildWord(worldArr);
            logger.info("根据权重排序的world结果：", JobWordCloud.getKeyWorldArr(weightWordArr));
            debugger
            JobWordCloud.generateWorldCloudImage("worldCloudCanvas", weightWordArr)
        })
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
    static ACTIVE_ENABLE = "activeEnable";
    static PUSH_LIMIT = "push_limit" + ScriptConfig.getCurDay();
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
        this.scriptConfig.setVal(ScriptConfig.PUSH_LIMIT, false)
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
                this.operationPanel.refreshShow("投递停止")
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
                            this.operationPanel.refreshShow(jobTitle + " 不满足投递条件")
                            ++notMatchCount;
                            break;

                        case error instanceof FetchJobDetailFailExp:
                            logger.error("job详情页数据获取失败：" + error);
                            break;

                        case error instanceof SendPublishExp:
                            logger.error("投递失败;" + jobTitle + " 原因：" + error.message);
                            this.operationPanel.refreshShow(jobTitle + " 投递失败")
                            publishResultCount.failCount++
                            break;

                        case error instanceof PublishLimitExp:
                            TampermonkeyApi.GmSetValue(ScriptConfig.PUSH_LIMIT, true);
                            this.operationPanel.refreshShow("停止投递 " + error.message)
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

                this.operationPanel.refreshShow("正在投递-->" + jobTitle)
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


class JobWordCloud {

    // 不应该使用分词，而应该是分句，结合上下文，自然语言处理
    static filterableWorldArr = ['', ' ', ',', '?', '+', '\n', '\r', "/", '有', '的', '等', '及', '了', '和', '公司', '熟悉', '服务', '并', '同', '如', '于', '或', '到',
        '开发', '技术', '我们', '提供', '武汉', '经验', '为', '在', '团队', '员工', '工作', '能力', '-', '1', '2', '3', '4', '5', '6', '7', '8', '', '年', '与', '平台', '研发', '行业',
        "实现", "负责", "代码", "精通", "图谱", "需求", "分析", "良好", "知识", "相关", "编码", "参与", "产品", "扎实", "具备", "较", "强", "沟通", "者", "优先", "具有", "精神", "编写", "功能", "完成", "详细", "岗位职责",
        "包括", "解决", "应用", "性能", "调", "优", "本科", "以上学历", "基础", "责任心", "高", "构建", "合作", "能", "学习", "以上", "熟练", "问题", "优质", "运行", "工具", "方案", "根据", "业务", "类", "文档", "分配",
        "其他", "亿", "级", "关系", "算法", "系统", "上线", "考虑", "工程师", "华为", "自动", "驾驶", "网络", "后", "端", "云", "高质量", "承担", "重点", "难点", "攻坚", "主导", "选型", "任务", "分解", "工作量", "评估",
        "创造性", "过程", "中", "提升", "核心", "竞争力", "可靠性", "要求", "计算机专业", "基本功", "ee", "主流", "微", "框架", "其", "原理", "推进", "优秀", "团队精神", "热爱", "可用", "大型", "网站", "表达", "理解能力",
        "同事", "分享", "愿意", "接受", "挑战", "拥有", "将", "压力", "转变", "动力", "乐观", "心态", "思路清晰", "严谨", "地", "习惯", "运用", "线", "上", "独立", "处理", "熟练掌握", "至少", "一种", "常见", "脚本", "环境",
        "搭建", "开发工具", "人员", "讨论", "制定", "用", "相应", "保证", "质量", "说明", "领导", "包含", "节点", "存储", "检索", "api", "基于", "数据", "落地", "个性化", "场景", "支撑", "概要", "按照", "规范", "所", "模块",
        "评审", "编译", "调试", "单元测试", "发布", "集成", "支持", "功能测试", "测试", "结果", "优化", "持续", "改进", "配合", "交付", "出现", "任职", "资格", "编程", "型", "使用", "认真负责", "高度", "责任感", "快速", "创新", "金融",

        "设计", "项目", "对", "常用", "掌握", "专业", "进行", "了解", "岗位", "能够", "中间件", "以及", "开源", "理解", ")", "软件", "计算机", "架构", "一定", "缓存", "可", "解决问题", "计算机相关", "发展", "时间", "奖金", "培训", "部署",
        "互联网", "享受", "善于", "需要", "游戏", " ", "维护", "统招", "语言", "消息", "机制", "逻辑思维", "一", "意识", "新", "攻关", "升级", "管理", "重构", "【", "职位", "】", "成员", "好", "接口", "语句", "后台", "通用", "不", "描述",
        "福利", "险", "机会", "会", "人", "完善", "技术难题", "技能", "应用服务器", "配置", "协助", "或者", "组织", "现有", "迭代", "流程", "项目管理", "从", "深入", "复杂", "专业本科", "协议", "不断", "项目经理", "协作", "五", "金", "待遇",
        "年终奖", "各类", "节日", "带薪", "你", "智慧", "前沿技术", "常用命令", "方案设计", "基本", "积极", "产品开发", "用户", "确保", "带领", "软件系统", "撰写", "软件工程", "职责", "抗压", "积极主动", "双休", "法定", "节假日", "假", "客户",
        "日常", "协同", "是", "修改", "要", "软件开发", "丰富", "乐于", "识别", "风险", "合理", "服务器", "指导", "规划", "提高", "稳定性", "扩展性", "功底", "钻研", "c", "高可用性", "计算机软件", "高效", "前端", "内部", "一起", "程序", "程序开发",
        "计划", "按时", "数理", "及其", "集合", "正式", "劳动合同", "薪资", "丰厚", "奖励", "补贴", "免费", "体检", "每年", "调薪", "活动", "职业", "素养", "晋升", "港", "氛围", "您", "存在", "关注", "停车", "参加", "系统分析", "发现", "稳定", "自主",
        "实际", "开发技术", "(", "一些", "综合", "条件", "学历", "薪酬", "维", "保", "全日制", "专科", "体系结构", "协调", "出差", "自测", "周一", "至", "周五", "周末", "公积金", "准备", "内容", "部门", "满足", "兴趣", "方式", "操作", "超过", "结合",
        "同时", "对接", "及时", "研究", "统一", "管控", "福利待遇", "政策", "办理", "凡是", "均", "丧假", "对于", "核心技术", "安全", "服务端", "游", "电商", "零售", "下", "扩展", "负载", "信息化", "命令", "供应链", "商业", "抽象", "模型", "领域", "瓶颈",
        "充分", "编程语言", "自我", "但", "限于", "应用软件", "适合", "各种", "大", "前后", "复用", "执行", "流行", "app", "小", "二", "多种", "转正", "空间", "盒", "马", "长期", "成长", "间", "通讯", "全过程", "提交", "目标", "电气工程", "阅读", "严密",
        "电力系统", "电力", "大小", "周", "心动", "入", "职", "即", "缴纳", "签署", "绩效奖金", "评优", "专利", "论文", "职称", "加班", "带薪休假", "专项", "健康", "每周", "运动", "休闲", "不定期", "小型", "团建", "旅游", "岗前", "牛", "带队", "答疑", "解惑",
        "晋级", "晋升为", "管理层", "跨部门", "转岗", "地点", "武汉市", "东湖新技术开发区", "一路", "光谷", "园", "栋", "地铁", "号", "北站", "坐", "拥", "独栋", "办公楼", "环境优美", "办公", "和谐", "交通", "便利", "地铁站", "有轨电车", "公交站", "交通工具",
        "齐全", "凯", "默", "电气", "期待", "加入", "积极参与", "依据", "工程", "跟进", "推动", "风险意识", "owner", "保持", "积极性", "自", "研", "内", "岗", "体验", "系统维护", "可能", "在线", "沟通交流", "简洁", "清晰", "录取", "优异者", "适当", "放宽", "上浮",
        "必要", "后期", "软件技术", "形成", "技术成果", "调研", "分析师", "专", "含", "信息管理", "跨专业", "从业人员", "注", "安排", "交代", "书写", "做事", "细心", "好学", "可以", "公休", "年终奖金", "定期", "正规", "养老", "医疗", "生育", "工伤", "失业", "关怀",
        "传统", "佳节", "之际", "礼包", "团结友爱", "伙伴", "丰富多彩", "两年", "过", "连接池", "划分", "检查", "部分", "甚至", "拆解", "硕士", "年龄", "周岁", "以下", "深厚", "语法", "浓厚", "优良", "治理", "a", "力", "高级", "能看懂", "有效", "共同", "想法", "提出",
        "意见", "前", "最", "重要", "企业", "极好", "驻场", "并且", "表单", "交互方式", "样式", "前端开发", "遵循", "开发进度", "实战经验", "其中", "强烈", "三维", "多个", "net", "对应", "数学", "理工科", "背景", "软件设计", "模式", "方法", "动手", "按", "质", "软件产品",
        "严格执行", "传", "帮", "带", "任务分配", "进度", "阶段", "介入", "本科学历", "五年", "尤佳", "比较", "细致", "态度", "享", "国家", "上班时间", "基本工资", "有关", "社会保险", "公司员工", "连续", "达到", "年限", "婚假", "产假", "护理", "发展潜力", "职员", "外出",
        "做好", "效率", "沉淀", "网络服务", "数据分析", "查询", "规范化", "标准化", "思考", "手", "款", "成功", "卡", "牌", "slg", "更佳", "可用性", "新人", "预研", "突破", "lambda", "理念", "它", "rest", "一个", "趋势", "思路", "影响", "医疗系统", "具体", "架构师",
        "保证系统", "大专", "三年", "体系", "写", "医院", "遇到", "验证", "运", "保障", "基本操作", "独立思考", "技术手段", "熟知", "懂", "应用环境", "表达能力", "个人", "新能源", "汽车", "权限", "排班", "绩效", "考勤", "知识库", "全局", "搜索", "门店", "渠道", "选址",
        "所有", "长远", "眼光", "局限于", "逻辑", "侧", "更好", "解决方案", "针对", "建模", "定位系统", "高质", "把", "控", "攻克", "t", "必须", "组件", "基本原理", "上进心", "驱动", "适应能力", "自信", "追求", "卓越", "感兴趣", "站", "角度", "思考问题", "tob", "商业化",
        "售后", "毕业", "通信", "数种", "优选", "it", "课堂", "所学", "在校", "期间", "校内外", "大赛", "参", "社区", "招聘", "类库", "优等", "b", "s", "方面", "海量", "数据系统", "测试工具", "曾", "主要", "爱好", "欢迎", "洁癖", "人士", "银行", "财务", "城市", "类产品", "实施",
        "保障系统", "健壮性", "可读性", "rpd", "原型", "联调", "准确无误", "系统优化", "技术标准", "总体设计", "文件", "整理", "功能设计", "技术类", "写作能力", "尤其", "套件", "公安", "细分", "增加", "bug", "电子", "swing", "桌面", "认证", "台", "检测", "安全隐患", "及时发现",
        "修补", "上级领导", "交办", "其它", "面向对象分析", "思想", "乐于助人", "全", "栈", "共享", "经济", "信", "主管", "下达", "执行力", "技巧", "试用期", "个", "月", "适应", "快", "随时", "表现", "\u003d", "到手", "工资", "享有", "提成", "超额", "业绩", "封顶", "足够", "发展前景",
        "发挥", "处", "高速", "发展期", "敢", "就", "元旦", "春节", "清明", "端午", "五一", "中秋", "国庆", "婚", "病假", "商品", "导购", "增长", "互动", "营销", "面对", "不断创新", "规模化", "上下游", "各", "域", "最终", "完整", "梳理", "链路", "关键", "点", "给出", "策略", "从业", "且",
        "可维护性", "不仅", "短期", "更", "方向", "不错", "交互", "主动", "应急", "组长", "tl", "加", "分", "一群", "怎样", "很", "热情", "喜欢", "敬畏", "心", "坚持", "主义", "持之以恒", "自己", "收获", "重视", "每", "一位", "主观", "能动性", "同学", "给予", "为此", "求贤若渴", "干货", "满满",
        "战斗", "大胆", "互相", "信任", "互相帮助", "生活", "里", "嗨", "皮", "徒步", "桌", "轰", "趴", "聚餐", "应有尽有"
    ]

    static numberRegex = /^[0-9]+$/

    static splitChar = " "

    static participleUrl = "https://www.tl.beer/api/v1/fenci"

    static participle(text) {
        return new Promise((resolve, reject) => {

            TampermonkeyApi.GMXmlHttpRequest({
                method: 'POST',
                timeout: 5000,
                url: JobWordCloud.participleUrl,

                data: "cont=" + encodeURIComponent(text) + "&cixin=false&model=false",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                },
                onload: function (response) {
                    if (response.status !== 200) {
                        logger.error("分词状态码不是200", response.responseText)
                        return reject(response.responseText)
                    }
                    return resolve(JSON.parse(response.responseText).data.split(JobWordCloud.splitChar))
                },
                onerror: function (error) {
                    logger.error("分词出错", error)
                    reject(error)
                }
            });
        })
    }

    static buildWord(wordArr) {
        // {"word1":1, "word2":4}
        let weightMap = {};
        for (let i = 0; i < wordArr.length; i++) {
            let str = wordArr[i];
            if (JobWordCloud.filterableWorldArr.includes(str)) {
                continue;
            }
            if (JobWordCloud.numberRegex.test(str)) {
                continue;
            }
            if (str in weightMap) {
                weightMap[str] = weightMap[str] + 1;
                continue
            }
            weightMap[str] = 1;
        }

        // 将对象转换为二维数组并排序： [['word1', 2], ['word2', 4]]
        let weightWordArr = JobWordCloud.sortByValue(Object.entries(weightMap));
        return JobWordCloud.cutData(weightWordArr)
    }

    static cutData(weightWordArr) {
        return weightWordArr
    }

    static generateWorldCloudImage(canvasTagId, weightWordArr) {
        // 词云图的配置选项
        let options = {
            list: weightWordArr,
            // 网格尺寸
            gridSize: 10,
            // 权重系数
            weightFactor: 2,
            // 字体
            fontFamily: 'Finger Paint, cursive, sans-serif',
            // 字体颜色，也可以指定特定颜色值
            color: '#26ad7e',
            // 旋转比例
            rotateRatio: 0.2,
            // 背景颜色
            backgroundColor: 'white',
            // 形状
            shape: 'square',
            // 随机排列词语
            shuffle: true,
            // 不绘制超出容器边界的词语
            drawOutOfBound: false
        };

        WordCloud(document.getElementById(canvasTagId), options);
    }

    static getKeyWorldArr(twoArr) {
        let worldArr = []
        for (let i = 0; i < twoArr.length; i++) {
            let world = twoArr[i][0];
            worldArr.push(world)
        }
        return worldArr;
    }

    static sortByValue(arr, order = 'desc') {
        if (order === 'asc') {
            return arr.sort((a, b) => a[1] - b[1]);
        } else if (order === 'desc') {
            return arr.sort((a, b) => b[1] - a[1]);
        } else {
            throw new Error('Invalid sort key. Use "asc" or "desc".');
        }
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