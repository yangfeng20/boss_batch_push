// ==UserScript==
// @name         Boss Batch Push
// @description  boss直聘批量简历投递
// @version      1.0.0
// @author       maple.
// @license      AGPL-3.0-or-later
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @match        https://www.zhipin.com/*
// ==/UserScript==


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
 * 投递多少页，每页默认有30个job，筛选过后不知道
 * @type {number}
 */
const pushPageCount = 100;


/**
 * 当前页，勿动！
 * @type {number}
 */
let currentPage = 0;
let pushCount = 0;

(function () {
    'use strict';

    let loadConfig;
    let saveConfig;

    /**
     * jobList页面处理逻辑
     * 添加操作按钮，注册点击事件，加载持久化配置
     */
    const jobListHandler = () => {

        // 批量投递按钮
        const batchButton = document.createElement('button');
        batchButton.innerText = '批量投递';
        batchButton.addEventListener('click', batchHandler);

        // 重置开关按钮
        const resetButton = document.createElement('button');
        resetButton.innerText = '重置开关';
        resetButton.addEventListener('click', () => {
            GM_setValue("enable", false)
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

        // 等待页面元素渲染，然后加载配置并渲染页面
        setTimeout(() => {
            // 读取配置
            initConfig()
            const container = document.querySelector('.job-list-wrapper');
            const firstJob = container.firstElementChild;
            container.insertBefore(resetButton, firstJob);
            container.insertBefore(batchButton, firstJob);
            container.insertBefore(saveButton, firstJob);
        }, 1000)
    };

    const initConfig = () => {

        // 加载持久化的配置，并加载到内存
        const config = JSON.parse(GM_getValue("config", "{}"))
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
                GM_setValue("config", JSON.stringify(config))
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
        if (!GM_getValue("enable", false)) {
            console.log("未开启脚本开关")
            return;
        }

        // 立即沟通或者继续沟通按钮
        const handler_button = document.getElementsByClassName("btn btn-startchat")[0];
        if (handler_button.innerText.includes("立即沟通")) {
            // 如果是沟通按钮则点击
            console.log("点击立即沟通")
            handler_button.click()
        }

        GM_setValue("lock", false)
        // 关闭当前table页
        console.log("关闭页面")
        setTimeout(() => {
            // 沟通限制对话框
            const limitDialog = document.querySelector(".dialog-container");
            if (limitDialog) {
                GM_setValue("limit", true)
            }
            window.close()
        }, 200)
    }

    /**
     * 批量操作按钮注册的事件
     * 用于批量打开job详情
     */
    const batchHandler = () => {
        // 每次投递加载最新的配置
        loadConfig();
        console.log("开始批量投递,当前页数：", ++currentPage)
        GM_setValue("enable", true)

        async function clickJobList(jobList, delay) {
            // 过滤只留下立即沟通的job
            jobList = filterJob(jobList);
            console.log("过滤后的job数量", jobList.length, "默认30")

            for (let i = 0; i < jobList.length; i++) {
                const job = jobList[i];
                let innerText = job.querySelector(".job-title").innerText;
                const jobTitle = innerText.replace("\n", " ");

                const lock = GM_getValue("lock", false)
                while (true) {
                    if (!lock) {
                        console.log("解锁---" + jobTitle)
                        break;
                    }
                    console.log("阻塞等待---" + jobTitle)
                    // 每500毫秒检查一次状态
                    await sleep(500);
                }

                if (GM_getValue("limit", false)) {
                    pushCount--;
                    console.log("今日沟通已达boss限制")
                    break;
                }

                // 当前table页是活跃的，也是另外一遍点击立即沟通之后，以及关闭页面
                await new Promise(resolve => setTimeout(resolve, delay));
                GM_setValue("lock", false)
                console.log("加锁---" + jobTitle)
                pushCount++;
                job.click();
            }

            if (currentPage >= pushPageCount || GM_getValue("limit", false)) {
                console.log("一共", pushPageCount, "页")
                console.log("共投递", pushCount, "份")
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

    function clear() {
        GM_setValue("lock", false)
        GM_setValue("limit", false)
        GM_setValue("enable", false)
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
        for (let i = 0; i < job_list.length; i++) {
            let job = job_list[i];
            let innerText = job.querySelector(".job-title").innerText;
            const jobTitle = innerText.replace("\n", " ");

            // 匹配符号条件的job
            if (!matchJob(job)) {
                console.log("跳过不匹配的job：", jobTitle)
                continue;
            }

            const jobStatusStr = job.querySelector(".start-chat-btn").innerText;
            if (jobStatusStr.includes("立即沟通")) {
                result.push(job);
            }
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