// ==UserScript==
// @name         Boss Batch Push [Boss直聘批量投简历]
// @description  boss直聘批量简历投递
// @namespace    maple,Ocyss
// @version      1.1.4
// @author       maple,Ocyss
// @license      Apache License 2.0
// @run-at       document-start
// @match        https://www.zhipin.com/*
// @require      https://cdn.jsdelivr.net/npm/axios@1.1.2/dist/axios.min.js
// @require      https://scriptcat.org/lib/637/1.3.1/ajaxHooker.js
// @include      https://www.zhipin.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_cookie
// @grant        GM_registerMenuCommand
// ==/UserScript==

const docTextArr = [
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
const aboutLink = [
  [
    [
      "GreasyFork",
      "https://greasyfork.org/zh-CN/scripts/468125-boss-batch-push-boss%E7%9B%B4%E8%81%98%E6%89%B9%E9%87%8F%E6%8A%95%E7%AE%80%E5%8E%86",
    ],
    ["GitHub", "https://github.com/yangfeng20/boss_batch_push"],
    ["Gitee", "https://gitee.com/yangfeng20/boss_batch_push"],
  ],
  [
    ["作者：yangfeng20", "https://github.com/yangfeng20"],
    ["二改：Ocyss_04", "https://github.com/Ocyss"],
  ],
];
let companyArr = []; //公司名
let companyExclude = []; //排除公司名
let descriptionExclude = []; //排除工作内容
let jobNameArr = []; //job名
let salaryRange = ""; //薪资范围
let companyScale = ""; //公司规模范围

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
let currentUrl = "";
let iframeEl, toolEl;
let loadConfig, saveConfig;
let runT = false;
let curId;
const pageRe = /(?<=page=)\d*/;
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
const RUN_DATE = "rundate"; // 上一次运行时间,不一样就清空COUNT
const ID_CUR = "cueId"; // 当前id,兼任考虑，第一个是"",第二个是"_"
const ID_LIST = "idList"; // id列表

function GmSetValue(key, val) {
  return GM_setValue(curId + key, val);
}
function GmGetValue(key, val) {
  return GM_getValue(curId + key) || val;
}
function GmAddValueChangeListener(key, func) {
  return GM_addValueChangeListener(curId + key, func);
}

const upPage = () => {
  currentUrl = window.location.href;
  currentPage = pageRe.exec(currentUrl);
  currentPage = currentPage === null ? 1 : parseInt(currentPage[0]);
};

// 开始批量投递
const batchHandler = (el) => {
  if (!runT) {
    runT = true;
    el.style.backgroundColor = "#67c23a";
    el.innerText = "停止投递";
    const runbatch = () => {
      if (!runT) {
        return;
      }
      // 每次投递加载最新的配置
      loadConfig();
      console.log("开始批量投递,当前页数：", currentPage);
      GmSetValue(BATCH_ENABLE, true);

      async function clickJobList(jobList, delay) {
        //upPage()
        // 过滤只留下立即沟通的job
        jobList = filterJob(jobList);
        await activeWait();
        console.log("过滤后的job数量", jobList.length, "默认30");

        for (let i = 0; i < jobList.length && runT; i++) {
          const job = jobList[i];
          let innerText = job.querySelector(".job-title").innerText;
          const jobTitle = innerText.replace("\n", " ");
          let count = 0;
          while (true) {
            if (!GmGetValue(PUSH_LOCK, false)) {
              console.log("解锁---" + jobTitle);
              break;
            }
            if (count >= 30) {
              console.log("异常(超时)---" + jobTitle);
              break;
            }
            console.log("等待---" + jobTitle);
            count++;
            // 每300毫秒检查一次状态
            await sleep(300);
          }

          if (GmGetValue(PUSH_LIMIT, false)) {
            console.log("今日沟通已达boss限制");
            window.alert(
              "今天已经不能在沟通了，愿你早日找到心满意足的工作，不要灰心，我一直与你同在~"
            );
            break;
          }

          // 当前table页是活跃的，也是另外一遍点击立即沟通之后，以及关闭页面
          await new Promise((resolve) => setTimeout(resolve, delay)); // 等待 delay 秒
          GmSetValue(PUSH_LOCK, true);
          console.log("加锁---" + jobTitle);
          // job.click();
          iframeEl.src = job.querySelector(".job-card-left").href;
        }

        if (
          !runT ||
          currentPage >= pushPageCount ||
          GmGetValue(PUSH_LIMIT, false)
        ) {
          console.log("一共", pushPageCount, "页");
          console.log("共投递", GmGetValue(PUSH_COUNT, 0), "份");
          console.log("投递完毕");
          clear();
          return;
        }

        const nextButtonRight = document.querySelector(".ui-icon-arrow-right");
        const nextButtonLeft = document.querySelector(".ui-icon-arrow-left");
        // 没有下一页
        //if (nextButton.parentElement.className === "disabled") {
        //  let temp =
        //    "共投递" +
        //    GmGetValue(PUSH_COUNT, 0) +
        //    "份，没有更多符合条件的工作";
        //  window.alert(temp);
        //  console.log(temp);
        //  batchHandler(el);
        //  clear();
        //  return;
        //}
        //nextPage()
        currentPage++;
        console.log("下一页,开始等待8秒钟");

        if (nextButtonRight.parentElement.className === "disabled") {
          nextButtonLeft.click();
        } else {
          nextButtonRight.click();
        }
        setTimeout(() => runbatch(), 8000);
      }

      // 每隔5秒执行一次点击操作
      clickJobList(document.querySelectorAll(".job-card-wrapper"), 5000);
    };
    runbatch();
  } else {
    runT = false;
    el.style.backgroundColor = "#409eff";
    el.innerText = "批量投递";
    GmSetValue(BATCH_ENABLE, true);
  }
};

// Job列表事件处理
const jobListHandler = () => {
  // 重置逻辑状态，可能由于执行过程的中断导致状态错乱
  resetStatus();

  // 批量投递按钮
  const batchButton = document.createElement("button");
  batchButton.innerText = "批量投递";
  batchButton.addEventListener("click", () => {
    batchHandler(batchButton);
  });

  // 重置开关按钮
  const resetButton = document.createElement("button");
  resetButton.innerText = "重置开关";
  resetButton.addEventListener("click", () => {
    GmSetValue(BATCH_ENABLE, false);
    console.log("重置脚本开关成功");
    window.alert("重置脚本开关成功");
  });

  // 保存配置按钮
  const saveButton = document.createElement("button");
  saveButton.innerText = "保存配置";
  saveButton.addEventListener("click", () => {
    saveConfig();
    window.alert("保存配置成功");
  });

  // 过滤不活跃boss按钮
  const switchButton = document.createElement("button");

  const addStyle = (button) => {
    button.style.cssText =
      "display: inline-block; border-radius: 5px; background-color: rgb(64, 158, 255); color: rgb(255, 255, 255); text-decoration: none; padding: 10px;cursor: pointer";
  };
  addStyle(batchButton);
  addStyle(resetButton);
  addStyle(saveButton);
  addStyle(switchButton);

  let switchState = false;
  const setSwitchButtonState = (isOpen) => {
    switchState = isOpen;
    if (isOpen) {
      switchButton.innerText = "过滤不活跃Boss:已开启";
      switchButton.style.backgroundColor = "#67c23a";
      GmSetValue(ACTIVE_ENABLE, true);
    } else {
      switchButton.innerText = "过滤不活跃Boss:已关闭";
      switchButton.style.backgroundColor = "#f56c6c";
      GmSetValue(ACTIVE_ENABLE, false);
    }
  };
  setSwitchButtonState(GmGetValue(ACTIVE_ENABLE, true));
  iframeEl = document.createElement("iframe");
  // 添加事件监听，执行回调函数
  switchButton.addEventListener("click", () => {
    setSwitchButtonState(!switchState);
  });

  const ButtonEl = document.createElement("div");
  ButtonEl.style.display = "flex";
  ButtonEl.style.justifyContent = "space-evenly";
  ButtonEl.appendChild(batchButton);
  ButtonEl.appendChild(resetButton);
  ButtonEl.appendChild(saveButton);
  ButtonEl.appendChild(switchButton);
  // 等待页面元素渲染，然后加载配置并渲染页面
  const tempT = setInterval(() => {
    const container = document.querySelector(".job-list-wrapper");
    if (container == undefined) {
      return;
    }
    toolEl = document.createElement("div");
    toolEl.id = "boos-tool";
    toolEl.style.cssText =
      "padding: 10px;display: flex;flex-direction: column;min-height: 50vh;justify-content: space-between;";
    toolEl.appendChild(docEl());
    toolEl.appendChild(ButtonEl);
    toolEl.appendChild(iframeEl);
    toolEl.appendChild(configEl());
    container.insertBefore(toolEl, container.firstElementChild);
    // console.log(docTextArr.join("\n"));
    clearInterval(tempT);
  }, 1000);
};

// 详情页面处理
function jobDetailHandler() {
  if (!GmGetValue(BATCH_ENABLE, false)) {
    console.log("未开启脚本开关");
    return;
  }

  /**
   * 招聘boss是否活跃
   */
  const isBossActive = () => {
    const activeEle = document.querySelector(".boss-active-time");
    if (!activeEle) {
      return true;
    }
    const activeText = activeEle.innerText;
    return !(activeText.includes("月") || activeText.includes("年"));
  };

  // 关闭页面并重置对应状态
  const closeTab = (ms) => {
    // console.log("关闭页面");
    setTimeout(() => {
      // 沟通限制对话框
      const limitDialog = document.querySelector(
        ".greet-pop .dialog-container"
      );
      if (limitDialog) {
        if (limitDialog.innerText.includes("人数已达上限")) {
          GmSetValue(PUSH_LIMIT, true);
        } else if (limitDialog.innerText.includes("已向BOSS发送消息")) {
          // 更新投递次数，可能存在性能问题
          GmSetValue(PUSH_COUNT, GmGetValue(PUSH_COUNT, 0) + 1);
        }
      }
      GmSetValue(PUSH_LOCK, false);
      // window.close();
    }, ms);
  };

  // boss是否活跃，过滤不活跃boss
  if (!isBossActive()) {
    console.log("过滤不活跃boss");
    //closeTab(0);
    GmSetValue(PUSH_LOCK, false);
    return;
  }

  // 立即沟通或者继续沟通按钮
  const handlerButton = document.querySelector(".btn-startchat");
  if (handlerButton.innerText.includes("立即沟通")) {
    // 如果是沟通按钮则点击
    // console.log("点击立即沟通");
    handlerButton.click();
  }

  closeTab(1000);
}

// 岗位匹配过滤
function filterJob(job_list) {
  const result = [];
  let requestCount = 0;
  // 过滤器
  const matchJob = (job) => {
    // 公司名
    const companyName = job.querySelector(".company-name").innerText;
    // 工作名
    const jobName = job.querySelector(".job-name").innerText;
    // 薪资范围
    const salary = job.querySelector(".salary").innerText;
    // 公司规模范围
    const companyScale_ =
      job.querySelector(".company-tag-list").lastChild.innerText;

    // 模糊匹配
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
    // 范围匹配
    function rangeMatch(rangeStr, input, by = 1) {
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

    const companyNameCondition = fuzzyMatch(companyArr, companyName, true);
    const companyNameExclude = fuzzyMatch(companyExclude, companyName, false);
    const jobNameCondition = fuzzyMatch(jobNameArr, jobName, true);
    const salaryRangeCondition =
      rangeMatch(salaryRange, salary) || rangeMatch(salaryRange, salary, 38); //单休日薪，有小误差
    const companyScaleCondition = rangeMatch(companyScale, companyScale_);

    return (
      companyNameCondition &&
      !companyNameExclude &&
      jobNameCondition &&
      salaryRangeCondition &&
      companyScaleCondition
    );
  };

  for (let i = 0; i < job_list.length; i++) {
    let job = job_list[i];
    let innerText = job.querySelector(".job-title").innerText;
    const jobTitle = innerText.replace("\n", " ");

    // 匹配符合条件的Job
    if (!matchJob(job)) {
      console.log("%c 跳过不匹配的job：" + jobTitle, "color:#e88080;");
      continue;
    }

    const jobStatusStr = job.querySelector(".start-chat-btn").innerText;
    if (!jobStatusStr.includes("立即沟通")) {
      console.log("%c 跳过沟通过的Job：" + jobTitle, "color:#FF9733;");
      continue;
    }

    // 当没开启活跃度检查和工作内容筛选不进行网络请求
    if (!GmGetValue(ACTIVE_ENABLE, false) && descriptionExclude.length == 0) {
      // 未打开boss活跃度开关
      result.push(job);
      continue;
    }

    // 活跃度检查【如果是活跃才添加到result中】
    requestCount++;
    const params = job.querySelector(".job-card-left").href.split("?")[1];
    axios
      .get("https://www.zhipin.com/wapi/zpgeek/job/card.json?" + params, {
        timeout: 5000,
      })
      .then((resp) => {
        const activeText = resp.data.zpData.jobCard.activeTimeDesc;
        if (
          GmGetValue(ACTIVE_ENABLE, false) &&
          (activeText.includes("月") || activeText.includes("年"))
        ) {
          console.log("%c 过滤不活跃的Job：" + jobTitle, "color:#F8FD5A;");
          return;
        }
        const content = resp.data.zpData.jobCard.postDescription;
        for (let i = 0; i < descriptionExclude.length; i++) {
          if (!descriptionExclude[i]) {
            continue;
          }
          let re = new RegExp(
            "(?<!(不|无).{0,5})" +
              descriptionExclude[i] +
              "(?!系统|软件|工具|服务)"
          );
          if (re.test(content)) {
            console.log(
              "%c 过滤不符合的工作内容-" +
                descriptionExclude[i] +
                "：" +
                jobTitle,
              "color:#f2c97d;"
            );
            return;
          }
        }
        console.log("%c 添加符合bossJob：" + jobTitle, "color:#63e2b7;");
        result.push(job);
      })
      .catch((e) => {
        console.log("网络筛选失败,原因:");
        console.log(e);
      })
      .finally(() => {
        requestCount--;
        if (requestCount === 0) {
          GmSetValue(ACTIVE_READY, true);
        }
      });
  }
  return result;
}

// 活跃度检查
async function activeWait() {
  // 未开启活跃度检查
  if (!GmGetValue(ACTIVE_ENABLE, false)) {
    return new Promise((resolve) => resolve());
  }
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (GmGetValue(ACTIVE_ENABLE, false) && GmGetValue(ACTIVE_READY, false)) {
        clearInterval(timer);
        resolve();
      }
      console.log(
        "等待检查Job活跃度阻塞中---------",
        GmGetValue(ACTIVE_ENABLE, false),
        GmGetValue(ACTIVE_READY, false)
      );
    }, 1000);
  });
}

