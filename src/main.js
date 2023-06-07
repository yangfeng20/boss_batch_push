// ==UserScript==
// @name         Boss Batch Push
// @description  boss直聘批量简历投递
// @version      1.0.0
// @author       maple.
// @license      Apache License 2.0
// @require      https://cdn.jsdelivr.net/npm/axios@1.1.2/dist/axios.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @match        https://www.zhipin.com/*
// ==/UserScript==


const docTextArr = [
    "1.批量投递：点击批量投递开始批量投简历，请先通过上方Boss的筛选功能筛选大致的范围，然后通过脚本的筛选进一步确认投递目标。",
    "2.重置开关：如果你需要自己浏览工作详情页面，请点击该按钮关闭自动投递。如果不关闭，打开工作详情页，会自动投递并关闭页面。",
    "3.保存配置：保持下方脚本筛选项，用于后续直接使用当前配置。",
    "4.过滤不活跃Boss：打开后会自动过滤掉最近未活跃的Boss发布的工作。以免浪费每天的100次机会。",
    "脚本筛选项介绍：",
    "公司名包含：投递工作的公司名一定包含在当前集合中，模糊匹配，多个使用逗号分割。这个一般不用，如果使用了也就代表只投这些公司的岗位。例子：【阿里,华为】",
    "排除公司名：投递工作的公司名一定不在当前集合中，也就是排除当前集合中的公司，模糊匹配，多个使用逗号分割。例子：【xxx外包】",
    "Job名包含：投递工作的名称一定包含在当前集合中，模糊匹配，多个使用逗号分割。例如：【软件,Java,后端,服务端,开发,后台】",
    "薪资范围：投递工作的薪资范围一定在当前区间中，一定是区间，使用-连接范围。例如：【12-20】",
    "公司规模范围：投递工作的公司人员范围一定在当前区间中，一定是区间，使用-连接范围。例如：【500-20000000】",
]


/**
 * 以下名称均为模糊匹配
 * @companyArr: 公司名
 * @companyExclude: 排除公司名
 * @jobNameArr: job名
 * @salaryRange: 薪资范围
 * @companyScale: 公司规模范围
 *
 */
let companyArr = [];
let companyExclude = [];
let jobNameArr = [];
let salaryRange = "";
let companyScale = "";


/**
 * 投递多少页，每页默认有30个job，筛选过后不确定
 * @type {number}
 */
const pushPageCount = 100;


/**
 * 当前页，勿动！
 * @type {number}
 */
let currentPage = 0;

/**
 * 本地存储key
 */
const ACTIVE_READY = "activeReady";
const ACTIVE_ENABLE = "activeEnable";
const LOCAL_CONFIG = "config";
const PUSH_COUNT = "pushCount";
const PUSH_LOCK = "lock";
const PUSH_LIMIT = "limit";
const BATCH_ENABLE = "enable";


