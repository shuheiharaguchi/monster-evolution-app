const STORAGE_PREFIX = "daily-monster-v3";
const TASK_PRESET_VERSION = 3;
const MAX_LEVEL = 30;

const profiles = {
  girl: {
    title: "女の子バージョン",
    owner: "女の子のきろく",
    birthDate: "2020-06-07",
    hueBase: 318,
    hueStep: 19,
    accentOffset: 62,
    wingOffset: 126,
    shapeOffset: 2,
    featureOffset: 0
  },
  boy: {
    title: "男の子バージョン",
    owner: "男の子のきろく",
    birthDate: "2022-12-24",
    hueBase: 188,
    hueStep: 23,
    accentOffset: 88,
    wingOffset: 146,
    shapeOffset: 5,
    featureOffset: 3
  }
};

const defaultTasks = [
  "おはようを言(い)う",
  "着替(きが)える",
  "ご飯(はん)を食(た)べる",
  "歯磨(はみが)きをする",
  "弁当(べんとう)水筒(すいとう)をかばんに入(い)れる",
  "靴下(くつした)を履(は)く",
  "忘(わす)れ物(もの)チェック",
  "帰(かえ)ってきてから手(て)を洗(あら)う",
  "カバンの中身(なかみ)を出(だ)す",
  "ひとつ父(とう)ちゃん母(かあ)ちゃんのおてつだい"
];

const previousDefaultTasks = [
  "おはようを言う",
  "着替える",
  "ご飯を食べる",
  "歯磨きをする",
  "弁当水筒をかばんに入れる",
  "靴下を履く",
  "忘れ物チェック",
  "帰ってきてから手を洗う",
  "カバンの中身を出す",
  "ひとつ父ちゃん母ちゃんのおてつだい",
  "あさのしたくをする",
  "はみがきをする",
  "ごはんをしっかり食べる",
  "からだを動かす",
  "本を読む",
  "おてつだいをする",
  "学校や宿題をがんばる",
  "ありがとうを言う",
  "明日の準備をする",
  "早くねる準備をする"
];

let activeKid = getInitialKid();
let state = loadState(activeKid);
const elements = {
  monster: document.getElementById("monster"),
  monsterWrap: document.getElementById("monsterWrap"),
  profileTitle: document.getElementById("profileTitle"),
  questOwner: document.getElementById("questOwner"),
  profileButtons: [...document.querySelectorAll(".profile-button")],
  levelText: document.getElementById("levelText"),
  scoreText: document.getElementById("scoreText"),
  progressFill: document.getElementById("progressFill"),
  questList: document.getElementById("questList"),
  completeButton: document.getElementById("completeButton"),
  messageBox: document.getElementById("messageBox"),
  todayText: document.getElementById("todayText"),
  settingsButton: document.getElementById("settingsButton"),
  taskDialog: document.getElementById("taskDialog"),
  taskForm: document.getElementById("taskForm"),
  editorList: document.getElementById("editorList"),
  addTaskButton: document.getElementById("addTaskButton"),
  resetTasksButton: document.getElementById("resetTasksButton"),
  confetti: document.getElementById("confetti")
};

resetDailyChecksIfNeeded();
render();
registerOfflineApp();

elements.profileButtons.forEach((button) => {
  button.addEventListener("click", () => switchProfile(button.dataset.kid));
});
elements.completeButton.addEventListener("click", evolveToday);
elements.settingsButton.addEventListener("click", openEditor);
elements.addTaskButton.addEventListener("click", () => {
  state.tasks = readEditorTasks();
  state.tasks.push("新しいチャレンジ");
  syncCheckedToTasks();
  renderEditor();
});
elements.resetTasksButton.addEventListener("click", () => {
  state.tasks = [...defaultTasks];
  state.checked = Array(state.tasks.length).fill(false);
  renderEditor();
});
elements.taskForm.addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  state.tasks = readEditorTasks();
  syncCheckedToTasks();
  saveState();
  render();
});

function loadState() {
  return loadProfileState(activeKid);
}