// 重置
function resetStatus() {
  const d = new Date();
  if (GmGetValue(RUN_DATE, -1) != d.toDateString()) {
    window.caches;
    GmSetValue(PUSH_COUNT, 0);
    GmSetValue(PUSH_LIMIT, false);
    GmSetValue(RUN_DATE, d.toDateString());
    console.log(
      "%c Hi,今天又是新的一天咯，元气满满找工作~也愿这是你我最后一次相遇🥳",
      "color:red;font-size:36px;"
    );
  }
}

// 清理
function clear() {
  runT = false;
  GmSetValue(PUSH_LOCK, false);
  GmSetValue(PUSH_LIMIT, false);
  GmSetValue(BATCH_ENABLE, false);
}

// 等待
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 文档元素生成
function docEl() {
  const Div = document.createElement("div");
  const docDiv = document.createElement("div");
  const title = document.createElement("h2");
  Div.style.cssText = "overflow:hidden;height:32px;";
  title.textContent = `Boos直聘投递助手(${GmGetValue(PUSH_COUNT, 0)}次)`;
  title.style.cursor = "pointer";
  // 折叠功能(低能版)
  title.addEventListener("click", () => {
    if (Div.style.height == "32px") {
      Div.style.height = "420px";
    } else {
      Div.style.height = "32px";
    }
  });
  Div.appendChild(title);
  docDiv.style.cssText = "backgroundColor:#f2f2f2;padding:5px;width:100%;";
  for (let i = 0; i < docTextArr.length; i++) {
    const textTag = document.createElement("p");
    textTag.style.color = "rgb(127,124,l124);";
    textTag.innerHTML = docTextArr[i];
    docDiv.appendChild(textTag);
  }
  // 关于

  aboutLink.forEach((link) => {
    const about = document.createElement("p");
    link.forEach((item) => {
      const a = document.createElement("a");
      a.href = item[1];
      a.innerText = item[0];
      a.target = "_blank";
      a.style.margin = "0 20px 0 0";
      about.appendChild(a);
    });
    docDiv.appendChild(about);
  });

  // 增加观察者，实时修改(性能?不管~)
  GmAddValueChangeListener(
    PUSH_COUNT,
    function (name, old_value, new_value, remote) {
      title.textContent = `Boos直聘投递助手(${new_value}次)`;
    }
  );
  Div.appendChild(docDiv);
  return Div;
}
// 配置元素生成
function configEl() {
  // 加载持久化的配置，并加载到内存
  const config = JSON.parse(GmGetValue(LOCAL_CONFIG, "{}"));
  companyArr = companyArr.concat(config.companyArr);
  companyExclude = companyExclude.concat(config.companyExclude);
  descriptionExclude = descriptionExclude.concat(config.descriptionExclude);
  jobNameArr = jobNameArr.concat(config.jobNameArr);
  salaryRange = config.salaryRange ? config.salaryRange : salaryRange;
  companyScale = config.companyScale ? config.companyScale : companyScale;

  function renderConfigText() {
    /**
     * 渲染配置输入框
     * 将用户配置渲染到页面
     * 同时将钩子函数赋值！！！
     */
    const bossInput = document.createElement("div");
    bossInput.id = "boss-input";

    const companyLabel1 = document.createElement("label");
    companyLabel1.textContent = "公司名包含";
    const companyArr_ = document.createElement("input");
    companyArr_.type = "text";
    companyArr_.id = "companyArr";
    companyLabel1.appendChild(companyArr_);
    bossInput.appendChild(companyLabel1);
    companyArr_.value = deWeight(companyArr).join(",");

    const companyLabel2 = document.createElement("label");
    companyLabel2.textContent = "公司名排除";
    const companyExclude_ = document.createElement("input");
    companyExclude_.type = "text";
    companyExclude_.id = "companyExclude";
    companyLabel2.appendChild(companyExclude_);
    bossInput.appendChild(companyLabel2);
    companyExclude_.value = deWeight(companyExclude).join(",");

    const descriptionLabel = document.createElement("label");
    descriptionLabel.textContent = "工作内容排除";
    const descriptionExclude_ = document.createElement("input");
    descriptionExclude_.type = "text";
    descriptionExclude_.id = "descriptionExclude";
    descriptionLabel.appendChild(descriptionExclude_);
    bossInput.appendChild(descriptionLabel);
    descriptionExclude_.value = deWeight(descriptionExclude).join(",");

    const jobNameLabel = document.createElement("label");
    jobNameLabel.textContent = "Job名包含";
    const jobNameArr_ = document.createElement("input");
    jobNameArr_.type = "text";
    jobNameArr_.id = "jobNameArr";
    jobNameLabel.appendChild(jobNameArr_);
    bossInput.appendChild(jobNameLabel);
    jobNameArr_.value = deWeight(jobNameArr).join(",");

    const salaryLabel = document.createElement("label");
    salaryLabel.textContent = "薪资范围";
    const salaryRange_ = document.createElement("input");
    salaryRange_.type = "text";
    salaryRange_.id = "salaryRange";
    salaryLabel.appendChild(salaryRange_);
    bossInput.appendChild(salaryLabel);
    salaryRange_.value = salaryRange;

    const companyScaleLabel = document.createElement("label");
    companyScaleLabel.textContent = "公司规模范围";
    const companyScale_ = document.createElement("input");
    companyScale_.type = "text";
    companyScale_.id = "companyScale";
    companyScaleLabel.appendChild(companyScale_);
    bossInput.appendChild(companyScaleLabel);
    companyScale_.value = companyScale;

    // 美化样式
    bossInput.style.cssText =
      "padding: 20px; border: 1px solid rgb(204, 204, 204); background: rgb(240, 240, 240); border-radius: 10px; width: 100%;";

    const labels = bossInput.querySelectorAll("label");
    labels.forEach((label) => {
      label.style.cssText =
        "display: inline-block; width: 20%; font-weight: bold;";
    });

    const inputs = bossInput.querySelectorAll("input[type='text']");
    inputs.forEach((input) => {
      input.style.cssText =
        "margin-left: 10px; width: 70%; padding: 5px; border-radius: 5px; border: 1px solid rgb(204, 204, 204); box-sizing: border-box;";
    });

    loadConfig = () => {
      companyArr = companyArr_.value.split(",");
      companyExclude = companyExclude_.value.split(",");
      descriptionExclude = descriptionExclude_.value.split(",");
      jobNameArr = jobNameArr_.value.split(",");
      salaryRange = salaryRange_.value;
      companyScale = companyScale_.value = companyScale;
    };
    saveConfig = () => {
      const config = {
        companyArr: companyArr_.value.split(","),
        companyExclude: companyExclude_.value.split(","),
        descriptionExclude: descriptionExclude_.value.split(","),
        jobNameArr: jobNameArr_.value.split(","),
        salaryRange: salaryRange_.value,
        companyScale: companyScale_.value,
      };
      // 持久化配置
      GmSetValue(LOCAL_CONFIG, JSON.stringify(config));
    };
    return bossInput;
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
  // 将配置渲染到页面
  return renderConfigText();
}

GM_registerMenuCommand("切换Ck", async () => {
  let value = GM_getValue(ID_LIST) || [];
  GM_cookie("list", {}, async (list, error) => {
    if (error === undefined) {
      console.log(list, value);
      // 储存覆盖老的值
      GM_setValue(ID_LIST, list);
      // 先清空 再设置
      for (let i = 0; i < list.length; i++) {
        list[i].url = window.location.origin;
        await GM_cookie("delete", list[i]);
      }
      if (value.length) {
        // 循环set
        for (let i = 0; i < value.length; i++) {
          value[i].url = window.location.origin;
          await GM_cookie("set", value[i]);
        }
      }
      if (GM_getValue(ID_CUR, "") === "") {
        GM_setValue(ID_CUR, "_");
      } else {
        GM_setValue(ID_CUR, "");
      }
      window.location.reload();
      // window.alert("手动刷新～");
    } else {
      window.alert("你当前版本可能不支持Ck操作，错误代码：", error);
    }
  });
});

GM_registerMenuCommand("清除当前Ck", () => {
  if (GM_getValue(ID_CUR, "") === "_") {
    GM_setValue(ID_CUR, "");
  }
  GM_cookie("list", {}, async (list, error) => {
    if (error === undefined) {
      // 清空
      for (let i = 0; i < list.length; i++) {
        list[i].url = window.location.origin;
        // console.log(list[i]);
        await GM_cookie("delete", list[i]);
      }

      window.location.reload();
    } else {
      window.alert("你当前版本可能不支持Ck操作，错误代码：", error);
    }
  });
});

GM_registerMenuCommand("清空所有存储!", async () => {
  if (confirm("将清空脚本全部的设置!!")) {
    const asyncKeys = await GM_listValues();
    for (let index in asyncKeys) {
      console.log(asyncKeys[index]);
      await GM_deleteValue(asyncKeys[index]);
    }
    window.alert("OK!");
  }
});

(function () {
  const list_url = "web/geek/job";
  const recommend_url = "web/geek/recommend";
  const detail_url = "job_detail";
  curId = GM_getValue(ID_CUR, null);
  if (document.URL.includes(list_url) || document.URL.includes(recommend_url)) {
    upPage();
    ajaxHooker.filter([
      { type: "xhr", url: "wapi/zpgeek/search/joblist.json", method: "GET" },
      // 下面放需要拦截的uri,减少开支
      // { url: ".png" },
    ]);
    // 直接拦截请求url,修改page,实现无限下一页
    //ps:nt的限制最多30个，不然直接请求1000个了～
    ajaxHooker.hook((request) => {
      if (
        request.url.includes("wapi/zpgeek/search/joblist.json") &&
        request.method === "GET"
      ) {
        request.url = request.url.replace(/(?<=page=)\d*/, currentPage);
      } else {
        request.abort = true;
      }
    });
    window.addEventListener("load", jobListHandler);
  } else if (document.URL.includes(detail_url)) {
    window.addEventListener("load", jobDetailHandler);
  }
})();