(function () {
    'use strict';

    let loadConfig;
    let saveConfig;

    /**
     * jobList页面处理逻辑
     * 添加操作按钮，注册点击事件，加载持久化配置
     */
    const jobListHandler = () => {

        // 重置逻辑状态，可能由于执行过程的中断导致状态错乱
        resetStatus()

        // 批量投递按钮
        const batchButton = document.createElement('button');
        batchButton.innerText = '批量投递';
        batchButton.addEventListener('click', batchHandler);

        // 重置开关按钮
        const resetButton = document.createElement('button');
        resetButton.innerText = '重置开关';
        resetButton.addEventListener('click', () => {
            GM_setValue(BATCH_ENABLE, false)
            console.log("重置脚本开关成功")
            window.alert("重置脚本开关成功")
        });

        // 保存配置按钮
        const saveButton = document.createElement('button');
        saveButton.innerText = '保存配置';
        saveButton.addEventListener('click', () => {
            saveConfig();
            window.alert("保存配置成功")
        });

        // 过滤不活跃boss按钮
        const switchButton = document.createElement('button');


        const addStyle = (button) => {
            button.style.display = "inline-block";
            button.style.padding = "10px 20px";
            button.style.borderRadius = "5px";
            button.style.backgroundColor = "#409eff";
            button.style.color = "#ffffff";
            button.style.textDecoration = "none";
            button.style.margin = "10px";
        }
        addStyle(batchButton)
        addStyle(resetButton)
        addStyle(saveButton)
        addStyle(switchButton)

        let switchState = false;
        const setSwitchButtonState = (isOpen) => {
            switchState = isOpen;
            if (isOpen) {
                switchButton.innerText = '过滤不活跃Boss:已开启';
                switchButton.style.backgroundColor = '#67c23a';
                GM_setValue(ACTIVE_ENABLE, true)
            } else {
                switchButton.innerText = '过滤不活跃Boss:已关闭';
                switchButton.style.backgroundColor = '#f56c6c';
                GM_setValue(ACTIVE_ENABLE, false)
            }
        };
        setSwitchButtonState(GM_getValue(ACTIVE_ENABLE, true))

        // 添加事件监听，执行回调函数
        switchButton.addEventListener('click', () => {
            setSwitchButtonState(!switchState);
        });

        // 等待页面元素渲染，然后加载配置并渲染页面
        setTimeout(() => {
            // 读取配置
            initConfig()
            const container = document.querySelector('.job-list-wrapper');
            const firstJob = container.firstElementChild;
            container.insertBefore(addDocComponent(), firstJob);
            container.insertBefore(batchButton, firstJob);
            container.insertBefore(resetButton, firstJob);
            container.insertBefore(saveButton, firstJob);
            container.insertBefore(switchButton, firstJob);
        }, 1000)
    };

    const addDocComponent = () => {
        const docDiv = document.createElement("div");
        docDiv.style.backgroundColor = "#f2f2f2";
        docDiv.style.padding = "5px";
        docDiv.style.width = "100%";
        for (let i = 0; i < docTextArr.length; i++) {
            const textTag = document.createElement("p");
            textTag.style.color = "#666";
            textTag.innerHTML = docTextArr[i];
            docDiv.appendChild(textTag)
        }

        return docDiv;
    }

    const resetStatus = () => {
        GM_setValue(PUSH_COUNT, 0)
        GM_setValue(PUSH_LIMIT, false)
    }

    const initConfig = () => {

        // 加载持久化的配置，并加载到内存
        const config = JSON.parse(GM_getValue(LOCAL_CONFIG, "{}"))
        companyArr = companyArr.concat(config.companyArr)
        companyExclude = companyExclude.concat(config.companyExclude)
        jobNameArr = jobNameArr.concat(config.jobNameArr)
        salaryRange = config.salaryRange ? config.salaryRange : salaryRange
        companyScale = config.companyScale ? config.companyScale : companyScale

        // 将配置渲染到页面
        renderConfigText()

        /**
         * 渲染配置输入框
         * 将用户配置渲染到页面
         * 同时将钩子函数赋值！！！
         */
        function renderConfigText() {
            const bossInput = document.createElement("div");
            bossInput.id = "boss-input";

            const companyLabel1 = document.createElement("label");
            companyLabel1.textContent = "公司名包含";
            const companyArr_ = document.createElement("input");
            companyArr_.type = "text";
            companyArr_.id = "companyArr";
            companyLabel1.appendChild(companyArr_);
            bossInput.appendChild(companyLabel1);
            companyArr_.value = deWeight(companyArr).join(",")

            const companyLabel2 = document.createElement("label");
            companyLabel2.textContent = "公司名排除";
            const companyExclude_ = document.createElement("input");
            companyExclude_.type = "text";
            companyExclude_.id = "companyExclude";
            companyLabel2.appendChild(companyExclude_);
            bossInput.appendChild(companyLabel2);
            companyExclude_.value = deWeight(companyExclude).join(",")

            const jobNameLabel = document.createElement("label");
            jobNameLabel.textContent = "Job名包含";
            const jobNameArr_ = document.createElement("input");
            jobNameArr_.type = "text";
            jobNameArr_.id = "jobNameArr";
            jobNameLabel.appendChild(jobNameArr_);
            bossInput.appendChild(jobNameLabel);
            jobNameArr_.value = deWeight(jobNameArr).join(",")

            const salaryLabel = document.createElement("label");
            salaryLabel.textContent = "薪资范围";
            const salaryRange_ = document.createElement("input");
            salaryRange_.type = "text";
            salaryRange_.id = "salaryRange";
            salaryLabel.appendChild(salaryRange_);
            bossInput.appendChild(salaryLabel);
            salaryRange_.value = salaryRange

            const companyScaleLabel = document.createElement("label");
            companyScaleLabel.textContent = "公司规模范围";
            const companyScale_ = document.createElement("input");
            companyScale_.type = "text";
            companyScale_.id = "companyScale";
            companyScaleLabel.appendChild(companyScale_);
            bossInput.appendChild(companyScaleLabel);
            companyScale_.value = companyScale

            // 美化样式
            bossInput.style.margin = "20px";
            bossInput.style.padding = "20px";
            bossInput.style.border = "1px solid #ccc";
            bossInput.style.background = "#f0f0f0";
            bossInput.style.borderRadius = "10px";
            bossInput.style.width = "80%";

            const labels = bossInput.querySelectorAll("label");
            labels.forEach(label => {
                label.style.display = "inline-block";
                label.style.width = "20%";
                label.style.fontWeight = "bold";
            });

            const inputs = bossInput.querySelectorAll("input[type='text']");
            inputs.forEach(input => {
                input.style.marginLeft = "10px";
                input.style.width = "70%";
                input.style.padding = "5px";
                input.style.borderRadius = "5px";
                input.style.border = "1px solid #ccc";
                input.style.boxSizing = "border-box";
            });

            // 将创建好的元素添加到 DOM 中
            const container = document.querySelector('.job-list-wrapper');
            const firstJob = container.firstElementChild;
            container.insertBefore(bossInput, firstJob);

            /**
             * 每次批量提交前，加载页面最新的配置
             */
            loadConfig = () => {
                companyArr = companyArr_.value.split(",")
                companyExclude = companyExclude_.value.split(",")
                jobNameArr = jobNameArr_.value.split(",")
                salaryRange = salaryRange_.value
                companyScale = companyScale_.value = companyScale
            }

            /**
             * 持久化用户输入的配置
             */
            saveConfig = () => {
                const config = {
                    companyArr: companyArr_.value.split(","),
                    companyExclude: companyExclude_.value.split(","),
                    jobNameArr: jobNameArr_.value.split(","),
                    salaryRange: salaryRange_.value,
                    companyScale: companyScale_.value = companyScale,
                }
                // 持久化配置
                GM_setValue(LOCAL_CONFIG, JSON.stringify(config))
            }
        }

        function deWeight(arr) {
            let uniqueArr = [];
            for (let i = 0; i < arr.length; i++) {
                if (uniqueArr.indexOf(arr[i]) === -1) {
                    uniqueArr.push(arr[i]);
                }
            }
            return uniqueArr;
        }
    }


    /**
     * 详情页面注册load事件
     * 点击job详情的立即沟通
     */
    const jobDetailHandler = () => {
        if (!GM_getValue(BATCH_ENABLE, false)) {
            console.log("未开启脚本开关")
            return;
        }

        /**
         * 招聘boss是否活跃
         */
        const isBossActive = () => {
            const activeEle = document.querySelector(".boss-active-time")
            if (!activeEle) {
                return true;
            }

            const activeText = activeEle.innerText;
            return !(activeText.includes("月") || activeText.includes("年"));
        }

        // 关闭页面并重置对应状态
        const closeTab = (ms) => {
            console.log("关闭页面")
            setTimeout(() => {
                // 沟通限制对话框
                const limitDialog = document.querySelector(".dialog-container");
                if (limitDialog) {
                    GM_setValue(PUSH_LIMIT, true)
                }
                GM_setValue(PUSH_LOCK, false)
                window.close()
            }, ms)
        }

        // boss是否活跃，过滤不活跃boss
        if (!isBossActive()) {
            console.log("过滤不活跃boss")
            closeTab(0)
            return;
        }

        // 立即沟通或者继续沟通按钮
        const handlerButton = document.querySelector(".btn-startchat");
        if (handlerButton.innerText.includes("立即沟通")) {
            // 如果是沟通按钮则点击
            console.log("点击立即沟通")
            handlerButton.click()
            // 更新投递次数，可能存在性能问题
            GM_setValue(PUSH_COUNT, GM_getValue(PUSH_COUNT, 0) + 1)
        }

        closeTab(300)
    }

    /**
     * 批量操作按钮注册的事件
     * 用于批量打开job详情
     */
    const batchHandler = () => {
        // 每次投递加载最新的配置
        loadConfig();
        console.log("开始批量投递,当前页数：", ++currentPage)
        GM_setValue(BATCH_ENABLE, true)

        async function clickJobList(jobList, delay) {
            // 过滤只留下立即沟通的job
            jobList = filterJob(jobList);
            await activeWait()
            console.log("过滤后的job数量", jobList.length, "默认30")
            for (let i = 0; i < jobList.length; i++) {
                const job = jobList[i];
                let innerText = job.querySelector(".job-title").innerText;
                const jobTitle = innerText.replace("\n", " ");

                const lock = GM_getValue(PUSH_LOCK, false)
                while (true) {
                    if (!lock) {
                        console.log("解锁---" + jobTitle)
                        break;
                    }
                    console.log("等待---" + jobTitle)
                    // 每500毫秒检查一次状态
                    await sleep(500);
                }

                if (GM_getValue(PUSH_LIMIT, false)) {
                    console.log("今日沟通已达boss限制")
                    break;
                }

                // 当前table页是活跃的，也是另外一遍点击立即沟通之后，以及关闭页面
                await new Promise(resolve => setTimeout(resolve, delay));
                GM_setValue(PUSH_LOCK, false)
                console.log("加锁---" + jobTitle)
                job.click();
            }

            if (currentPage >= pushPageCount || GM_getValue(PUSH_LIMIT, false)) {
                console.log("一共", pushPageCount, "页")
                console.log("共投递", GM_getValue(PUSH_COUNT, 0), "份")
                console.log("投递完毕")
                clear()
                return;
            }

            console.log("下一页")
            const nextButton = document.querySelector(".ui-icon-arrow-right")
            nextButton.click()
            setTimeout(() => batchHandler(), 2000);

        }

        // 每隔2秒执行一次点击操作
        clickJobList(document.querySelectorAll('.job-card-wrapper'), 2000);
    };

    async function activeWait() {
        // 未开启活跃度检查
        if (!GM_getValue(ACTIVE_ENABLE, false)) {
            return new Promise(resolve => resolve())
        }
        return new Promise((resolve, reject) => {
            const timer = setInterval(() => {
                if (GM_getValue(ACTIVE_ENABLE, false) && GM_getValue(ACTIVE_READY, false)) {
                    clearInterval(timer);
                    resolve();
                }
                console.log("阻塞中---------", GM_getValue(ACTIVE_ENABLE, false), GM_getValue(ACTIVE_READY, false))
            }, 1000);
        });
    }

    function clear() {
        GM_setValue(PUSH_LOCK, false)
        GM_setValue(PUSH_LIMIT, false)
        GM_setValue(BATCH_ENABLE, false)
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 过滤job【去除已经沟通过的job】
     * @param job_list
     * @returns {*[]}
     */
    const filterJob = (job_list) => {
        const result = [];
        let requestCount = 0;
        for (let i = 0; i < job_list.length; i++) {
            let job = job_list[i];
            let innerText = job.querySelector(".job-title").innerText;
            const jobTitle = innerText.replace("\n", " ");

            // 匹配符合条件的Job
            if (!matchJob(job)) {
                console.log("跳过不匹配的job：", jobTitle)
                continue;
            }

            const jobStatusStr = job.querySelector(".start-chat-btn").innerText;
            if (!jobStatusStr.includes("立即沟通")) {
                continue;
            }

            // 打开boss活跃度开关时，需要检查boss活跃度
            if (!GM_getValue(ACTIVE_ENABLE, false)) {
                // 未打开boss活跃度开关
                result.push(job);
                continue
            }

            // 活跃度检查【如果是活跃才添加到result中】
            requestCount++;
            const params = job.querySelector(".job-card-left").href.split("?")[1]
            axios.get("https://www.zhipin.com/wapi/zpgeek/job/card.json?" + params).then(resp => {
                const activeText = resp.data.zpData.jobCard.activeTimeDesc
                if ((activeText.includes("月") || activeText.includes("年"))) {
                    console.log("过滤不活跃bossJob：" + jobTitle)
                    return
                }
                console.log("添加活跃job：" + activeText)
                result.push(job);
            }).catch(e => {
                console.log(e)
            }).finally(() => {
                requestCount--;
                if (requestCount === 0) {
                    GM_setValue(ACTIVE_READY, true)
                }
            })
        }
        return result;
    }


    /**
     * 匹配job
     * 返回true表示当前job匹配，命中
     *
     * @param job
     * @returns {boolean}
     */
    const matchJob = (job) => {
        // 公司名
        const companyName = job.querySelector(".company-name").innerText
        // 工作名
        const jobName = job.querySelector(".job-name").innerText
        // 新增范围
        const salary = job.querySelector(".salary").innerText
        // 公司规模范围
        const companyScale_ = job.querySelector(".company-tag-list").lastChild.innerText

        // 模糊匹配
        const companyNameCondition = fuzzyMatch(companyArr, companyName, true)
        const companyNameExclude = fuzzyMatch(companyExclude, companyName, true)
        const jobNameCondition = fuzzyMatch(jobNameArr, jobName, true)

        // 范围匹配
        const salaryRangeCondition = rangeMatch(salaryRange, salary)
        const companyScaleCondition = rangeMatch(companyScale, companyScale_)

        return companyNameCondition && !companyNameExclude && jobNameCondition && salaryRangeCondition && companyScaleCondition;

    }

    /**
     * 匹配范围
     * @param rangeStr
     * @param input
     * @returns {boolean}
     */
    function rangeMatch(rangeStr, input) {
        if (!rangeStr) {
            return true;
        }
        // 匹配定义范围的正则表达式
        let reg = /^(\d+)(?:-(\d+))?$/;
        let match = rangeStr.match(reg);

        if (match) {
            let start = parseInt(match[1]);
            let end = parseInt(match[2] || match[1]);

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
                return (inputStart >= start && inputStart <= end) || (inputEnd >= start && inputEnd <= end);
            }
        }

        // 其他情况均视为不匹配
        return false;
    }

    function fuzzyMatch(arr, input, emptyStatus) {
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


    /**
     * 主启动方法
     * 根据不同的url注册不同的事件
     */
    function main() {

        const list_url = "web/geek/job";
        const detail_url = "job_detail";

        if (document.URL.includes(list_url)) {
            window.addEventListener('load', jobListHandler);
        } else if (document.URL.includes(detail_url)) {
            window.addEventListener('load', jobDetailHandler);
        }
    }

    main();

})();