function loadProfileState(kid) {
  const today = getTodayKey();
  try {
    const saved = JSON.parse(localStorage.getItem(getStorageKey(kid)));
    if (saved && Array.isArray(saved.tasks)) {
      const shouldUseLatestTasks = saved.taskPresetVersion !== TASK_PRESET_VERSION;
      const migratedTasks = shouldUseLatestTasks ? migrateTasks(saved.tasks) : normalizeTasks(saved.tasks);
      return {
        level: clampNumber(saved.level || 1, 1, MAX_LEVEL),
        tasks: migratedTasks,
        checked: normalizeChecks(saved.checked, migratedTasks.length),
        completedDate: saved.completedDate || "",
        currentDate: saved.currentDate || today,
        taskPresetVersion: TASK_PRESET_VERSION
      };
    }
  } catch {
    // Ignore broken local data and start fresh.
  }
  return {
    level: 1,
    tasks: [...defaultTasks],
    checked: Array(10).fill(false),
    completedDate: "",
    currentDate: today,
    taskPresetVersion: TASK_PRESET_VERSION
  };
}

function normalizeTasks(tasks) {
  const oldDefaultSet = new Set(previousDefaultTasks);
  const length = Math.max(defaultTasks.length, tasks.length);
  return Array.from({ length }, (_, index) => {
    const task = tasks[index];
    if (!task || oldDefaultSet.has(task)) return defaultTasks[index] || "新しいチャレンジ";
    return task;
  });
}

function migrateTasks(tasks) {
  const customTasks = tasks.slice(defaultTasks.length).filter(Boolean);
  return [...defaultTasks, ...customTasks];
}

function normalizeChecks(checked, length) {
  return Array.from({ length }, (_, index) => Boolean(Array.isArray(checked) && checked[index]));
}

function syncCheckedToTasks() {
  state.checked = normalizeChecks(state.checked, state.tasks.length);
}

function saveState() {
  state.taskPresetVersion = TASK_PRESET_VERSION;
  localStorage.setItem(getStorageKey(activeKid), JSON.stringify(state));
}

function resetDailyChecksIfNeeded() {
  const today = getTodayKey();
  if (state.currentDate !== today) {
    state.currentDate = today;
    state.checked = Array(state.tasks.length).fill(false);
    state.completedDate = "";
    saveState();
  }
}

function render() {
  syncCheckedToTasks();
  const completed = state.checked.filter(Boolean).length;
  const total = state.tasks.length;
  const canEvolve = total > 0 && completed === total && state.completedDate !== getTodayKey() && state.level < MAX_LEVEL;
  const profile = profiles[activeKid];

  document.body.dataset.kid = activeKid;
  document.title = `まいにちモンスター - ${profile.title}`;
  elements.profileTitle.textContent = `${profile.title} ${getAge(profile.birthDate)}さい`;
  elements.questOwner.textContent = profile.owner;
  elements.profileButtons.forEach((button) => {
    const isActive = button.dataset.kid === activeKid;
    button.setAttribute("aria-pressed", String(isActive));
    button.querySelector("small").textContent = `${getAge(profiles[button.dataset.kid].birthDate)}さい`;
  });
  elements.levelText.textContent = `${state.level} / ${MAX_LEVEL}`;
  elements.scoreText.textContent = `${completed} / ${total}`;
  elements.progressFill.style.width = `${((state.level - 1) / (MAX_LEVEL - 1)) * 100}%`;
  elements.completeButton.disabled = !canEvolve;
  elements.completeButton.textContent = state.level >= MAX_LEVEL ? "最終進化!" : "進化させる";
  elements.todayText.textContent = formatToday();

  renderMonster();
  renderTasks();
  updateMessage(completed);
  saveState();
}

