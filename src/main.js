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
 * @salaryRange:薪资范围
 * @companyScale: 公司规模范围
 *
 */
const companyArr = [];
const companyExclude = ["华为", "盒马"];
const jobNameArr = ["软件", "Java", "后端", "服务端", "开发", "后台"];
const salaryRange = "12-15";
const companyScale = "20-10000000";


/**
 * 投递多少页，每页默认有30个job，筛选过后不知道
 * @type {number}
 */
const pushPageCount = 2;


/**
 * 当前页，勿动！
 * @type {number}
 */
let currentPage = 0;
let pushCount = 0;

(function () {
    'use strict';

    /**
     * list页面添加批量操作按钮
     * 已经重置脚本开关按钮
     */
    const addButton = () => {
        const batchButton = document.createElement('button');
        batchButton.innerText = '批量投递';
        batchButton.addEventListener('click', batchHandler);

        const resetButton = document.createElement('button');
        resetButton.innerText = '重置开关';
        resetButton.addEventListener('click', () => {
            GM_setValue("enable", false)
            console.log("重置脚本开关成功")
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


        setTimeout(() => {
            const container = document.querySelector('.job-list-wrapper');
            const firstJob = container.firstElementChild;
            container.insertBefore(resetButton, firstJob);
            container.insertBefore(batchButton, firstJob);
        }, 1000)
    };


    /**
     * 详情页面注册load事件
     * 点击job详情的立即沟通
     */
    const job_detail_handler = () => {
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
        setTimeout(() => window.close(), 200)
    }

    /**
     * 批量操作按钮注册的事件
     * 用于批量打开job详情
     */
    const batchHandler = () => {
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

                // 当前table页是活跃的，也是另外一遍点击立即沟通之后，以及关闭页面
                await new Promise(resolve => setTimeout(resolve, delay));
                GM_setValue("lock", false)
                console.log("加锁---" + jobTitle)
                pushCount++;
                job.click();
            }

            if (currentPage >= pushPageCount) {
                console.log("一共", pushPageCount, "页")
                console.log("共投递", pushCount, "份")
                console.log("投递完毕")
                return;
            }

            console.log("下一页")
            const nextButton = document.querySelector(".ui-icon-arrow-right")
            nextButton.click()
            setTimeout(() => batchHandler(), 2000);

        }

        // 每隔1秒执行一次点击操作
        clickJobList(document.querySelectorAll('.job-card-wrapper'), 2000);
    };


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
        // 遍历数组中的每个元素
        for (let i = 0; i < arr.length; i++) {
            // 如果当前元素包含指定值，则返回 true
            let arrEleStr = arr[i].toLowerCase();
            if (arrEleStr.includes(input) || input.includes(arrEleStr)) {
                return true;
            }
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
            window.addEventListener('load', addButton);
        } else if (document.URL.includes(detail_url)) {
            window.addEventListener('load', job_detail_handler);
        }
    }

    main();


})();