function renderMonster() {
  const stage = state.level - 1;
  const profile = profiles[activeKid];
  const profileShift = profile.featureOffset;
  const evolvedStage = stage + profileShift;
  const hue = (profile.hueBase + stage * profile.hueStep) % 360;
  const accentHue = (hue + profile.accentOffset + (stage % 5) * 11) % 360;
  const wingHue = (hue + profile.wingOffset + (stage % 7) * 8) % 360;
  const main = `hsl(${hue} 72% ${52 + (stage % 4) * 3}%)`;
  const accent = `hsl(${accentHue} 92% ${58 + (stage % 3) * 4}%)`;
  const wing = `hsl(${wingHue} 85% 68%)`;
  const belly = `hsl(${(hue + 42) % 360} 88% 88%)`;
  const tier = Math.floor(stage / 5);
  const sizeBoost = Math.min(0.32, stage * 0.0105);
  const shapeA = 38 + tier * 4 + ((stage + profile.shapeOffset) % 5);
  const shapeB = 62 - tier * 3 - ((stage + profile.shapeOffset) % 4);
  const shapeC = 36 + tier * 5 + (((stage + profile.shapeOffset) * 2) % 6);
  const eyeSize = 16 + tier + (evolvedStage % 4);
  const pupilSize = 30 + ((evolvedStage * 3) % 13);
  const mouthWidth = 12 + (evolvedStage % 9);
  const hornHeight = 16 + tier * 4 + (evolvedStage % 5);
  const hornTilt = 10 + tier * 3 + (evolvedStage % 8);
  const wingSize = 20 + tier * 4 + (evolvedStage % 6);
  const tailSize = 20 + tier * 5 + (evolvedStage % 7);
  const armSize = 14 + tier * 3 + (evolvedStage % 5);
  const footSize = 18 + tier * 2;
  const hasArms = stage >= 1;
  const hasTail = stage >= 4;
  const hasHorns = stage >= 8;
  const hasWings = stage >= 12;
  const hasTeeth = stage >= 18;
  const hasCrest = stage >= 23;
  const princess = activeKid === "girl";
  const vehicle = activeKid === "boy";
  const hasThemeOne = stage >= 1;
  const hasThemeTwo = stage >= 5;
  const hasThemeThree = stage >= 10;
  const hasThemeFour = stage >= 15;
  const hasThemeFive = stage >= 20;

  elements.monster.style.setProperty("--monster-main", main);
  elements.monster.style.setProperty("--monster-accent", accent);
  elements.monster.style.setProperty("--monster-wing", wing);
  elements.monster.style.setProperty("--monster-belly", belly);
  elements.monster.style.setProperty("--scale", String(0.92 + sizeBoost));
  elements.monster.style.setProperty("--body-radius", `${shapeA}% ${shapeB}% ${shapeC}% ${100 - shapeC}% / ${shapeB}% ${shapeA}% ${100 - shapeA}% ${shapeC}%`);
  elements.monster.style.setProperty("--spot-one", `${24 + (evolvedStage * 5) % 48}% ${20 + (evolvedStage * 7) % 46}%`);
  elements.monster.style.setProperty("--spot-two", `${34 + (evolvedStage * 11) % 38}% ${48 + (evolvedStage * 3) % 30}%`);
  elements.monster.style.setProperty("--spot-size", `${8 + (evolvedStage % 6)}%`);
  elements.monster.style.setProperty("--eye-size", `${eyeSize}%`);
  elements.monster.style.setProperty("--pupil-size", `${pupilSize}%`);
  elements.monster.style.setProperty("--mouth-width", `${mouthWidth}%`);
  elements.monster.style.setProperty("--horn-height", `${hornHeight}%`);
  elements.monster.style.setProperty("--horn-tilt", `${hornTilt}deg`);
  elements.monster.style.setProperty("--wing-size", `${wingSize}%`);
  elements.monster.style.setProperty("--tail-size", `${tailSize}%`);
  elements.monster.style.setProperty("--arm-size", `${armSize}%`);
  elements.monster.style.setProperty("--foot-size", `${footSize}%`);
  elements.monster.style.setProperty("--body-squash", `${100 - tier * 3}%`);
  elements.monster.style.setProperty("--arms", hasArms ? "1" : "0");
  elements.monster.style.setProperty("--horns", hasHorns ? "1" : "0");
  elements.monster.style.setProperty("--tail", hasTail ? "1" : "0");
  elements.monster.style.setProperty("--wings", hasWings ? "1" : "0");
  elements.monster.style.setProperty("--teeth", hasTeeth ? "1" : "0");
  elements.monster.style.setProperty("--crest", hasCrest ? "1" : "0");
  elements.monster.style.setProperty("--princess-dress", princess && hasThemeOne ? "1" : "0");
  elements.monster.style.setProperty("--princess-tiara", princess && hasThemeTwo ? "1" : "0");
  elements.monster.style.setProperty("--princess-bow", princess && hasThemeThree ? "1" : "0");
  elements.monster.style.setProperty("--princess-wand", princess && hasThemeFour ? "1" : "0");
  elements.monster.style.setProperty("--princess-sparkle", princess && hasThemeFive ? "1" : "0");
  elements.monster.style.setProperty("--vehicle-wheels", vehicle && hasThemeOne ? "1" : "0");
  elements.monster.style.setProperty("--vehicle-cab", vehicle && hasThemeTwo ? "1" : "0");
  elements.monster.style.setProperty("--vehicle-light", vehicle && hasThemeThree ? "1" : "0");
  elements.monster.style.setProperty("--vehicle-scoop", vehicle && hasThemeFour ? "1" : "0");
  elements.monster.style.setProperty("--vehicle-bed", vehicle && hasThemeFive ? "1" : "0");
  elements.monsterWrap.setAttribute("aria-label", `${profile.title}、進化レベル${state.level}のモンスター`);
}

function renderTasks() {
  elements.questList.replaceChildren();
  state.tasks.forEach((task, index) => {
    const label = document.createElement("label");
    label.className = "quest-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(state.checked[index]);
    checkbox.addEventListener("change", () => {
      state.checked[index] = checkbox.checked;
      render();
    });

    const name = document.createElement("span");
    name.className = "quest-name";
    name.textContent = task;

    const number = document.createElement("span");
    number.className = "quest-number";
    number.textContent = index + 1;

    label.append(checkbox, name, number);
    elements.questList.append(label);
  });
}

function updateMessage(completed) {
  const total = state.tasks.length;
  if (state.level >= MAX_LEVEL) {
    elements.messageBox.textContent = "すごい! 30段階の最終進化まで育ったよ。今日もチャレンジを続けよう。";
    return;
  }
  if (state.completedDate === getTodayKey()) {
    elements.messageBox.textContent = "今日の進化は完了! 明日また10こ達成すると、もう1段階進化するよ。";
    return;
  }
  if (completed === total) {
    elements.messageBox.textContent = "ぜんぶできた! ボタンを押してモンスターを進化させよう。";
    return;
  }
  const remaining = total - completed;
  elements.messageBox.textContent = `あと${remaining}こで今日の進化チャンス!`;
}

function evolveToday() {
  if (state.checked.filter(Boolean).length !== state.tasks.length || state.completedDate === getTodayKey()) return;
  state.level = Math.min(MAX_LEVEL, state.level + 1);
  state.completedDate = getTodayKey();
  burstConfetti();
  render();
}

function openEditor() {
  renderEditor();
  elements.taskDialog.showModal();
}

function renderEditor() {
  elements.editorList.replaceChildren();
  state.tasks.forEach((task, index) => {
    const row = document.createElement("div");
    row.className = "editor-row";

    const number = document.createElement("span");
    number.textContent = index + 1;

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 28;
    input.value = task;
    input.setAttribute("aria-label", `${index + 1}番目の項目`);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-task-button";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `${index + 1}番目の追加項目を削除`);
    removeButton.disabled = index < defaultTasks.length;
    removeButton.addEventListener("click", () => {
      state.tasks = readEditorTasks();
      state.tasks.splice(index, 1);
      syncCheckedToTasks();
      renderEditor();
    });

    row.append(number, input, removeButton);
    elements.editorList.append(row);
  });
}

function readEditorTasks() {
  const inputs = [...elements.editorList.querySelectorAll("input")];
  return inputs.map((input, index) => {
    const fallback = defaultTasks[index] || "新しいチャレンジ";
    return input.value.trim() || fallback;
  });
}

function burstConfetti() {
  elements.confetti.replaceChildren();
  const colors = ["#ffd166", "#ff6f91", "#49bdf2", "#3fd7ac", "#8b7cff"];
  for (let index = 0; index < 70; index += 1) {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    elements.confetti.append(piece);
  }
  setTimeout(() => elements.confetti.replaceChildren(), 1900);
}

function switchProfile(kid) {
  if (!profiles[kid] || kid === activeKid) return;
  saveState();
  activeKid = kid;
  state = loadProfileState(activeKid);
  resetDailyChecksIfNeeded();
  const url = new URL(window.location.href);
  url.searchParams.set("kid", activeKid);
  window.history.replaceState({}, "", url);
  render();
}

function getInitialKid() {
  const kid = new URLSearchParams(window.location.search).get("kid");
  return profiles[kid] ? kid : "girl";
}

function getStorageKey(kid) {
  return `${STORAGE_PREFIX}-${kid}`;
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatToday() {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date());
}

function getAge(birthDateText) {
  const today = new Date();
  const birthDate = new Date(`${birthDateText}T00:00:00`);
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (today < birthdayThisYear) age -= 1;
  return age;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function registerOfflineApp() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still works online/local even when offline registration is unavailable.
    });
  });
}
